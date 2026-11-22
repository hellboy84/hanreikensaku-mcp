import { assertValidKey, type CacheEntry, type CacheStore } from './types.js';

/** メモリ上のキャッシュ（テスト用、またはディスクに書けない環境用） */
export class MemoryCacheStore implements CacheStore {
  private readonly texts = new Map<string, CacheEntry<string>>();
  private readonly blobs = new Map<string, CacheEntry<Uint8Array>>();

  constructor(private readonly now: () => number = Date.now) {}

  async getText(key: string): Promise<CacheEntry<string> | null> {
    assertValidKey(key);
    return this.texts.get(key) ?? null;
  }

  async setText(key: string, value: string): Promise<void> {
    assertValidKey(key);
    this.texts.set(key, { value, storedAt: this.now() });
  }

  async getBytes(key: string): Promise<CacheEntry<Uint8Array> | null> {
    assertValidKey(key);
    return this.blobs.get(key) ?? null;
  }

  async setBytes(key: string, value: Uint8Array): Promise<void> {
    assertValidKey(key);
    this.blobs.set(key, { value: new Uint8Array(value), storedAt: this.now() });
  }
}
