/**
 * キャッシュの窓口。ローカルではファイル、リモート（フェーズ2）ではR2などで実装する。
 * キーは "detail/97124-4.json" のような、英数字と . _ - / だけの文字列。
 */
export interface CacheEntry<T> {
  value: T;
  /** 保存した時刻（ミリ秒） */
  storedAt: number;
}

export interface CacheStore {
  getText(key: string): Promise<CacheEntry<string> | null>;
  setText(key: string, value: string): Promise<void>;
  getBytes(key: string): Promise<CacheEntry<Uint8Array> | null>;
  setBytes(key: string, value: Uint8Array): Promise<void>;
}

const KEY_PATTERN = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export function assertValidKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error(`キャッシュのキーが不正です：${key}`);
  }
}
