#!/usr/bin/env node
/**
 * 裁判所サイトから保存したHTMLを、テストに必要な部分だけに切り詰める。
 *
 * リポジトリに入れるのは、解析が読む部分だけにする（サイトの案内文やメニューなどは入れない）。
 *   検索ページ：エラーの表示、件数の表示（または「該当なし」）、検索結果の表
 *   詳細ページ：項目（<dl>）のかたまり
 *
 * 使い方：
 *   node tests/trim-fixture.mjs <保存したHTML> <出力先> <取得元のURL> [--form]
 *
 *   --form を付けると、検索フォームの事件符号の選択欄も残す（符号の一覧を読むテスト用）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'node-html-parser';

const args = process.argv.slice(2);
const keepForm = args.includes('--form');
const [input, output, sourceUrl] = args.filter((a) => !a.startsWith('--'));
if (!input || !output || !sourceUrl) {
  console.error('使い方：node tests/trim-fixture.mjs <保存したHTML> <出力先> <取得元のURL> [--form]');
  process.exit(1);
}

const root = parse(readFileSync(input, 'utf8'));
const title = root.querySelector('title')?.text.trim() ?? '';
const parts = [];

const form = root.querySelectorAll('form').find((f) => f.getAttribute('name') === 'hanrei-search');
if (form) {
  // 検索ページ
  const inside = [];
  const errors = form.querySelector('.errorMessage');
  if (errors) inside.push(errors.outerHTML);
  if (keepForm) {
    const select = form.querySelectorAll('select').find((s) => s.getAttribute('name') === 'filter[jikenCode]');
    if (!select) throw new Error('事件符号の選択欄が見つかりません');
    inside.push(select.outerHTML);
  }
  parts.push(`<form method="GET" name="hanrei-search">\n${inside.join('\n')}\n</form>`);

  const searched = root.querySelector('#searched');
  if (searched) parts.push(searched.outerHTML);
  for (const table of root.querySelectorAll('table')) {
    if (table.querySelector('a[href*="/detail"]')) parts.push(table.outerHTML);
  }
} else {
  // 詳細ページ：<dt> を持つ <dl> の親要素をそのまま残す
  const parents = new Set();
  for (const dl of root.querySelectorAll('dl')) {
    if (dl.querySelector('dt') && dl.parentNode) parents.add(dl.parentNode);
  }
  if (parents.size === 0) throw new Error('項目（<dl>）が見つかりません');
  for (const parent of parents) parts.push(parent.outerHTML);
}

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${title}</title>
</head>
<body>
<!--
  テスト用の抜粋です。裁判所ウェブサイトのページから、解析に必要な部分だけを抜き出しています。
  ページの全体ではありません。元のページ：${sourceUrl}
-->
${parts.join('\n')}
</body>
</html>
`;
writeFileSync(output, html);
console.log(`${output}: ${html.length.toLocaleString()} 文字`);
