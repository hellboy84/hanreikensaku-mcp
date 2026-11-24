#!/usr/bin/env node
/**
 * Claudeデスクトップ版向けの配布ファイル（.mcpb）を作る。
 *
 *   node scripts/pack-mcpb.mjs   →   build/hanreikensaku-mcp.mcpb
 *
 * 実行に必要なものだけを build/mcpb/ に集めてから固める：
 *   manifest.json、package.json、dist/、assets/、node_modules/（実行時の依存のみ）、LICENSE、README.md
 * src/・tests/・PLAN.md などは入らない。作業中の node_modules には手を付けない。
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 固めるのに使う mcpb（https://github.com/modelcontextprotocol/mcpb）の版 */
const MCPB = '@anthropic-ai/mcpb@2.1.2';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, 'build', 'mcpb');
const output = join(root, 'build', 'hanreikensaku-mcp.mcpb');

const run = (command, cwd = root) => execSync(command, { cwd, stdio: 'inherit' });

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  throw new Error(`manifest.json（${manifest.version}）と package.json（${pkg.version}）の version が違います`);
}

run('npm run build');

rmSync(stage, { recursive: true, force: true });
rmSync(output, { force: true });
mkdirSync(stage, { recursive: true });
for (const name of ['manifest.json', 'package.json', 'package-lock.json', 'LICENSE', 'README.md', 'dist', 'assets']) {
  cpSync(join(root, name), join(stage, name), { recursive: true });
}

// 実行時の依存だけを入れる。--ignore-scripts は、prepare（ビルド）を走らせないため
run('npm ci --omit=dev --ignore-scripts --no-audit --no-fund', stage);

run(`npx --yes ${MCPB} pack "${stage}" "${output}"`);

console.log(`\n${output}（${(statSync(output).size / 1024 / 1024).toFixed(1)} MB）`);
