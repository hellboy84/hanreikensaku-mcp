/**
 * 裁判所ウェブサイト「裁判例検索」のURLと区分の定義。
 * サイトの構成が変わったときは、このファイルと search.ts / detail.ts を直す。
 */

export const SITE_ORIGIN = 'https://www.courts.go.jp';

/** 検索の区分。サイトの検索画面のタブに対応する。 */
export type Category = 'all' | 'supreme' | 'high' | 'lower' | 'administrative' | 'labor' | 'ip';

export interface CategoryDef {
  /** 検索ページの番号（/hanrei/search{N}/index.html） */
  searchPage: number;
  /** フォームの隠し項目 courtCaseType の値。統合検索にはない。 */
  courtCaseType: string | null;
  label: string;
  /** 事件名（filter[jikenName]）で絞り込めるか */
  supportsCaseName: boolean;
  /** 裁判所名（filter[courtName]）で絞り込めるか */
  supportsCourtName: boolean;
}

export const CATEGORIES: Record<Category, CategoryDef> = {
  all: { searchPage: 1, courtCaseType: null, label: '統合検索（全区分）', supportsCaseName: false, supportsCourtName: true },
  supreme: { searchPage: 2, courtCaseType: '1', label: '最高裁判所判例集', supportsCaseName: true, supportsCourtName: false },
  high: { searchPage: 3, courtCaseType: '2', label: '高等裁判所判例集', supportsCaseName: true, supportsCourtName: true },
  lower: { searchPage: 4, courtCaseType: '3', label: '下級裁判所裁判例速報', supportsCaseName: false, supportsCourtName: true },
  administrative: { searchPage: 5, courtCaseType: '4', label: '行政事件裁判例集', supportsCaseName: true, supportsCourtName: true },
  labor: { searchPage: 6, courtCaseType: '5', label: '労働事件裁判例集', supportsCaseName: true, supportsCourtName: true },
  ip: { searchPage: 7, courtCaseType: '6 7', label: '知的財産裁判例集', supportsCaseName: false, supportsCourtName: true },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

/**
 * 詳細ページの種類（/hanrei/{ID}/detail{N}/index.html の N）。
 * N が合っていなくてもサイトは200を返し、その区分の書式で共通項目だけを表示する。
 * そのため正しい N は検索結果のリンクから知る。
 */
export const DETAIL_TYPES: Record<number, string> = {
  2: '最高裁判例',
  3: '高裁判例',
  4: '下級裁裁判例',
  5: '行政事件裁判例',
  6: '労働事件裁判例',
  7: '知的財産裁判例',
  8: '知財高裁裁判例',
};

export const DETAIL_TYPE_NUMBERS = Object.keys(DETAIL_TYPES).map(Number);

/** 検索結果1ページあたりの件数（サイト側で固定） */
export const PAGE_SIZE = 30;

export function searchPageUrl(category: Category): string {
  return `${SITE_ORIGIN}/hanrei/search${CATEGORIES[category].searchPage}/index.html`;
}

export function detailUrl(id: number, detailType: number): string {
  return `${SITE_ORIGIN}/hanrei/${id}/detail${detailType}/index.html`;
}

export function pdfUrl(id: number): string {
  return `${SITE_ORIGIN}/assets/hanrei/hanrei-pdf-${id}.pdf`;
}

/** ページ内の相対リンクを絶対URLにする */
export function absoluteUrl(href: string, pageUrl: string): string {
  return new URL(href, pageUrl).toString();
}
