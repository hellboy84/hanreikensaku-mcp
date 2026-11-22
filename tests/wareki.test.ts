import { describe, expect, it } from 'vitest';
import { expandDate, isoToWareki, warekiToIso } from '../src/core/wareki.js';

describe('isoToWareki', () => {
  it('元号の境目を正しく扱う', () => {
    expect(isoToWareki('2019-05-01')).toEqual({ gengo: '令和', year: 1, month: 5, day: 1 });
    expect(isoToWareki('2019-04-30')).toEqual({ gengo: '平成', year: 31, month: 4, day: 30 });
    expect(isoToWareki('1989-01-08')).toEqual({ gengo: '平成', year: 1, month: 1, day: 8 });
    expect(isoToWareki('1989-01-07')).toEqual({ gengo: '昭和', year: 64, month: 1, day: 7 });
    expect(isoToWareki('2026-08-26')).toEqual({ gengo: '令和', year: 8, month: 8, day: 26 });
  });

  it('昭和より前・存在しない日付はエラー', () => {
    expect(() => isoToWareki('1920-01-01')).toThrow(/昭和より前/);
    expect(() => isoToWareki('2024-02-30')).toThrow(/存在しない/);
    expect(() => isoToWareki('2024/02/03')).toThrow(/YYYY-MM-DD/);
  });
});

describe('warekiToIso', () => {
  it('和暦の表記を西暦にする', () => {
    expect(warekiToIso('令和8年8月26日')).toBe('2026-08-26');
    expect(warekiToIso('平成元年3月1日')).toBe('1989-03-01');
    expect(warekiToIso('昭和３０年１月１１日')).toBe('1955-01-11');
    expect(warekiToIso('日付なし')).toBeNull();
  });
});

describe('expandDate', () => {
  it('年・年月だけの指定を範囲の端に広げる', () => {
    expect(expandDate('2020', 'from')).toBe('2020-01-01');
    expect(expandDate('2020', 'to')).toBe('2020-12-31');
    expect(expandDate('2024-02', 'to')).toBe('2024-02-29');
    expect(expandDate('2023-2', 'to')).toBe('2023-02-28');
    expect(expandDate('2020-4-1', 'from')).toBe('2020-04-01');
    expect(expandDate('令和2年4月1日', 'from')).toBe('2020-04-01');
  });

  it('読み取れない形はエラー', () => {
    expect(() => expandDate('去年', 'from')).toThrow();
  });
});
