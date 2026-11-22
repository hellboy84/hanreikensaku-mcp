/**
 * ローカル（Node.js）用の組み立て：ファイルのキャッシュ、同梱のCMap、環境変数の読み取り。
 *
 * 環境変数：
 *   HANREI_CACHE_DIR        キャッシュの保存先（既定：~/.cache/hanreikensaku-mcp）
 *   HANREI_MIN_INTERVAL_MS  裁判所サイトへのアクセス間隔（既定：3000。1000未満にはできない）
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MIN_INTERVAL_MS, PoliteHttpClient } from './core/http.js';
import type { CMapLoader } from './core/pdf.js';
import { HanreiService } from './core/service.js';
import { FileCacheStore } from './storage/file.js';

/** 同梱している日本語のCMap（assets/cmaps）を読む */
export function createNodeCMapLoader(): CMapLoader {
  const dir = fileURLToPath(new URL('../assets/cmaps/', import.meta.url));
  return async (filename) => {
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) throw new Error(`CMapの名前が不正です：${filename}`);
    return new Uint8Array(await readFile(join(dir, filename)));
  };
}

export function createLocalService(): HanreiService {
  const cacheDir = process.env.HANREI_CACHE_DIR || join(homedir(), '.cache', 'hanreikensaku-mcp');
  const interval = Number(process.env.HANREI_MIN_INTERVAL_MS);
  const minIntervalMs = Number.isFinite(interval) && interval > 0 ? Math.max(1000, interval) : DEFAULT_MIN_INTERVAL_MS;
  return new HanreiService({
    http: new PoliteHttpClient({ minIntervalMs }),
    cache: new FileCacheStore(cacheDir),
    cmapLoader: createNodeCMapLoader(),
  });
}
