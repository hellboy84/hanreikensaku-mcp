import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertValidKey, type CacheEntry, type CacheStore } from './types.js';

/** ファイルに保存するキャッシュ（ローカル用）。キーがそのまま root からの相対パスになる。 */
export class FileCacheStore implements CacheStore {
  constructor(private readonly root: string) {}

  private path(key: string): string {
    assertValidKey(key);
    return join(this.root, ...key.split('/'));
  }

  private async read(key: string): Promise<CacheEntry<Buffer> | null> {
    const file = this.path(key);
    try {
      const [value, info] = await Promise.all([readFile(file), stat(file)]);
      return { value, storedAt: info.mtimeMs };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  /** 書きかけのファイルが残らないよう、別名で書いてから置き換える */
  private async write(key: string, value: string | Uint8Array): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, value);
    await rename(tmp, file);
  }

  async getText(key: string): Promise<CacheEntry<string> | null> {
    const entry = await this.read(key);
    return entry && { value: entry.value.toString('utf8'), storedAt: entry.storedAt };
  }

  async setText(key: string, value: string): Promise<void> {
    await this.write(key, value);
  }

  async getBytes(key: string): Promise<CacheEntry<Uint8Array> | null> {
    const entry = await this.read(key);
    return entry && { value: new Uint8Array(entry.value), storedAt: entry.storedAt };
  }

  async setBytes(key: string, value: Uint8Array): Promise<void> {
    await this.write(key, value);
  }
}
