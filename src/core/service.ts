/**
 * 検索・詳細・本文の取得をまとめる層。サイトへのアクセスとキャッシュをここで組み合わせる。
 * ローカル（stdio）でもリモート（Workers）でも同じものを使う。
 */
import type { CacheStore } from '../storage/types.js';
import { parseDetailPage, type CaseAttachment, type CaseDetail, type CaseField } from './detail.js';
import { HttpError, type HttpClient } from './http.js';
import { extractPdfPages, type CMapLoader } from './pdf.js';
import {
  buildSearchUrl,
  needsJikenCodes,
  parseJikenCodes,
  parseSearchResults,
  type CaseCategoryLink,
  type JikenCode,
  type SearchInput,
  type SearchResult,
} from './search.js';
import { DETAIL_TYPES, detailUrl, pdfUrl, searchPageUrl } from './site.js';
import { TEXT_VERSION, buildJudgmentText, type JudgmentText } from './text.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface ServiceOptions {
  http: HttpClient;
  cache: CacheStore;
  cmapLoader?: CMapLoader;
  /** 検索結果をキャッシュする時間。新しい裁判例が日々追加されるので短めにする */
  searchTtlMs?: number;
  /** 詳細ページをキャッシュする時間。判例集の登載情報などが後から追記されることがある */
  detailTtlMs?: number;
  /** 検索フォームの選択肢（事件符号）をキャッシュする時間 */
  formTtlMs?: number;
  now?: () => number;
}

export interface CaseInfo {
  id: number;
  caseNumber: string;
  caseName: string;
  date: string;
  dateIso: string | null;
  court: string;
  fields: CaseField[];
  /** この裁判例が載っている区分の詳細ページ */
  detailPages: CaseCategoryLink[];
  /**
   * 区分が確かかどうか。検索結果から分かった場合と利用者が指定した場合は true。
   * IDだけから推定した場合は false（サイトは区分が違っていても詳細ページを返すため）。
   */
  categoryConfirmed: boolean;
  pdfUrl: string;
  attachments: CaseAttachment[];
}

/** キャッシュに保存するデータの形を変えたら上げる（古い形のデータを読まないようにする） */
const SCHEMA = 'v1';

interface IndexEntry {
  detailTypes: number[];
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function assertId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) throw new Error(`ID は正の整数で指定してください：${id}`);
}

export class HanreiService {
  private readonly http: HttpClient;
  private readonly cache: CacheStore;
  private readonly cmapLoader?: CMapLoader;
  private readonly searchTtlMs: number;
  private readonly detailTtlMs: number;
  private readonly formTtlMs: number;
  private readonly now: () => number;

  constructor(options: ServiceOptions) {
    this.http = options.http;
    this.cache = options.cache;
    this.cmapLoader = options.cmapLoader;
    this.searchTtlMs = options.searchTtlMs ?? 6 * HOUR;
    this.detailTtlMs = options.detailTtlMs ?? 30 * DAY;
    this.formTtlMs = options.formTtlMs ?? 30 * DAY;
    this.now = options.now ?? Date.now;
  }

  private async cachedJson<T>(key: string, ttlMs: number | null): Promise<T | null> {
    const entry = await this.cache.getText(key);
    if (!entry) return null;
    if (ttlMs !== null && this.now() - entry.storedAt > ttlMs) return null;
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  /** 検索フォームの事件符号の選択肢（(ワ)、(行ウ) など） */
  async getJikenCodes(): Promise<JikenCode[]> {
    const key = `${SCHEMA}/meta/jiken-codes.json`;
    const cached = await this.cachedJson<JikenCode[]>(key, this.formTtlMs);
    if (cached && cached.length > 0) return cached;
    const html = await this.http.getText(searchPageUrl('all'));
    const codes = parseJikenCodes(html);
    await this.cache.setText(key, JSON.stringify(codes));
    return codes;
  }

  async search(input: SearchInput): Promise<SearchResult> {
    const codes = needsJikenCodes(input) ? await this.getJikenCodes() : [];
    const url = buildSearchUrl(input, codes);
    const key = `${SCHEMA}/search/${await sha256Hex(url)}.json`;

    const cached = await this.cachedJson<SearchResult>(key, this.searchTtlMs);
    if (cached) return cached;

    const html = await this.http.getText(url);
    const result = parseSearchResults(html, url);
    await this.cache.setText(key, JSON.stringify(result));
    // 検索結果から分かった「IDと区分の対応」を覚えておく（get_case で使う）
    await Promise.all(
      result.items.map((item) =>
        this.rememberDetailTypes(
          item.id,
          item.categories.map((c) => c.detailType),
        ),
      ),
    );
    return result;
  }

  private indexKey(id: number): string {
    return `${SCHEMA}/index/${id}.json`;
  }

  private async rememberDetailTypes(id: number, detailTypes: number[]): Promise<void> {
    if (detailTypes.length === 0) return;
    const key = this.indexKey(id);
    const known = (await this.cachedJson<IndexEntry>(key, null))?.detailTypes ?? [];
    const merged = [...new Set([...known, ...detailTypes])].sort((a, b) => a - b);
    if (merged.length === known.length) return;
    await this.cache.setText(key, JSON.stringify({ detailTypes: merged } satisfies IndexEntry));
  }

  private async getDetailPage(id: number, detailType: number): Promise<CaseDetail> {
    const key = `${SCHEMA}/detail/${id}-${detailType}.json`;
    const cached = await this.cachedJson<CaseDetail>(key, this.detailTtlMs);
    if (cached) return cached;
    const url = detailUrl(id, detailType);
    let html: string;
    try {
      html = await this.http.getText(url);
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) {
        throw new Error(`ID ${id} の裁判例は見つかりませんでした（詳細ページが404）。`);
      }
      throw e;
    }
    const detail = parseDetailPage(html, url);
    await this.cache.setText(key, JSON.stringify(detail));
    return detail;
  }

  /**
   * IDを指定してメタデータを取得する。
   * detailType を省略した場合は、過去の検索結果で分かっている区分を使う。
   * 分かっていなければ、下級裁の書式（detail4）で取得し、裁判所名から区分を推定する。
   */
  async getCase(id: number, detailType?: number): Promise<CaseInfo> {
    assertId(id);
    if (detailType !== undefined && !(detailType in DETAIL_TYPES)) {
      throw new Error(`detail_type は ${Object.keys(DETAIL_TYPES).join('、')} のいずれかで指定してください。`);
    }

    let types: number[];
    let confirmed = true;
    if (detailType !== undefined) {
      types = [detailType];
    } else {
      const known = (await this.cachedJson<IndexEntry>(this.indexKey(id), null))?.detailTypes ?? [];
      if (known.length > 0) {
        types = known;
      } else {
        confirmed = false;
        types = [4];
      }
    }

    let pages: CaseDetail[] = [];
    for (const t of types) pages.push(await this.getDetailPage(id, t));

    if (!confirmed) {
      // 最高裁・知財高裁の裁判例は、その区分の書式のほうが項目が多い（判示事項、裁判要旨、当事者など）
      const court = pages[0]!.court;
      const guess = court.startsWith('最高裁判所') ? 2 : court.startsWith('知的財産高等裁判所') ? 8 : null;
      if (guess !== null) pages = [await this.getDetailPage(id, guess)];
    }

    const first = pages[0]!;
    const fields: CaseField[] = [];
    const attachments: CaseAttachment[] = [];
    for (const page of pages) {
      for (const f of page.fields) {
        if (!fields.some((x) => x.label === f.label && x.value === f.value)) fields.push(f);
      }
      for (const a of page.attachments) {
        if (!attachments.some((x) => x.url === a.url)) attachments.push(a);
      }
    }

    return {
      id,
      caseNumber: first.caseNumber,
      caseName: first.caseName,
      date: first.date,
      dateIso: first.dateIso,
      court: first.court,
      fields,
      detailPages: pages.map((p) => ({ detailType: p.detailType, label: p.detailTypeLabel, url: p.url })),
      categoryConfirmed: confirmed,
      pdfUrl: first.pdfUrl,
      attachments,
    };
  }

  /** 全文PDFを取得し、整形した本文を返す。一度処理したものはキャッシュから返す。 */
  async getFullText(id: number): Promise<JudgmentText> {
    assertId(id);
    const textKey = `text/${id}.v${TEXT_VERSION}.json`;
    const cached = await this.cachedJson<JudgmentText>(textKey, null);
    if (cached && cached.version === TEXT_VERSION) return cached;

    const pdfKey = `pdf/${id}.pdf`;
    let bytes = (await this.cache.getBytes(pdfKey))?.value ?? null;
    if (!bytes) {
      try {
        bytes = await this.http.getBytes(pdfUrl(id));
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) {
          throw new Error(`ID ${id} の全文PDFは見つかりませんでした（404）。`);
        }
        throw e;
      }
      if (new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).indexOf('%PDF-') === -1) {
        throw new Error(`ID ${id} の全文として取得したファイルがPDFではありませんでした。`);
      }
      await this.cache.setBytes(pdfKey, bytes);
    }

    const pages = await extractPdfPages(bytes, this.cmapLoader);
    const doc = buildJudgmentText(pages);
    await this.cache.setText(textKey, JSON.stringify(doc));
    return doc;
  }
}
