/**
 * 裁判所サイトへのアクセス。サイトに負担をかけないよう、
 * - 1回ごとに間隔を空ける（既定3秒。同時には1件だけ）
 * - User-Agent にリポジトリのURLを入れる
 * - 裁判所サイト以外にはアクセスしない
 */
import { SITE_ORIGIN } from './site.js';

export const DEFAULT_USER_AGENT = 'hanreikensaku-mcp/0.1 (+https://github.com/hellboy84/hanreikensaku-mcp)';
export const DEFAULT_MIN_INTERVAL_MS = 3000;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`裁判所サイトが ${status} を返しました：${url}`);
    this.name = 'HttpError';
  }
}

export interface HttpClient {
  getText(url: string): Promise<string>;
  getBytes(url: string): Promise<Uint8Array>;
}

export interface PoliteHttpClientOptions {
  fetch?: typeof fetch;
  userAgent?: string;
  /** リクエストとリクエストの間隔（ミリ秒） */
  minIntervalMs?: number;
  timeoutMs?: number;
  /** 一時的な失敗（通信エラー、429、5xx）のときに、やり直す回数 */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class PoliteHttpClient implements HttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private lastFinishedAt = 0;

  constructor(options: PoliteHttpClientOptions = {}) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.retries = options.retries ?? 2;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async getText(url: string): Promise<string> {
    return this.request(url, (res) => res.text());
  }

  async getBytes(url: string): Promise<Uint8Array> {
    return this.request(url, async (res) => new Uint8Array(await res.arrayBuffer()));
  }

  /** 順番待ちに入れて、前のリクエストが終わってから間隔を空けて実行する */
  private request<T>(url: string, read: (res: Response) => Promise<T>): Promise<T> {
    if (new URL(url).origin !== SITE_ORIGIN) {
      return Promise.reject(new Error(`裁判所サイト以外にはアクセスしません：${url}`));
    }
    const run = this.queue.then(() => this.requestWithRetry(url, read));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async requestWithRetry<T>(url: string, read: (res: Response) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await this.sleep(5000 * attempt);
      const wait = this.lastFinishedAt + this.minIntervalMs - Date.now();
      if (wait > 0) await this.sleep(wait);
      try {
        const res = await this.fetchImpl(url, {
          headers: { 'User-Agent': this.userAgent, Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8' },
          redirect: 'follow',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (res.ok) return await read(res);
        await res.body?.cancel().catch(() => undefined);
        const error = new HttpError(res.status, url);
        // 404 などは、やり直しても変わらない
        if (res.status !== 429 && res.status < 500) throw error;
        lastError = error;
      } catch (e) {
        if (e instanceof HttpError && e.status !== 429 && e.status < 500) throw e;
        lastError = e;
      } finally {
        // 間隔は、前のリクエストが終わった時点から数える
        this.lastFinishedAt = Date.now();
      }
    }
    if (lastError instanceof HttpError) throw lastError;
    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`裁判所サイトに接続できませんでした（${reason}）：${url}`);
  }
}
