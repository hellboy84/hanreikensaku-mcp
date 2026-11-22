#!/usr/bin/env node
/**
 * ローカルMCPサーバー（stdio）の起動用ファイル。Claudeデスクトップ版・Claude Codeなどから起動する。
 * 読み込まれると必ずサーバーを起動する（ほかのコードから import しないこと）。
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './core/tools.js';
import { createLocalService } from './local-service.js';

try {
  const server = createServer(createLocalService());
  await server.connect(new StdioServerTransport());
  // stdout はMCPの通信に使うので、メッセージは stderr に出す
  console.error('hanreikensaku-mcp: 起動しました（stdio）');
} catch (e) {
  console.error('hanreikensaku-mcp: 起動に失敗しました', e);
  process.exit(1);
}
