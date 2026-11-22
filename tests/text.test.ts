import { beforeAll, describe, expect, it } from 'vitest';
import { extractPdfPages, groupIntoLines, type PdfPage } from '../src/core/pdf.js';
import {
  buildJudgmentText,
  buildParagraphs,
  buildSections,
  normalizeText,
  removeLetterSpacing,
  renderText,
  type JudgmentText,
} from '../src/core/text.js';
import { cmapLoader, fixtureBytes } from './helpers.js';

describe('normalizeText', () => {
  it('全角の英数字を半角にする', () => {
    expect(normalizeText('平成１５年５月１９日　ＡＢＣ')).toBe('平成15年5月19日 ABC');
    expect(normalizeText('年１４．６パーセント')).toBe('年14.6パーセント');
    // 「，」は読点としても使われるので変えない
    expect(normalizeText('原告Ａ，Ｂに対し１，２３４円')).toBe('原告A，Bに対し1，234円');
  });

  it('1文字ずつ空けた見出しを詰める', () => {
    expect(normalizeText('主 文')).toBe('主文');
    expect(normalizeText('事 実 及 び 理 由')).toBe('事実及び理由');
    expect(normalizeText('1 原告の請求を棄却する。')).toBe('1 原告の請求を棄却する。');
  });
});

describe('removeLetterSpacing', () => {
  it('均等割り付けで1文字ごとに空いた行を詰める', () => {
    expect(removeLetterSpacing('と の 確 認 を 求 め （ 以 下 、 こ の 請 求')).toBe('との確認を求め（以下、この請求');
    expect(removeLetterSpacing('１ 原告の請求を棄却する。')).toBe('１ 原告の請求を棄却する。');
    expect(removeLetterSpacing('ア 相違点１について')).toBe('ア 相違点１について');
  });
});

describe('groupIntoLines', () => {
  it('同じ高さの文字を左から順につなぐ', () => {
    const lines = groupIntoLines([
      { str: '文', x: 338, y: 726, width: 12, size: 12 },
      { str: '主', x: 266, y: 726, width: 12, size: 12 },
      { str: ' ', x: 278, y: 726, width: 60, size: 0 },
      { str: '被告は、', x: 113, y: 700, width: 48, size: 12 },
      { str: '１', x: 89, y: 700, width: 12, size: 12 },
    ]);
    expect(lines.map((l) => l.text)).toEqual(['主 文', '１ 被告は、']);
    expect(lines[1]?.left).toBe(89);
    expect(lines[1]?.right).toBe(161);
  });

  it('和文と半角数字の間の自動のすき間（約1/4文字）は空白にしない', () => {
    const lines = groupIntoLines([
      { str: '令和', x: 85.1, y: 700, width: 24.6, size: 12 },
      { str: ' ', x: 109.7, y: 700, width: 3.7, size: 0 },
      { str: '6', x: 113.4, y: 700, width: 6.7, size: 12 },
      { str: ' ', x: 120.1, y: 700, width: 3.5, size: 0 },
      { str: '年（ワ）第', x: 123.6, y: 700, width: 62.6, size: 12 },
      { str: ' ', x: 186.3, y: 700, width: 3.7, size: 0 },
      { str: '32387', x: 190.0, y: 700, width: 34.6, size: 12 },
      { str: ' ', x: 224.6, y: 700, width: 3.6, size: 0 },
      { str: '号', x: 228.2, y: 700, width: 12, size: 12 },
      { str: ' ', x: 240.2, y: 700, width: 13.2, size: 0 },
      { str: '売買代金請求事件', x: 253.4, y: 700, width: 100.5, size: 12 },
    ]);
    expect(lines[0]?.text).toBe('令和6年（ワ）第32387号 売買代金請求事件');
  });

  it('英単語の間の空白は、狭くても残す', () => {
    const lines = groupIntoLines([
      { str: 'Disease', x: 100, y: 700, width: 40, size: 12 },
      { str: ' ', x: 140, y: 700, width: 3, size: 0 },
      { str: 'and', x: 143, y: 700, width: 18, size: 12 },
      { str: ' Treatment', x: 161, y: 700, width: 55, size: 12 },
    ]);
    expect(lines[0]?.text).toBe('Disease and Treatment');
  });
});

function page(number: number, lines: Array<[text: string, left: number, right: number, y: number]>): PdfPage {
  return {
    number,
    width: 595,
    height: 842,
    lines: lines.map(([text, left, right, y]) => ({ text, left, right, y, size: 12 })),
  };
}

describe('buildParagraphs', () => {
  it('右端まで届いた行を次の行とつなぎ、ページ番号を除く', () => {
    const full = 'あ'.repeat(36);
    const { paragraphs } = buildParagraphs([
      page(1, [
        [`１ ${full}`, 109, 552, 700],
        [full, 121, 552, 676],
        ['おわり。', 121, 169, 652],
        [`${full}`, 133, 552, 628],
        [full, 121, 552, 604],
        [full, 121, 552, 580],
        ['- 1 -', 293, 312, 33],
      ]),
      page(2, [
        ['つづき。', 121, 169, 700],
        [`２ ${full}`, 109, 552, 676],
        ['- 2 -', 293, 312, 33],
      ]),
    ]);
    expect(paragraphs).toEqual([
      { page: 1, text: `1 ${full}${full}おわり。` },
      // ページをまたぐ段落は、始まりのページに属する
      { page: 1, text: `${full}${full}${full}つづき。` },
      { page: 2, text: `2 ${full}` },
    ]);
  });

  it('字下げされた行は新しい段落にする', () => {
    const full = 'い'.repeat(36);
    const { paragraphs } = buildParagraphs([
      page(1, [
        [full, 133, 552, 700],
        [full, 121, 552, 676],
        [full, 133, 552, 652],
        [full, 121, 552, 628],
        [full, 121, 552, 604],
      ]),
    ]);
    expect(paragraphs.map((p) => p.text.length)).toEqual([72, 108]);
  });

  it('主文では幅が狭くても折り返しをつなぐが、離れた位置の日付・署名はつながない', () => {
    const { paragraphs } = buildParagraphs([
      page(1, [
        ['主 文', 242, 326, 700],
        ['１ 原告のために、この判決に対する上告及び上告受理', 181, 483, 676],
        ['申立てのための付加期間を３０日と定める。', 193, 435, 652],
        ['請求人等に対し、別紙計算書記載の金員を交付', 181, 440, 628],
        ['昭和三〇年一二月二六日', 300, 432, 604],
        ['最高裁判所第二小法廷', 320, 440, 580],
        ['裁判長裁判官 栗 山 茂', 360, 500, 556],
      ]),
    ]);
    expect(paragraphs.map((p) => p.text)).toEqual([
      '主文',
      '1 原告のために、この判決に対する上告及び上告受理申立てのための付加期間を30日と定める。',
      '請求人等に対し、別紙計算書記載の金員を交付',
      '昭和三〇年一二月二六日',
      '最高裁判所第二小法廷',
      '裁判長裁判官 栗 山 茂',
    ]);
  });

  it('文字のないページを記録する', () => {
    const { emptyPages } = buildParagraphs([page(1, [['本文', 100, 124, 700]]), page(2, [])]);
    expect(emptyPages).toEqual([2]);
  });
});

describe('buildSections', () => {
  it('主文・理由・第N・補足意見・別紙で区切る', () => {
    const paragraphs = [
      '令和8年11月18日 大法廷判決',
      '主文',
      '本件上告を棄却する。',
      '理由',
      '第1 事案の概要',
      '第1審被告は、次のとおり主張する。',
      '第2 当裁判所の判断',
      '以上のとおりである。',
      '裁判官甲野太郎の補足意見は、次のとおりである。',
      '私は多数意見に賛成する。',
      '（別紙）物件目録',
    ].map((text, i) => ({ page: Math.floor(i / 4) + 1, text }));
    // 昔の行政事件の判決では、見出しの頭に「○」が付く
    expect(buildSections([{ page: 1, text: '○ 主文' }, { page: 1, text: '本件控訴を棄却する。' }, { page: 1, text: '○ 事実' }], 1).map((s) => s.title)).toEqual(['主文', '事実']);
    const sections = buildSections(paragraphs, 3);
    expect(sections.map((s) => [s.index, s.level, s.title])).toEqual([
      [1, 1, '冒頭'],
      [2, 1, '主文'],
      [3, 1, '理由'],
      [4, 2, '第1 事案の概要'],
      [5, 2, '第2 当裁判所の判断'],
      [6, 1, '裁判官甲野太郎の補足意見'],
      [7, 1, '（別紙）物件目録'],
    ]);
    // 「理由」は次の同じ階層の見出し（補足意見）の手前まで
    expect(sections[2]?.paragraphStart).toBe(3);
    expect(sections[2]?.paragraphEnd).toBe(8);
    // 「第1審被告は、…」は見出しではない
    expect(sections[3]?.paragraphEnd).toBe(6);
  });
});

describe('実際のPDF', () => {
  describe('昭和30年の最高裁判決（フォント非埋め込み・CMapが必要）', () => {
    let doc: JudgmentText;
    beforeAll(async () => {
      doc = buildJudgmentText(await extractPdfPages(fixtureBytes('hanrei-pdf-57453.pdf'), cmapLoader));
    });

    it('文字を取り出せる', () => {
      expect(doc.pageCount).toBe(1);
      expect(doc.charCount).toBeGreaterThan(300);
      expect(doc.paragraphs[0]?.text).toBe('主文');
      expect(doc.paragraphs[1]?.text).toBe('本件上告を棄却する。');
      expect(doc.sections.map((s) => s.title)).toEqual(['主文', '理由']);
    });

    it('行をつないで文にしている', () => {
      const p = doc.paragraphs.find((x) => x.text.startsWith('民訴三五条六号'));
      expect(p?.text).toBe('民訴三五条六号にいう「前審」とは、当該事件の直接又は間接の下級審を指すのである。');
    });
  });

  it('CMapを渡さないと古いPDFからは文字を取り出せない', async () => {
    const pages = await extractPdfPages(fixtureBytes('hanrei-pdf-57453.pdf'));
    expect(pages.flatMap((p) => p.lines)).toHaveLength(0);
  });

  describe('令和8年の知財高裁判決（左余白に行番号がある）', () => {
    let doc: JudgmentText;
    beforeAll(async () => {
      doc = buildJudgmentText(await extractPdfPages(fixtureBytes('hanrei-pdf-97242.pdf'), cmapLoader));
    });

    it('行番号とページ番号を本文から除いている', () => {
      expect(doc.pageCount).toBe(18);
      const text = doc.paragraphs.map((p) => p.text).join('\n');
      expect(text).not.toMatch(/- \d+ -/);
      expect(text).toContain(
        '原告は、令和4年11月15日付けで、本願につき拒絶の査定を受けたため、令和5年3月8日、同拒絶査定に対する不服審判請求（不服2023－3961号事件）をした。また、原告は、令和7年3月10日付けで、本願につき、特許請求の範囲の補正を伴う手続補正をした。',
      );
    });

    it('幅の狭い主文でも、文の途中の改行をつないでいる', () => {
      const texts = doc.paragraphs.map((p) => p.text);
      expect(texts).toContain('3 原告のために、この判決に対する上告及び上告受理申立てのための付加期間を30日と定める。');
      expect(texts).toContain('1 原告の請求を棄却する。');
    });

    it('見出しで区切っている', () => {
      const titles = doc.sections.map((s) => s.title);
      expect(titles).toEqual(expect.arrayContaining(['主文', '事実及び理由', '第1 請求', '第2 事案の概要', '第5 当裁判所の判断']));
      const reasons = doc.sections.find((s) => s.title === '第5 当裁判所の判断');
      expect(reasons?.level).toBe(2);
      expect(reasons?.pageFrom).toBe(7);
    });
  });

  describe('平成15年の地裁判決', () => {
    let doc: JudgmentText;
    beforeAll(async () => {
      doc = buildJudgmentText(await extractPdfPages(fixtureBytes('hanrei-pdf-8300.pdf'), cmapLoader));
    });

    it('ページ範囲・見出しを指定して取り出せる', () => {
      const main = doc.sections.find((s) => s.title === '主文');
      expect(main).toBeDefined();
      const r = renderText(doc, { section: main!.index, maxChars: 10_000 });
      expect(r.text.startsWith('【1頁】\n主文\n1 被告は，原告Aに対し金2363万9396円')).toBe(true);
      expect(r.truncated).toBe(false);

      const pages = renderText(doc, { pageFrom: 2, pageTo: 3, maxChars: 100_000 });
      expect(pages.text.startsWith('【2頁】\n')).toBe(true);
      expect(pages.text).toContain('\n【3頁】\n');
      expect(pages.text).not.toContain('【4頁】');
      expect(pages.pageFrom).toBe(2);
      expect(pages.pageTo).toBe(3);
    });

    it('上限を超えるとページの区切りで打ち切り、続きの位置を返す', () => {
      const r = renderText(doc, { maxChars: 3000 });
      expect(r.truncated).toBe(true);
      expect(r.chars).toBeLessThanOrEqual(3000);
      expect(r.nextPageFrom).toBe(r.pageTo + 1);
      const rest = renderText(doc, { pageFrom: r.nextPageFrom!, maxChars: 1_000_000 });
      expect(r.chars + rest.chars).toBe(doc.charCount);
    });

    it('1ページが上限より長くても、少なくとも1ページは返す', () => {
      const r = renderText(doc, { pageFrom: 2, maxChars: 10 });
      expect(r.pageTo).toBe(2);
      expect(r.chars).toBeGreaterThan(10);
      expect(r.nextPageFrom).toBe(3);
    });

    it('範囲外の指定はエラー', () => {
      expect(() => renderText(doc, { pageFrom: 5, pageTo: 99, maxChars: 1000 })).toThrow(/ページ範囲/);
      expect(() => renderText(doc, { section: 99, maxChars: 1000 })).toThrow(/section/);
    });
  });
});
