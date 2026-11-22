import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpError, PoliteHttpClient, type HttpClient } from '../src/core/http.js';
import { HanreiService } from '../src/core/service.js';
import { FileCacheStore } from '../src/storage/file.js';
import { MemoryCacheStore } from '../src/storage/memory.js';
import { cmapLoader, fixtureBytes, fixtureText } from './helpers.js';

/** 保存したHTML・PDFを返す、偽の裁判所サイト */
class FakeSite implements HttpClient {
  readonly requests: string[] = [];
  private readonly routes: Array<[RegExp, () => string | Uint8Array]> = [
    [/\/hanrei\/search1\/index\.html$/, () => fixtureText('search-none.html')],
    [/\/hanrei\/search1\/index\.html\?.*query1=/, () => fixtureText('search-all-keyword.html')],
    [/\/hanrei\/search1\/index\.html\?/, () => fixtureText('search-none.html')],
    [/\/hanrei\/97313\/detail2\//, () => fixtureText('detail-97313-2.html')],
    // 区分が違っていても、サイトは共通項目だけのページを返す。その再現として下級裁の書式を返す
    [/\/hanrei\/97313\/detail4\//, () => fixtureText('detail-97124-4.html').replaceAll('鹿児島地方裁判所', '最高裁判所大法廷')],
    [/\/hanrei\/97124\/detail4\//, () => fixtureText('detail-97124-4.html')],
    [/\/hanrei\/94346\/detail[45]\//, () => fixtureText('detail-94346-5.html')],
    [/hanrei-pdf-57453\.pdf$/, () => fixtureBytes('hanrei-pdf-57453.pdf')],
    [/hanrei-pdf-1\.pdf$/, () => new TextEncoder().encode('<!DOCTYPE html><html>not a pdf</html>')],
  ];

  private respond(url: string): string | Uint8Array {
    this.requests.push(url);
    const route = this.routes.find(([pattern]) => pattern.test(url));
    if (!route) throw new HttpError(404, url);
    return route[1]();
  }

  async getText(url: string): Promise<string> {
    return this.respond(url) as string;
  }

  async getBytes(url: string): Promise<Uint8Array> {
    return this.respond(url) as Uint8Array;
  }
}

describe('HanreiService', () => {
  let site: FakeSite;
  let now: number;
  let service: HanreiService;

  beforeEach(() => {
    site = new FakeSite();
    now = Date.parse('2026-11-22T00:00:00Z');
    service = new HanreiService({
      http: site,
      cache: new MemoryCacheStore(() => now),
      cmapLoader,
      now: () => now,
    });
  });

  it('検索結果をキャッシュし、期限が切れたら取り直す', async () => {
    const first = await service.search({ keywords: '安全配慮義務 過労死' });
    expect(first.total).toBe(519);
    expect(site.requests).toHaveLength(1);

    await service.search({ keywords: '安全配慮義務 過労死' });
    expect(site.requests).toHaveLength(1);

    await service.search({ keywords: '安全配慮義務 過労死', offset: 30 });
    expect(site.requests).toHaveLength(2);

    now += 7 * 60 * 60 * 1000;
    await service.search({ keywords: '安全配慮義務 過労死' });
    expect(site.requests).toHaveLength(3);
  });

  it('事件番号で検索するときは、先にフォームから事件符号を取得する（2回目以降はキャッシュ）', async () => {
    const r = await service.search({ caseNumber: '令和5年(ワ)第680号' });
    expect(r.total).toBe(0);
    expect(site.requests).toHaveLength(2);
    expect(site.requests[0]).toBe('https://www.courts.go.jp/hanrei/search1/index.html');
    expect(new URL(site.requests[1]!).searchParams.get('filter[jikenCode]')).toBe('64');

    await service.search({ caseNumber: '令和5年(ワ)第681号' });
    expect(site.requests).toHaveLength(3);
  });

  it('検索で分かった区分を覚えておき、get_case で全区分の項目をまとめて返す', async () => {
    await service.search({ keywords: '安全配慮義務 過労死' });
    const info = await service.getCase(94346);
    expect(info.categoryConfirmed).toBe(true);
    expect(info.detailPages.map((p) => p.detailType)).toEqual([4, 5]);
    expect(info.fields.find((f) => f.label === '分野')?.value).toBe('行政');
    expect(info.attachments).toHaveLength(2);
    // 同じ項目が重複しない
    expect(info.fields.filter((f) => f.label === '事件名')).toHaveLength(1);

    const before = site.requests.length;
    await service.getCase(94346);
    expect(site.requests).toHaveLength(before);
  });

  it('区分が分からないIDは、裁判所名から推定する（最高裁なら detail2 も取得）', async () => {
    const info = await service.getCase(97313);
    expect(info.categoryConfirmed).toBe(false);
    expect(site.requests.map((u) => /detail(\d)/.exec(u)?.[1])).toEqual(['4', '2']);
    expect(info.detailPages.map((p) => p.detailType)).toEqual([2]);
    expect(info.fields.map((f) => f.label)).not.toContain('裁判所名・部');
    expect(info.court).toBe('最高裁判所大法廷');
    expect(info.fields.map((f) => f.label)).toContain('判示事項');
  });

  it('区分が分からない下級裁のIDは、detail4 だけ取得する', async () => {
    const info = await service.getCase(97124);
    expect(info.categoryConfirmed).toBe(false);
    expect(site.requests).toHaveLength(1);
    expect(info.detailPages.map((p) => p.detailType)).toEqual([4]);
  });

  it('detail_type を指定した場合はその区分だけ取得する', async () => {
    const info = await service.getCase(94346, 5);
    expect(info.categoryConfirmed).toBe(true);
    expect(site.requests).toHaveLength(1);
    await expect(service.getCase(94346, 9)).rejects.toThrow(/detail_type/);
  });

  it('存在しないIDは分かりやすいエラーにする', async () => {
    await expect(service.getCase(12345678)).rejects.toThrow(/見つかりませんでした/);
    await expect(service.getFullText(12345678)).rejects.toThrow(/全文PDFは見つかりませんでした/);
    await expect(service.getCase(-1)).rejects.toThrow(/正の整数/);
  });

  it('本文は一度処理したらキャッシュから返す', async () => {
    const doc = await service.getFullText(57453);
    expect(doc.paragraphs[1]?.text).toBe('本件上告を棄却する。');
    expect(site.requests).toHaveLength(1);
    const again = await service.getFullText(57453);
    expect(again).toEqual(doc);
    expect(site.requests).toHaveLength(1);
  });

  it('PDFでないものが返ってきたらエラーにし、キャッシュしない', async () => {
    await expect(service.getFullText(1)).rejects.toThrow(/PDFではありません/);
    await expect(service.getFullText(1)).rejects.toThrow(/PDFではありません/);
    expect(site.requests).toHaveLength(2);
  });
});

describe('FileCacheStore', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hanrei-test-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('文字列とバイト列を保存して読み出せる', async () => {
    const store = new FileCacheStore(dir);
    expect(await store.getText('detail/1-4.json')).toBeNull();
    await store.setText('detail/1-4.json', '{"a":1}');
    const entry = await store.getText('detail/1-4.json');
    expect(entry?.value).toBe('{"a":1}');
    expect(Math.abs(Date.now() - (entry?.storedAt ?? 0))).toBeLessThan(60_000);

    await store.setBytes('pdf/1.pdf', new Uint8Array([37, 80, 68, 70]));
    expect([...((await store.getBytes('pdf/1.pdf'))?.value ?? [])]).toEqual([37, 80, 68, 70]);
  });

  it('保存先の外に出るキーは受け付けない', async () => {
    const store = new FileCacheStore(dir);
    await expect(store.setText('../outside.txt', 'x')).rejects.toThrow(/キーが不正/);
    await expect(store.getText('/etc/passwd')).rejects.toThrow(/キーが不正/);
    await expect(store.getText('a/../../b')).rejects.toThrow(/キーが不正/);
  });
});

describe('PoliteHttpClient', () => {
  function fakeFetch(statuses: number[]) {
    const calls: Array<{ url: string; userAgent: string | null }> = [];
    const impl = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      calls.push({ url: String(input), userAgent: new Headers(init?.headers).get('User-Agent') });
      const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]!;
      return new Response(status === 200 ? 'ok' : 'error', { status });
    }) as typeof fetch;
    return { calls, impl };
  }

  it('間隔を空け、User-Agentにリポジトリを入れる', async () => {
    const { calls, impl } = fakeFetch([200]);
    const waits: number[] = [];
    const client = new PoliteHttpClient({
      fetch: impl,
      minIntervalMs: 3000,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    const url = 'https://www.courts.go.jp/hanrei/search1/index.html';
    await Promise.all([client.getText(url), client.getText(url), client.getText(url)]);
    expect(calls).toHaveLength(3);
    expect(calls[0]?.userAgent).toMatch(/hanreikensaku-mcp.+github\.com\/hellboy84\/hanreikensaku-mcp/);
    // 2回目・3回目の前に、3秒近く待っている
    expect(waits).toHaveLength(2);
    for (const w of waits) expect(w).toBeGreaterThan(2500);
  });

  it('裁判所サイト以外にはアクセスしない', async () => {
    const { calls, impl } = fakeFetch([200]);
    const client = new PoliteHttpClient({ fetch: impl, minIntervalMs: 0 });
    await expect(client.getText('https://example.com/')).rejects.toThrow(/裁判所サイト以外/);
    await expect(client.getText('https://www.courts.go.jp.example.com/hanrei/')).rejects.toThrow(/裁判所サイト以外/);
    expect(calls).toHaveLength(0);
  });

  it('404はやり直さず、5xxはやり直す', async () => {
    const notFound = fakeFetch([404]);
    const c1 = new PoliteHttpClient({ fetch: notFound.impl, minIntervalMs: 0, sleep: async () => {} });
    await expect(c1.getText('https://www.courts.go.jp/hanrei/1/detail4/index.html')).rejects.toMatchObject({ status: 404 });
    expect(notFound.calls).toHaveLength(1);

    const flaky = fakeFetch([503, 200]);
    const c2 = new PoliteHttpClient({ fetch: flaky.impl, minIntervalMs: 0, sleep: async () => {} });
    await expect(c2.getText('https://www.courts.go.jp/hanrei/search1/index.html')).resolves.toBe('ok');
    expect(flaky.calls).toHaveLength(2);

    const down = fakeFetch([503]);
    const c3 = new PoliteHttpClient({ fetch: down.impl, minIntervalMs: 0, retries: 1, sleep: async () => {} });
    await expect(c3.getText('https://www.courts.go.jp/hanrei/search1/index.html')).rejects.toMatchObject({ status: 503 });
    expect(down.calls).toHaveLength(2);
  });
});
