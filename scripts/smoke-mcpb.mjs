#!/usr/bin/env node
/**
 * 作った .mcpb を展開し、中身だけで動くことを確かめる（裁判所サイトにはアクセスしない）。
 *
 *   node scripts/pack-mcpb.mjs && node scripts/smoke-mcpb.mjs
 *
 * 1. 展開したフォルダーの dist/local.js を起動し、MCPで3つのツールが見えること
 * 2. 同梱したCMapを使って、フォントを埋め込んでいないPDF（tests/fixtures）から文字を取り出せること
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = join(root, 'build', 'hanreikensaku-mcp.mcpb');
const dir = mkdtempSync(join(tmpdir(), 'hanrei-mcpb-'));

try {
  execSync(`npx --yes @anthropic-ai/mcpb@2.1.2 unpack "${bundle}" "${dir}"`, { stdio: 'inherit' });
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

  // 1. Claudeデスクトップ版と同じ形（node <展開先>/dist/local.js）で起動する
  const args = manifest.server.mcp_config.args.map((a) => a.replaceAll('${__dirname}', dir));
  const client = new Client({ name: 'smoke-mcpb', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args,
      env: { ...process.env, HANREI_CACHE_DIR: join(dir, '.cache') },
      stderr: 'inherit',
    }),
  );
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  await client.close();
  const expected = manifest.tools.map((t) => t.name).sort();
  if (names.join() !== expected.join()) {
    throw new Error(`ツールが manifest.json と違います：${names.join()}（期待：${expected.join()}）`);
  }
  console.log(`ツール：${names.join('、')}`);

  // 2. 展開先のコードと、展開先のCMapだけで、PDFから文字を取り出す
  const load = (file) => import(pathToFileURL(join(dir, 'dist', file)).href);
  const { createNodeCMapLoader } = await load('local-service.js');
  const { extractPdfPages } = await load('core/pdf.js');
  const pdf = new Uint8Array(readFileSync(join(root, 'tests', 'fixtures', 'hanrei-pdf-57453.pdf')));
  const pages = await extractPdfPages(pdf, createNodeCMapLoader());
  const text = pages.flatMap((p) => p.lines.map((l) => l.text)).join('\n');
  if (!text.includes('主') || !text.includes('文')) {
    throw new Error('同梱のCMapで、PDFから文字を取り出せませんでした');
  }
  console.log(`PDF：${pages.length}頁、${text.length}字を取り出せました`);
  console.log('OK');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
