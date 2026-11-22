/**
 * PDFから取り出した行を、読みやすい本文に整える。
 *
 * 1. ページ番号などの繰り返し部分を除く
 * 2. 文の途中の改行をつなぐ（日本語なのでスペースなしで連結）
 * 3. 全角の英数字を半角にそろえる
 * 4. 「主文」「事実及び理由」「第1」などの見出しで区切る
 *
 * 段落は、始まりのページ番号（元PDFのページ）を持つ。
 */
import type { PdfLine, PdfPage } from './pdf.js';

/** 整形の方法を変えたら上げる。キャッシュした本文を作り直すために使う。 */
export const TEXT_VERSION = 1;

export interface Paragraph {
  /** 段落が始まるページ（1始まり） */
  page: number;
  text: string;
}

export interface Section {
  /** 見出しの通し番号（1始まり）。get_full_text の section で指定する */
  index: number;
  title: string;
  /** 1：主文・理由・別紙など、2：第1・第2など */
  level: 1 | 2;
  /** この見出しに含まれる段落の範囲（終わりは含まない） */
  paragraphStart: number;
  paragraphEnd: number;
  pageFrom: number;
  pageTo: number;
  chars: number;
}

export interface JudgmentText {
  version: number;
  pageCount: number;
  charCount: number;
  /** 文字が取り出せなかったページ（図表・画像だけのページなど） */
  emptyPages: number[];
  paragraphs: Paragraph[];
  sections: Section[];
}

const PAGE_NUMBER_LINE = /^[-－‐—–―\s]*[0-9０-９]{1,4}[-－‐—–―\s]*$/;

/** 段落の始まりを示す記号（第1、1、(1)、ア、(ア)、a など）のあとに空白がある行 */
const ITEM_MARKER =
  /^(第[0-9０-９一二三四五六七八九十百]+|[0-9０-９]{1,3}|[一二三四五六七八九十]{1,3}|[(（][0-9０-９一二三四五六七八九十]{1,3}[)）]|[⑴-⒇]|[①-⑳]|[ア-ン]|[(（][ア-ンa-zａ-ｚ][)）]|[a-zａ-ｚ]|[ⅰ-ⅹ]+|[○◯])[ 　]/;

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!;
}

/** 全角の英数字を半角にし、空白をそろえる */
export function normalizeText(text: string): string {
  let s = text.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  s = s.replace(/[　 \t]/g, ' ').replace(/ {2,}/g, ' ').trim();
  // 数字の間の全角ピリオドは小数点なので半角にする（14．6 → 14.6）。読点と紛れる「，」は変えない
  s = s.replace(/(\d)．(?=\d)/g, '$1.');
  // 「主 文」「理 由」のように1文字ずつ空けた見出しは詰める
  if (s.length <= 24 && /^(\S )+\S$/.test(s) && !/[0-9A-Za-z]/.test(s)) s = s.replace(/ /g, '');
  return s;
}

/**
 * 均等割り付けの行は「と の 確 認 を 求 め」のように1文字ごとに空白が入って取り出されることがある。
 * ほとんどが1文字ずつに分かれている行は、空白を取り除く。
 */
export function removeLetterSpacing(text: string): string {
  const tokens = text.split(' ').filter((t) => t.length > 0);
  if (tokens.length < 2) return text;
  const single = tokens.filter((t) => t.length === 1).length;
  if (tokens.every((t) => t.length === 1) && !/[0-9０-９A-Za-z]/.test(text)) return tokens.join('');
  if (tokens.length >= 8 && single / tokens.length >= 0.8) return tokens.join('');
  return text;
}

const TOP_HEADINGS = /^(主文|理由|事実|事実及び理由|事実および理由|理由の要旨|判決|決定|命令|審判)$/;

/** 見出しかどうかを比べるための形にする（空白と、昔の判決で見出しの頭に付く「○」を除く） */
function headingKey(text: string): string {
  return text.replace(/[ 　]/g, '').replace(/^[○◯]/, '');
}

function isPageNumberLine(line: PdfLine, page: PdfPage): boolean {
  if (!PAGE_NUMBER_LINE.test(line.text)) return false;
  return line.y < page.height * 0.1 || line.y > page.height * 0.92;
}

/** 行をつないで段落にする */
export function buildParagraphs(pages: PdfPage[]): { paragraphs: Paragraph[]; emptyPages: number[] } {
  const bodyPages = pages.map((p) => ({
    page: p,
    lines: p.lines
      .filter((l) => l.text.length > 0 && !isPageNumberLine(l, p))
      .map((l) => ({ ...l, text: removeLetterSpacing(l.text) })),
  }));

  // 本文の右端（多くの行が届く位置）。ここまで届いている行は、次の行に文が続いているとみなす。
  const rights = bodyPages.flatMap((b) => b.lines.filter((l) => l.text.length >= 15).map((l) => l.right));
  const rightEdge = quantile(rights, 0.9);

  // 行送り（行と行の間隔）の標準
  const pitches: number[] = [];
  for (const b of bodyPages) {
    for (let i = 1; i < b.lines.length; i++) {
      const d = b.lines[i - 1]!.y - b.lines[i]!.y;
      if (d > 0) pitches.push(d);
    }
  }
  const pitch = quantile(pitches, 0.5) || 0;

  const paragraphs: Paragraph[] = [];
  const emptyPages: number[] = [];
  let current: { page: number; text: string; lineCount: number; firstLeft: number } | null = null;
  let prev: PdfLine | null = null;
  let prevPage = 0;

  // 主文の部分は本文より幅を狭くして組まれることが多く、右端の位置では文の続きを判断できない。
  // 主文の中では「。」で終わっていない行は次の行に続くとみなす。
  let inMainText = false;

  const flush = () => {
    if (current) {
      const text = normalizeText(current.text);
      if (text) paragraphs.push({ page: current.page, text });
      const compact = headingKey(text);
      if (TOP_HEADINGS.test(compact)) inMainText = compact === '主文';
    }
    current = null;
  };

  for (const { page, lines } of bodyPages) {
    if (lines.length === 0) {
      emptyPages.push(page.number);
      continue;
    }
    for (const line of lines) {
      let join = false;
      if (current && prev) {
        const size = prev.size || 10;
        const prevIsFull = rights.length >= 5 && prev.right >= rightEdge - size * 1.6;
        const samePage = prevPage === page.number;
        const bigGap = samePage && pitch > 0 && prev.y - line.y > pitch * 1.7;
        const startsItem = ITEM_MARKER.test(line.text);
        // 2行目以降より字下げされた行は、新しい段落の1行目
        const indented = current.lineCount >= 2 && line.left > prev.left + size * 0.8;
        join = prevIsFull && !bigGap && !startsItem && !indented;

        const lineIsHeading = TOP_HEADINGS.test(headingKey(line.text));
        const currentIsHeading = TOP_HEADINGS.test(headingKey(current.text));
        if (lineIsHeading || currentIsHeading) {
          join = false;
        } else if (!join && inMainText && !bigGap && !startsItem) {
          // 主文の中の折り返し：「。」で終わっていない長めの行で、次の行が同じ項目の位置にある
          // （日付や裁判官名のように、離れた位置から始まる短い行はつながない）
          const sameBlock = line.left >= current.firstLeft - size * 0.5 && line.left <= current.firstLeft + size * 2.6;
          join = sameBlock && prev.text.length >= 12 && !/[。．]$/.test(prev.text);
        }
      }
      if (join && current) {
        const needsSpace = /[A-Za-z0-9,.;:)]$/.test(current.text) && /^[A-Za-z0-9(]/.test(line.text);
        current.text += (needsSpace ? ' ' : '') + line.text;
        current.lineCount += 1;
      } else {
        flush();
        current = { page: page.number, text: line.text, lineCount: 1, firstLeft: line.left };
      }
      prev = line;
      prevPage = page.number;
    }
  }
  flush();
  return { paragraphs, emptyPages };
}

const OPINION_HEADING = /^裁判官(.{1,150}?)の((?:.{1,20}に対する)?(?:共同|追加)*(?:補足意見|反対意見|少数意見|意見))は[、，,]?次のとおりである/;
const NUMBERED_HEADING = /^第[0-9一二三四五六七八九十百]+( |$)/;
const APPENDIX_HEADING = /^[(（]?(別紙|別表|別添|別記)/;

function headingOf(p: Paragraph): { title: string; level: 1 | 2 } | null {
  const t = p.text;
  const compact = headingKey(t);
  if (TOP_HEADINGS.test(compact)) return { title: compact, level: 1 };
  const op = OPINION_HEADING.exec(compact);
  if (op) {
    const names = op[1]!.length > 40 ? `${op[1]!.split(/[、，,]/)[0]}ほか` : op[1]!;
    return { title: `裁判官${names}の${op[2]}`, level: 1 };
  }
  if (t.length <= 60 && !/[。、，]$/.test(t)) {
    if (NUMBERED_HEADING.test(t)) return { title: t, level: 2 };
    if (t.length <= 40 && APPENDIX_HEADING.test(t)) return { title: t, level: 1 };
  }
  return null;
}

/** 見出しで区切る */
export function buildSections(paragraphs: Paragraph[], pageCount: number): Section[] {
  const starts: Array<{ title: string; level: 1 | 2; at: number }> = [];
  paragraphs.forEach((p, i) => {
    const h = headingOf(p);
    if (h) starts.push({ ...h, at: i });
  });
  if (paragraphs.length > 0 && (starts.length === 0 || starts[0]!.at > 0)) {
    starts.unshift({ title: '冒頭', level: 1, at: 0 });
  }

  return starts.map((s, n) => {
    // 同じか上の階層の見出しが次に出るところまでを、この見出しの範囲とする
    let end = paragraphs.length;
    for (let k = n + 1; k < starts.length; k++) {
      if (starts[k]!.level <= s.level) {
        end = starts[k]!.at;
        break;
      }
    }
    const slice = paragraphs.slice(s.at, end);
    const nextPage = paragraphs[end]?.page;
    return {
      index: n + 1,
      title: s.title,
      level: s.level,
      paragraphStart: s.at,
      paragraphEnd: end,
      pageFrom: slice[0]?.page ?? 1,
      pageTo: nextPage ?? pageCount,
      chars: slice.reduce((a, p) => a + p.text.length, 0),
    };
  });
}

export function buildJudgmentText(pages: PdfPage[]): JudgmentText {
  const { paragraphs, emptyPages } = buildParagraphs(pages);
  return {
    version: TEXT_VERSION,
    pageCount: pages.length,
    charCount: paragraphs.reduce((a, p) => a + p.text.length, 0),
    emptyPages,
    paragraphs,
    sections: buildSections(paragraphs, pages.length),
  };
}

export interface RenderOptions {
  pageFrom?: number;
  pageTo?: number;
  /** 見出しの通し番号（Section.index） */
  section?: number;
  /** 返す文字数の上限。超える場合はページの区切りで打ち切る */
  maxChars: number;
}

export interface RenderResult {
  text: string;
  /** 実際に返した範囲（段落の始まりのページ） */
  pageFrom: number;
  pageTo: number;
  chars: number;
  truncated: boolean;
  /** 打ち切った場合、続きを取得するための page_from */
  nextPageFrom: number | null;
  /** 続きを取得するときの page_to（見出しを指定していた場合は、その見出しの最後のページ） */
  rangeEnd: number;
  section: Section | null;
}

/** ページ範囲または見出しを指定して、本文を文字列にする。ページの変わり目に【N頁】を入れる。 */
export function renderText(doc: JudgmentText, options: RenderOptions): RenderResult {
  let section: Section | null = null;
  let selected: Paragraph[];
  let rangeFrom: number;
  let rangeTo: number;

  if (options.section !== undefined) {
    section = doc.sections.find((s) => s.index === options.section) ?? null;
    if (!section) {
      throw new Error(`section ${options.section} はありません。見出しの番号は 1〜${doc.sections.length} です。`);
    }
    selected = doc.paragraphs.slice(section.paragraphStart, section.paragraphEnd);
    rangeFrom = section.pageFrom;
    rangeTo = section.pageTo;
    if (options.pageFrom !== undefined || options.pageTo !== undefined) {
      rangeFrom = Math.max(rangeFrom, options.pageFrom ?? rangeFrom);
      rangeTo = Math.min(rangeTo, options.pageTo ?? rangeTo);
      selected = selected.filter((p) => p.page >= rangeFrom && p.page <= rangeTo);
    }
  } else {
    rangeFrom = options.pageFrom ?? 1;
    rangeTo = options.pageTo ?? doc.pageCount;
    if (rangeFrom < 1 || rangeTo > doc.pageCount || rangeFrom > rangeTo) {
      throw new Error(`ページ範囲が不正です：${rangeFrom}〜${rangeTo}（全${doc.pageCount}ページ）`);
    }
    selected = doc.paragraphs.filter((p) => p.page >= rangeFrom && p.page <= rangeTo);
  }

  const empty = new Set(doc.emptyPages);
  const out: string[] = [];
  let chars = 0;
  let lastPage = 0;
  let truncated = false;
  let nextPageFrom: number | null = null;

  // ページごとにまとめ、上限を超えるページの手前で打ち切る（少なくとも1ページは返す）
  const byPage = new Map<number, Paragraph[]>();
  for (const p of selected) {
    const list = byPage.get(p.page);
    if (list) list.push(p);
    else byPage.set(p.page, [p]);
  }
  const pageNumbers = new Set<number>(byPage.keys());
  if (section === null) {
    for (let n = rangeFrom; n <= rangeTo; n++) if (empty.has(n)) pageNumbers.add(n);
  }

  for (const n of [...pageNumbers].sort((a, b) => a - b)) {
    const paras = byPage.get(n) ?? [];
    const pageChars = paras.reduce((a, p) => a + p.text.length, 0);
    if (lastPage !== 0 && chars + pageChars > options.maxChars) {
      truncated = true;
      nextPageFrom = n;
      break;
    }
    if (paras.length === 0) {
      out.push(`【${n}頁】（このページからは文字を取り出せませんでした。図表・画像の可能性があります）`);
    } else {
      out.push(`【${n}頁】`);
      for (const p of paras) out.push(p.text);
    }
    chars += pageChars;
    lastPage = n;
  }

  return {
    text: out.join('\n'),
    pageFrom: pageNumbers.size > 0 ? Math.min(...pageNumbers) : rangeFrom,
    pageTo: lastPage || rangeFrom,
    chars,
    truncated,
    nextPageFrom,
    rangeEnd: rangeTo,
    section,
  };
}
