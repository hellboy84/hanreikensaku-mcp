# 開発者向けの情報

プログラムの中身を見たい・直したい人と、新しい版を出す人のための説明です。使うだけなら読む必要はありません。使い方は [README](../README.md)、導入の手順は [INSTALL.md](INSTALL.md) にあります。なぜ作ったか、裁判所サイトについて調べたこと、設計の理由は [PLAN.md](../PLAN.md) に記録しています。

手元で動かすには、[方法A](INSTALL.md#方法aクローンして使う)の「A-1. 取得してビルドする」を行います。

## 構成

```
src/
  core/               検索・詳細ページ解析・PDF処理・ツール定義
    site.ts             URLと区分の定義
    search.ts           検索条件の組み立てと、検索結果ページの解析
    detail.ts           詳細ページの解析
    pdf.ts              PDFから行を取り出す
    text.ts             行をつないで段落にし、見出しで区切る
    http.ts             間隔を空けたアクセス
    service.ts          取得とキャッシュの組み合わせ
    tools.ts            MCPツールの定義
  storage/            キャッシュの窓口（ファイル、メモリ）
  local-service.ts    ローカル用の組み立て（キャッシュの場所、環境変数）
  local.ts            stdioで起動
assets/cmaps/         古いPDFの文字を取り出すための日本語CMap
manifest.json         .mcpb（Claudeデスクトップ版向けの配布ファイル）の説明書き
scripts/              .mcpb を作る・確かめるためのスクリプト
tests/
  fixtures/           裁判所サイトのHTMLの抜粋と、判決のPDF
```

裁判所サイトの構成が変わったときに直すのは、`src/core/` の `site.ts`・`search.ts`・`detail.ts` です。

## テスト

```bash
npm test
```

保存したデータ（`tests/fixtures/`）を使った解析のテストです。裁判所サイトにはアクセスしません。

```bash
npm run test:live
```

本物の裁判所サイトから数件だけ取得して、解析できるかを確かめます。GitHub Actionsで週1回動かし、サイトの構成が変わって壊れたら気づけるようにしています。

## .mcpb を作る

```bash
npm run pack:mcpb
```

`build/hanreikensaku-mcp.mcpb` ができます。実行に必要なもの（`manifest.json`、`dist/`、`assets/`、実行時の依存だけの `node_modules/`）を `build/mcpb/` に集め、[mcpb](https://github.com/modelcontextprotocol/mcpb) で1つのファイルにまとめています。

```bash
npm run smoke:mcpb
```

作った .mcpb を展開し、中身だけで起動できること、同梱のCMapでPDFから文字を取り出せることを確かめます。裁判所サイトにはアクセスしません。

## 新しい版を出す

1. `package.json`・`manifest.json`・`src/core/tools.ts`（`SERVER_VERSION`）の版を、同じ番号に上げる（そろっていないと `npm test` が失敗します）
2. main に入れたあと、`v` を付けたタグ（例：`v0.2.0`）を打ってプッシュする
3. GitHub Actions（`.github/workflows/release.yml`）が .mcpb を作り、[Releases](https://github.com/hellboy84/hanreikensaku-mcp/releases) に添付する

方法B（npx）の利用者には、main に入った時点で変更が届きます。.mcpb の利用者には、Releases から新しいファイルを取得して入れ直してもらう必要があります。
