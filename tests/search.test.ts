import { describe, expect, it } from 'vitest';
import {
  buildSearchParams,
  buildSearchUrl,
  findJikenCode,
  needsJikenCodes,
  parseCaseNumber,
  parseJikenCodes,
  parseSearchResults,
  SearchRejectedError,
} from '../src/core/search.js';
import { fixtureText } from './helpers.js';

const SEARCH1 = 'https://www.courts.go.jp/hanrei/search1/index.html';

describe('parseCaseNumber', () => {
  it('いろいろな書き方を読み取る', () => {
    expect(parseCaseNumber('令和5年(ワ)第680号')).toEqual({ gengo: '令和', year: 5, code: 'ワ', number: 680 });
    expect(parseCaseNumber('平成２５年（ネ）第２３３４号')).toEqual({ gengo: '平成', year: 25, code: 'ネ', number: 2334 });
    expect(parseCaseNumber('令和6(行ツ)193')).toEqual({ gengo: '令和', year: 6, code: '行ツ', number: 193 });
    expect(parseCaseNumber('平成20年刑(わ)第123号')).toEqual({ gengo: '平成', year: 20, code: '刑わ', number: 123 });
    expect(parseCaseNumber('令和元年(受)第1号')).toEqual({ gengo: '令和', year: 1, code: '受', number: 1 });
    expect(parseCaseNumber('令和5(行ウ)171等')).toEqual({ gengo: '令和', year: 5, code: '行ウ', number: 171 });
  });

  it('一部だけの指定も受け付ける', () => {
    expect(parseCaseNumber('令和5年(ワ)')).toEqual({ gengo: '令和', year: 5, code: 'ワ' });
    expect(parseCaseNumber('(行ケ)10011')).toEqual({ code: '行ケ', number: 10011 });
  });

  it('読み取れないものはエラー', () => {
    expect(() => parseCaseNumber('')).toThrow();
    expect(() => parseCaseNumber('2023年123号事件')).toThrow();
  });
});

describe('parseJikenCodes / findJikenCode', () => {
  const codes = parseJikenCodes(fixtureText('search-form.html'));

  it('検索フォームから事件符号の選択肢を取り出す', () => {
    expect(codes.length).toBeGreaterThan(100);
    expect(codes[0]).toEqual({ value: '1', label: '(あ)' });
  });

  it('符号からフォームの値を引く（ひらがな・カタカナを区別する）', () => {
    expect(findJikenCode('ワ', codes).value).toBe('64');
    expect(findJikenCode('わ', codes).label).toBe('(わ)');
    expect(findJikenCode('(行ウ)', codes).label).toBe('(行ウ)');
    expect(findJikenCode('刑わ', codes).label).toBe('刑(わ)');
    expect(() => findJikenCode('存在しない', codes)).toThrow(/選択肢にありません/);
  });

  it('フォームがないHTMLはエラー', () => {
    expect(() => parseJikenCodes('<html><body>メンテナンス中</body></html>')).toThrow(/構成が変わった/);
  });
});

describe('buildSearchParams', () => {
  const codes = [
    { value: '64', label: '(ワ)' },
    { value: '86', label: '(行ツ)' },
  ];

  it('キーワード検索', () => {
    const p = buildSearchParams({ keywords: '安全配慮義務', keywordsAnd: '過労死' });
    expect(p.get('query1')).toBe('安全配慮義務');
    expect(p.get('query2')).toBe('過労死');
    expect(p.get('offset')).toBe('0');
    expect(p.get('sort')).toBe('1');
    expect(p.has('courtCaseType')).toBe(false);
  });

  it('keywords_and だけなら query1 として送る', () => {
    const p = buildSearchParams({ keywordsAnd: '過労死' });
    expect(p.get('query1')).toBe('過労死');
    expect(p.has('query2')).toBe(false);
  });

  it('期間を元号に直す', () => {
    const p = buildSearchParams({ keywords: 'x', dateFrom: '1989-01-07', dateTo: '2019-05' });
    expect(p.get('filter[judgeDateMode]')).toBe('2');
    expect(p.get('filter[judgeGengoFrom]')).toBe('昭和');
    expect(p.get('filter[judgeYearFrom]')).toBe('64');
    expect(p.get('filter[judgeMonthFrom]')).toBe('1');
    expect(p.get('filter[judgeDayFrom]')).toBe('7');
    expect(p.get('filter[judgeGengoTo]')).toBe('令和');
    expect(p.get('filter[judgeYearTo]')).toBe('1');
    expect(p.get('filter[judgeMonthTo]')).toBe('5');
    expect(p.get('filter[judgeDayTo]')).toBe('31');
  });

  it('始めだけ・終わりだけの期間も指定できる', () => {
    const fromOnly = buildSearchParams({ keywords: 'x', dateFrom: '2020' });
    expect(fromOnly.get('filter[judgeGengoFrom]')).toBe('令和');
    expect(fromOnly.get('filter[judgeGengoTo]')).toBe('令和');
    const toOnly = buildSearchParams({ keywords: 'x', dateTo: '1960' });
    expect(toOnly.get('filter[judgeGengoFrom]')).toBe('昭和');
    expect(toOnly.get('filter[judgeYearFrom]')).toBe('1');
    expect(toOnly.get('filter[judgeYearTo]')).toBe('35');
  });

  it('期間の前後が逆ならエラー', () => {
    expect(() => buildSearchParams({ dateFrom: '2021', dateTo: '2020' })).toThrow(/後になっています/);
  });

  it('事件番号を元号・年・符号・番号に分ける', () => {
    const p = buildSearchParams({ caseNumber: '令和6年(行ツ)第193号' }, codes);
    expect(p.get('filter[jikenGengo]')).toBe('令和');
    expect(p.get('filter[jikenYear]')).toBe('6');
    expect(p.get('filter[jikenCode]')).toBe('86');
    expect(p.get('filter[jikenNumber]')).toBe('193');
  });

  it('区分ごとの固定パラメータを付ける', () => {
    expect(buildSearchParams({ category: 'supreme', keywords: 'x' }).get('courtCaseType')).toBe('1');
    const ip = buildSearchParams({ category: 'ip', keywords: 'x' });
    expect(ip.get('courtCaseType')).toBe('6 7');
    expect(ip.get('view')).toBe('main');
    expect(buildSearchUrl({ category: 'labor', keywords: 'x' })).toMatch(/\/hanrei\/search6\/index\.html\?/);
  });

  it('区分によって使えない条件はエラーにする', () => {
    expect(() => buildSearchParams({ caseName: '損害賠償' })).toThrow(/case_name/);
    expect(() => buildSearchParams({ category: 'supreme', courtName: '東京高等裁判所' })).toThrow(/court_name/);
    expect(buildSearchParams({ category: 'supreme', caseName: '損害賠償' }).get('filter[jikenName]')).toBe('損害賠償');
  });

  it('条件が1つもなければエラー', () => {
    expect(() => buildSearchParams({})).toThrow(/少なくとも1つ/);
    expect(() => buildSearchParams({ category: 'ip' })).toThrow(/少なくとも1つ/);
  });

  it('並び順と offset', () => {
    const p = buildSearchParams({ keywords: 'x', sort: 'court', offset: 60 });
    expect(p.get('sort')).toBe('3');
    expect(p.get('offset')).toBe('60');
    expect(() => buildSearchParams({ keywords: 'x', offset: -1 })).toThrow(/offset/);
  });

  it('事件符号が必要かどうかを判定する', () => {
    expect(needsJikenCodes({ caseNumber: '令和5(ワ)680' })).toBe(true);
    expect(needsJikenCodes({ caseNumber: '令和5年' })).toBe(false);
    expect(needsJikenCodes({ keywords: 'x' })).toBe(false);
  });
});

describe('parseSearchResults', () => {
  it('統合検索の結果を解析する', () => {
    const r = parseSearchResults(fixtureText('search-all-keyword.html'), `${SEARCH1}?query1=x&offset=0`);
    expect(r.total).toBe(519);
    expect(r.offset).toBe(0);
    expect(r.items).toHaveLength(30);
    expect(r.nextOffset).toBe(30);
    expect(r.items[0]).toEqual({
      id: 97124,
      caseNumber: '令和5(ワ)680号',
      caseName: '損害賠償請求事件',
      date: '令和8年8月26日',
      dateIso: '2026-08-26',
      court: '鹿児島地方裁判所',
      notes: [],
      categories: [
        { detailType: 4, label: '下級裁裁判例', url: 'https://www.courts.go.jp/hanrei/97124/detail4/index.html' },
      ],
      pdfUrl: 'https://www.courts.go.jp/assets/hanrei/hanrei-pdf-97124.pdf',
    });
  });

  it('複数の区分に載っている裁判例は、区分をすべて返す', () => {
    const r = parseSearchResults(fixtureText('search-all-keyword.html'), `${SEARCH1}?query1=x`);
    const item = r.items.find((i) => i.id === 94346);
    expect(item?.categories.map((c) => c.detailType)).toEqual([4, 5]);
    expect(item?.categories.map((c) => c.label)).toEqual(['下級裁裁判例', '行政事件裁判例']);
  });

  it('知財の結果は、権利種別・争点などを notes に入れる', () => {
    const r = parseSearchResults(
      fixtureText('search-ip.html'),
      'https://www.courts.go.jp/hanrei/search7/index.html?courtCaseType=6+7&view=main',
    );
    expect(r.total).toBe(48);
    expect(r.items).toHaveLength(30);
    const item = r.items.find((i) => i.id === 97239);
    expect(item?.court).toBe('知的財産高等裁判所');
    expect(item?.categories[0]?.detailType).toBe(8);
    expect(item?.notes).toContain('特許権');
    expect(item?.notes).toContain('間接侵害(進歩性)');
    expect(r.items.some((i) => i.categories[0]?.detailType === 7)).toBe(true);
  });

  it('該当なしは0件として返す', () => {
    const r = parseSearchResults(fixtureText('search-none.html'), `${SEARCH1}?x=1`);
    expect(r.total).toBe(0);
    expect(r.items).toEqual([]);
    expect(r.nextOffset).toBeNull();
  });

  it('全文検索の該当が2000件を超えた場合は、0件ではなくエラーにする', () => {
    const run = () =>
      parseSearchResults(
        fixtureText('search-over-limit.html'),
        'https://www.courts.go.jp/hanrei/search2/index.html?courtCaseType=1&query1=x',
      );
    expect(run).toThrow(SearchRejectedError);
    expect(run).toThrow(/2000件を超えました/);
    expect(run).toThrow(/keywords_and/);
  });

  it('結果の欄がないHTML（検索フォームだけ、エラーページなど）はエラーにする', () => {
    expect(() => parseSearchResults('<html><body>Service Unavailable</body></html>', `${SEARCH1}?x=1`)).toThrow(
      /読み取れませんでした/,
    );
    // 検索フォームだけのページ（検索が実行されていない）
    expect(() => parseSearchResults(fixtureText('search-form.html'), `${SEARCH1}?x=1`)).toThrow(/読み取れませんでした/);
    // 「該当する裁判例がありませんでした」という文は、サイトの説明文の中にもある。結果の欄にない限り0件とみなさない
    const helpOnly =
      '<html><body><form name="hanrei-search"></form><p>「該当する裁判例がありませんでした。」と表示された場合には、その判決等は掲載されていないことになります。</p></body></html>';
    expect(() => parseSearchResults(helpOnly, `${SEARCH1}?x=1`)).toThrow(/読み取れませんでした/);
  });
});
