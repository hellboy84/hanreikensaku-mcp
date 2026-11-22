import { describe, expect, it } from 'vitest';
import { parseDetailPage } from '../src/core/detail.js';
import { fixtureText } from './helpers.js';

const url = (id: number, n: number) => `https://www.courts.go.jp/hanrei/${id}/detail${n}/index.html`;

describe('parseDetailPage', () => {
  it('最高裁判例（detail2）', () => {
    const d = parseDetailPage(fixtureText('detail-97313-2.html'), url(97313, 2));
    expect(d.id).toBe(97313);
    expect(d.detailType).toBe(2);
    expect(d.detailTypeLabel).toBe('最高裁判例');
    expect(d.caseNumber).toBe('令和6(行ツ)193');
    expect(d.caseName).toBe('受刑者選挙権確認等請求事件');
    expect(d.date).toBe('令和8年11月18日');
    expect(d.dateIso).toBe('2026-11-18');
    expect(d.court).toBe('最高裁判所大法廷');
    expect(d.pdfUrl).toBe('https://www.courts.go.jp/assets/hanrei/hanrei-pdf-97313.pdf');
    const labels = d.fields.map((f) => f.label);
    expect(labels).toContain('原審事件番号');
    expect(labels).toContain('判示事項');
    // 値が空の項目（裁判要旨、参照法条など）は含めない
    expect(labels).not.toContain('裁判要旨');
    expect(labels).not.toContain('全文');
    expect(d.fields.find((f) => f.label === '原審裁判年月日')?.value).toBe('令和6年3月13日');
  });

  it('下級裁裁判例（detail4）は部の名前を含む', () => {
    const d = parseDetailPage(fixtureText('detail-97124-4.html'), url(97124, 4));
    expect(d.court).toBe('鹿児島地方裁判所 民事2部');
    expect(d.caseNumber).toBe('令和5(ワ)680号');
    expect(d.attachments).toEqual([]);
  });

  it('知財高裁裁判例（detail8）は当事者・争点などを含む', () => {
    const d = parseDetailPage(fixtureText('detail-97242-8.html'), url(97242, 8));
    expect(d.court).toBe('知的財産高等裁判所 １部');
    const field = (label: string) => d.fields.find((f) => f.label === label)?.value;
    expect(field('権利種別')).toBe('特許権');
    expect(field('主な争点')).toBe('進歩性（相違点の判断）');
    expect(field('当事者')).toBe('原告：アンテシップ バイオベンチャーズ トゥー エルエルシー\n被告：特許庁長官');
    // &thinsp; だけの項目は空として扱う
    expect(field('上告審の結果')).toBeUndefined();
  });

  it('添付文書のPDFは全文と分けて返す', () => {
    const d = parseDetailPage(fixtureText('detail-94346-5.html'), url(94346, 5));
    expect(d.pdfUrl).toBe('https://www.courts.go.jp/assets/hanrei/hanrei-pdf-94346.pdf');
    expect(d.attachments.map((a) => a.label)).toEqual(['添付文書1', '添付文書2']);
    expect(d.attachments[0]?.url).toMatch(/^https:\/\/www\.courts\.go\.jp\/osaka\/.+\.pdf$/);
    expect(d.fields.find((f) => f.label === '分野')?.value).toBe('行政');
  });

  it('項目のないページはエラーにする', () => {
    expect(() => parseDetailPage('<html><body>ページが見つかりません。</body></html>', url(1, 4))).toThrow(
      /見つかりません/,
    );
  });
});
