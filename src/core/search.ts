/**
 * 検索：検索条件からURLパラメータを組み立て、検索結果ページ（HTML）を解析する。
 *
 * 検索は GET で呼べる。例：
 *   /hanrei/search1/index.html?query1=安全配慮義務&offset=30&sort=1
 * 主なパラメータ（フォームの name）：
 *   query1（いずれかの語を含む）、query2（さらに含む語）、
 *   filter[judgeDateMode]（1=期日指定、2=期間指定）と filter[judgeGengoFrom] など、
 *   filter[jikenGengo] / [jikenYear] / [jikenCode] / [jikenNumber]（事件番号）、
 *   filter[courtName] / [branchName]、filter[jikenName]、courtCaseType、offset、sort
 */
import { parse, type HTMLElement } from 'node-html-parser';
import {
  CATEGORIES,
  DETAIL_TYPES,
  PAGE_SIZE,
  absoluteUrl,
  pdfUrl,
  searchPageUrl,
  type Category,
} from './site.js';
import { expandDate, isoToWareki, warekiToIso, EARLIEST_FORM_DATE } from './wareki.js';

export type SortOrder = 'date_desc' | 'date_asc' | 'court';

const SORT_VALUES: Record<SortOrder, string> = { date_desc: '1', date_asc: '2', court: '3' };

export interface SearchInput {
  /** 全文検索の語。スペース区切りで「いずれかを含む」 */
  keywords?: string;
  /** さらにこの語も含むものに絞る */
  keywordsAnd?: string;
  category?: Category;
  /** 裁判年月日の範囲（YYYY-MM-DD。YYYY や YYYY-MM も可） */
  dateFrom?: string;
  dateTo?: string;
  /** 事件番号。例：令和5年(ワ)第680号、平成25(ネ)2334 */
  caseNumber?: string;
  /** 裁判所名。例：東京地方裁判所 */
  courtName?: string;
  /** 支部名。例：立川支部 */
  branchName?: string;
  /** 事件名に含まれる語 */
  caseName?: string;
  sort?: SortOrder;
  /** 何件目から表示するか（0始まり） */
  offset?: number;
}

/** 事件符号（フォームの filter[jikenCode] の選択肢）。label は "(ワ)"、"刑(わ)" など */
export interface JikenCode {
  value: string;
  label: string;
}

export interface CaseCategoryLink {
  /** 詳細ページの種類（detail{N} の N） */
  detailType: number;
  label: string;
  url: string;
}

export interface SearchResultItem {
  id: number;
  caseNumber: string;
  caseName: string;
  /** サイトの表記（和暦） */
  date: string;
  /** 西暦（YYYY-MM-DD）。読み取れない場合は null */
  dateIso: string | null;
  court: string;
  /** 一覧に出ているその他の項目（支部、結果、原審、権利種別、争点など）。項目名はサイト上にない */
  notes: string[];
  categories: CaseCategoryLink[];
  pdfUrl: string;
}

export interface SearchResult {
  total: number;
  offset: number;
  items: SearchResultItem[];
  /** 続きがある場合の次の offset。なければ null */
  nextOffset: number | null;
  /** 実際に問い合わせたURL */
  url: string;
}

export interface ParsedCaseNumber {
  gengo?: string;
  year?: number;
  /** 符号（かっこを除いたもの）。例：ワ、行ウ、刑わ */
  code?: string;
  number?: number;
}

/** 事件番号の文字列を、元号・年・符号・番号に分ける */
export function parseCaseNumber(input: string): ParsedCaseNumber {
  const s = input.normalize('NFKC').replace(/\s+/g, '');
  const m = /^(?:(令和|平成|昭和)(元|\d+)年?)?(.*?)(?:第?(\d+)号?)?(?:等|ほか)?$/.exec(s);
  if (!m) throw new Error(`事件番号を読み取れません：${input}`);
  const result: ParsedCaseNumber = {};
  if (m[1]) {
    result.gengo = m[1];
    result.year = m[2] === '元' ? 1 : Number(m[2]);
  }
  const code = (m[3] ?? '').replace(/[()]/g, '');
  if (code) {
    if (/\d/.test(code)) throw new Error(`事件番号を読み取れません：${input}（例：令和5年(ワ)第680号）`);
    result.code = code;
  }
  if (m[4]) result.number = Number(m[4]);
  if (!result.gengo && !result.code && result.number === undefined) {
    throw new Error(`事件番号を読み取れません：${input}（例：令和5年(ワ)第680号）`);
  }
  return result;
}

function codeKey(label: string): string {
  return label.normalize('NFKC').replace(/[()\s]/g, '');
}

/** 符号（ワ、行ウ など）からフォームの値を引く */
export function findJikenCode(code: string, codes: JikenCode[]): JikenCode {
  const key = codeKey(code);
  const hit = codes.find((c) => codeKey(c.label) === key);
  if (!hit) {
    throw new Error(
      `事件符号「${code}」は検索フォームの選択肢にありません。ひらがな・カタカナの違いに注意してください（例：民事の地裁第一審は「ワ」、刑事は「わ」）。`,
    );
  }
  return hit;
}

/** 検索条件からURLパラメータを作る。事件符号を使う場合は codes（フォームの選択肢）が必要。 */
export function buildSearchParams(input: SearchInput, codes: JikenCode[] = []): URLSearchParams {
  const category = input.category ?? 'all';
  const def = CATEGORIES[category];
  if (!def) throw new Error(`category が不正です：${String(input.category)}`);
  const p = new URLSearchParams();

  if (def.courtCaseType) p.set('courtCaseType', def.courtCaseType);
  if (category === 'ip') p.set('view', 'main');

  const keywords = input.keywords?.trim();
  const keywordsAnd = input.keywordsAnd?.trim();
  if (keywords) p.set('query1', keywords);
  if (keywordsAnd) {
    // サイトの仕様では query2 は query1 の絞り込み。query1 がなければ query1 として送る。
    if (keywords) p.set('query2', keywordsAnd);
    else p.set('query1', keywordsAnd);
  }

  if (input.dateFrom || input.dateTo) {
    const fromIso = input.dateFrom ? expandDate(input.dateFrom, 'from') : EARLIEST_FORM_DATE;
    const toIso = input.dateTo ? expandDate(input.dateTo, 'to') : todayInJapan();
    if (fromIso > toIso) throw new Error(`date_from（${fromIso}）が date_to（${toIso}）より後になっています`);
    const from = isoToWareki(fromIso < EARLIEST_FORM_DATE ? EARLIEST_FORM_DATE : fromIso);
    const to = isoToWareki(toIso);
    p.set('filter[judgeDateMode]', '2');
    p.set('filter[judgeGengoFrom]', from.gengo);
    p.set('filter[judgeYearFrom]', String(from.year));
    p.set('filter[judgeMonthFrom]', String(from.month));
    p.set('filter[judgeDayFrom]', String(from.day));
    p.set('filter[judgeGengoTo]', to.gengo);
    p.set('filter[judgeYearTo]', String(to.year));
    p.set('filter[judgeMonthTo]', String(to.month));
    p.set('filter[judgeDayTo]', String(to.day));
  }

  if (input.caseNumber?.trim()) {
    const cn = parseCaseNumber(input.caseNumber);
    if (cn.gengo) p.set('filter[jikenGengo]', cn.gengo);
    if (cn.year !== undefined) p.set('filter[jikenYear]', String(cn.year));
    if (cn.code) p.set('filter[jikenCode]', findJikenCode(cn.code, codes).value);
    if (cn.number !== undefined) p.set('filter[jikenNumber]', String(cn.number));
  }

  if (input.courtName?.trim()) {
    if (!def.supportsCourtName) {
      throw new Error(`区分「${category}」では court_name で絞り込めません。category を all などにしてください。`);
    }
    p.set('filter[courtName]', input.courtName.trim());
  }
  if (input.branchName?.trim()) {
    if (!def.supportsCourtName) throw new Error(`区分「${category}」では branch_name で絞り込めません。`);
    p.set('filter[branchName]', input.branchName.trim());
  }
  if (input.caseName?.trim()) {
    if (!def.supportsCaseName) {
      const ok = (Object.keys(CATEGORIES) as Category[]).filter((c) => CATEGORIES[c].supportsCaseName);
      throw new Error(`case_name で絞り込めるのは category が ${ok.join(' / ')} のときだけです。`);
    }
    p.set('filter[jikenName]', input.caseName.trim());
  }

  const hasCondition = [...p.keys()].some((k) => k !== 'courtCaseType' && k !== 'view');
  if (!hasCondition) throw new Error('検索条件を少なくとも1つ指定してください。');

  const offset = input.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) throw new Error(`offset は0以上の整数で指定してください：${offset}`);
  p.set('offset', String(offset));
  p.set('sort', SORT_VALUES[input.sort ?? 'date_desc']);
  return p;
}

export function buildSearchUrl(input: SearchInput, codes: JikenCode[] = []): string {
  return `${searchPageUrl(input.category ?? 'all')}?${buildSearchParams(input, codes).toString()}`;
}

/** 事件符号を使う検索かどうか（使う場合はフォームの選択肢を先に取得する必要がある） */
export function needsJikenCodes(input: SearchInput): boolean {
  if (!input.caseNumber?.trim()) return false;
  return Boolean(parseCaseNumber(input.caseNumber).code);
}

function todayInJapan(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

/** 裁判所サイトが検索条件を受け付けず、エラーの表示を返した場合 */
export class SearchRejectedError extends Error {
  constructor(readonly siteMessages: string[]) {
    const overLimit = siteMessages.some((m) => m.includes('2000件を超え'));
    super(
      `裁判所サイトが検索を受け付けませんでした：「${siteMessages.join(' / ')}」` +
        (overLimit
          ? ' ── 全文検索（keywords）に該当する裁判例が全区分の合計で2,000件を超えると、サイトは結果を返しません。期間・裁判所・区分で絞っても解消しないので、より具体的な語に変えるか、keywords_and に語を追加して絞り込んでください。'
          : ''),
    );
    this.name = 'SearchRejectedError';
  }
}

function textLines(el: HTMLElement): string[] {
  return el.text
    .split('\n')
    .map((l) => l.replace(/[\s  ]+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

const DETAIL_HREF = /\/?(\d+)\/detail(\d+)\/index\.html/;

/** 検索結果ページのHTMLを解析する */
export function parseSearchResults(html: string, pageUrl: string): SearchResult {
  const root = parse(html);
  const offsetParam = Number(new URL(pageUrl).searchParams.get('offset') ?? '0') || 0;

  const items: SearchResultItem[] = [];
  for (const tr of root.querySelectorAll('tr')) {
    const links = tr.querySelectorAll('a').filter((a) => DETAIL_HREF.test(a.getAttribute('href') ?? ''));
    if (links.length === 0) continue;

    const categories: CaseCategoryLink[] = [];
    let id: number | null = null;
    for (const a of links) {
      const href = a.getAttribute('href') ?? '';
      const m = DETAIL_HREF.exec(href);
      if (!m) continue;
      id = Number(m[1]);
      const detailType = Number(m[2]);
      categories.push({
        detailType,
        label: a.text.trim() || DETAIL_TYPES[detailType] || `detail${detailType}`,
        url: absoluteUrl(href, pageUrl),
      });
    }
    if (id === null) continue;

    // 1つ目の<td>に、<p>ごとに「事件番号・事件名」「裁判年月日・裁判所・その他」…が1行ずつ入っている
    const cell = tr.querySelectorAll('td').find((td) => !td.querySelector('a[href*="hanrei-pdf-"]'));
    const blocks = (cell?.querySelectorAll('p') ?? []).map(textLines);
    const first = blocks[0] ?? [];
    const second = blocks[1] ?? [];
    const rest = blocks.slice(2).flat();

    const pdfHref = tr.querySelector('a[href*="hanrei-pdf-"]')?.getAttribute('href');
    const date = second[0] ?? '';
    items.push({
      id,
      caseNumber: first[0] ?? '',
      caseName: first.slice(1).join(' '),
      date,
      dateIso: warekiToIso(date),
      court: second[1] ?? '',
      notes: [...second.slice(2), ...rest],
      categories,
      pdfUrl: pdfHref ? absoluteUrl(pdfHref, pageUrl) : pdfUrl(id),
    });
  }

  const countMatch = /([\d,]+)\s*件中\s*([\d,]+)\s*[～〜~-]\s*([\d,]+)\s*件を表示/.exec(root.text);
  let total: number;
  let offset = offsetParam;
  if (countMatch) {
    total = Number(countMatch[1]!.replace(/,/g, ''));
    offset = Number(countMatch[2]!.replace(/,/g, '')) - 1;
  } else if (items.length > 0) {
    total = offset + items.length;
  } else {
    // 0件のとき、サイトは次の3通りのどれかを返す。取り違えると「該当なし」と誤って伝えてしまう。
    // 1. エラーの表示（全文検索の該当が2000件を超えた、条件の組み合わせが不正、など）
    const siteErrors = root
      .querySelectorAll('.errorMessage li')
      .map((li) => li.text.replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 0);
    if (siteErrors.length > 0) throw new SearchRejectedError(siteErrors);
    // 2. 「該当する裁判例がありませんでした。」（本当に0件）
    const noHit = root.querySelector('#searched')?.text.includes('該当する裁判例がありませんでした');
    // 3. 結果の欄がない（検索が実行されていない、またはサイトの構成が変わった）
    if (!noHit) {
      throw new Error(
        '検索結果を読み取れませんでした（結果の欄も「該当なし」の表示もありません）。サイトの構成が変わった可能性があります。',
      );
    }
    total = 0;
  }

  const next = offset + items.length;
  return {
    total,
    offset,
    items,
    nextOffset: items.length > 0 && next < total ? next : null,
    url: pageUrl,
  };
}

/** 検索フォームのHTMLから、事件符号の選択肢を取り出す */
export function parseJikenCodes(html: string): JikenCode[] {
  const root = parse(html);
  const select = root.querySelectorAll('select').find((s) => s.getAttribute('name') === 'filter[jikenCode]');
  if (!select) throw new Error('検索フォームに事件符号の選択欄が見つかりません。サイトの構成が変わった可能性があります。');
  const codes: JikenCode[] = [];
  for (const opt of select.querySelectorAll('option')) {
    const value = opt.getAttribute('value') ?? '';
    const label = opt.text.trim();
    if (value && label) codes.push({ value, label });
  }
  if (codes.length === 0) throw new Error('事件符号の選択肢が空です。サイトの構成が変わった可能性があります。');
  return codes;
}

export { PAGE_SIZE };
