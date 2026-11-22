/**
 * 本物の裁判所サイトに対する確認。サイトの構成が変わって解析が壊れたら気づけるようにする。
 * 通常のテストでは動かさない。`npm run test:live`（LIVE=1）のときだけ動く。
 * アクセスは数件だけで、間隔も通常どおり空ける。
 */
import { describe, expect, it } from 'vitest';
import { PoliteHttpClient } from '../src/core/http.js';
import { HanreiService } from '../src/core/service.js';
import { MemoryCacheStore } from '../src/storage/memory.js';
import { cmapLoader } from './helpers.js';

describe.skipIf(!process.env.LIVE)('裁判所サイト（実物）', () => {
  const service = new HanreiService({
    http: new PoliteHttpClient(),
    cache: new MemoryCacheStore(),
    cmapLoader,
  });

  it('事件番号で検索できる', async () => {
    const r = await service.search({ caseNumber: '昭和28年(オ)第801号' });
    expect(r.total).toBeGreaterThanOrEqual(1);
    const item = r.items.find((i) => i.id === 57453);
    expect(item).toBeDefined();
    expect(item?.court).toMatch(/^最高裁判所/);
    expect(item?.dateIso).toBe('1955-03-29');
    expect(item?.categories[0]?.detailType).toBe(2);
  }, 60_000);

  it('キーワードで検索でき、件数と一覧が取れる', async () => {
    // 該当が2,000件を超える語はサイトがエラーを返すので、そこまで多くない語を使う
    const r = await service.search({ keywords: '安全配慮義務' });
    expect(r.total).toBeGreaterThan(100);
    expect(r.items).toHaveLength(30);
    expect(r.nextOffset).toBe(30);
    for (const item of r.items) {
      expect(item.id).toBeGreaterThan(0);
      expect(item.caseNumber).not.toBe('');
      expect(item.dateIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.court).toMatch(/裁判所/);
      expect(item.categories.length).toBeGreaterThan(0);
    }
  }, 60_000);

  it('詳細ページの項目が取れる', async () => {
    const info = await service.getCase(57453);
    expect(info.caseNumber).toBe('昭和28(オ)801');
    expect(info.caseName).toBe('認知請求');
    expect(info.date).toBe('昭和30年3月29日');
    expect(info.court).toMatch(/^最高裁判所/);
    expect(info.fields.map((f) => f.label)).toEqual(expect.arrayContaining(['事件名', '裁判種別', '結果', '判示事項', '裁判要旨', '参照法条']));
    expect(info.pdfUrl).toBe('https://www.courts.go.jp/assets/hanrei/hanrei-pdf-57453.pdf');
  }, 60_000);

  it('該当が多すぎる全文検索は、0件ではなくエラーになる', async () => {
    await expect(service.search({ keywords: '損害賠償' })).rejects.toThrow(/2000件を超えました/);
  }, 60_000);

  it('全文PDFから本文が取れる', async () => {
    const doc = await service.getFullText(57453);
    expect(doc.pageCount).toBe(1);
    expect(doc.sections.map((s) => s.title)).toEqual(['主文', '理由']);
    expect(doc.paragraphs.map((p) => p.text)).toContain('本件上告を棄却する。');
  }, 60_000);
});
