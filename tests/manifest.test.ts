import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import type { HanreiService } from '../src/core/service.js';
import { createServer, SERVER_NAME, SERVER_VERSION } from '../src/core/tools.js';

const readJson = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8'));

/** manifest.json は .mcpb（Claudeデスクトップ版向けの配布ファイル）の説明書き。本体とずれていないかを確かめる */
describe('manifest.json', () => {
  const manifest = readJson('manifest.json');
  const pkg = readJson('package.json');

  it('名前と版が、package.json・サーバー本体と同じ', () => {
    expect(manifest.name).toBe(SERVER_NAME);
    expect(manifest.name).toBe(pkg.name);
    expect(manifest.version).toBe(pkg.version);
    expect(SERVER_VERSION).toBe(pkg.version);
  });

  it('起動するファイルと Node.js の条件が、package.json と同じ', () => {
    expect(manifest.server.entry_point).toBe(pkg.bin[pkg.name]);
    expect(manifest.server.mcp_config.args).toEqual([`\${__dirname}/${pkg.bin[pkg.name]}`]);
    expect(manifest.compatibility.runtimes.node).toBe('>=22.0.0');
    expect(pkg.engines.node).toBe('>=22');
  });

  it('ツールの一覧が、実際に登録されるものと同じ', async () => {
    const server = createServer({} as HanreiService);
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    const registered = (await client.listTools()).tools.map((t) => t.name).sort();
    await client.close();
    expect(manifest.tools.map((t: { name: string }) => t.name).sort()).toEqual(registered);
  });
});
