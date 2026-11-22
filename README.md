# hanreikensaku-mcp

裁判所ウェブサイトの「[裁判例検索](https://www.courts.go.jp/hanrei/search1/index.html)」を、Claudeから検索・取得できるようにするMCPサーバーです。

- 検索は、その都度、裁判所サイトの検索に問い合わせます（自前の索引は持ちません）
- 判決の全文はPDFでしか公開されていないので、PDFから文字を取り出し、読みやすく整えて返します
- 一度取得した詳細ページ・PDF・本文は手元にキャッシュし、同じものを取り直しません

現在はフェーズ1（ローカルMCP・stdio）です。開発の方針と経緯は [PLAN.md](PLAN.md) にあります。

## ツール

| ツール | 内容 |
|---|---|
| `search_cases` | キーワード、区分、裁判年月日の範囲、事件番号、裁判所名、事件名などで検索し、一覧（ID、事件番号、事件名、裁判年月日、裁判所など）を返す。1回に最大30件 |
| `get_case` | IDを指定して、詳細ページの項目（結果、原審、判示事項、裁判要旨、参照法条など）と全文PDFのURLを返す |
| `get_full_text` | IDを指定して、本文を返す。見出し（主文、理由、第1…）の一覧が付き、見出し単位・ページ範囲で取り出せる |

`search_cases` の区分（`category`）：

| 値 | 区分 |
|---|---|
| `all`（既定） | 統合検索（全区分） |
| `supreme` | 最高裁判所判例集 |
| `high` | 高等裁判所判例集 |
| `lower` | 下級裁判所裁判例速報 |
| `administrative` | 行政事件裁判例集 |
| `labor` | 労働事件裁判例集 |
| `ip` | 知的財産裁判例集 |

## 使い方

### 必要なもの

- Node.js 22 以上

### インストール

```bash
git clone https://github.com/hellboy84/hanreikensaku-mcp.git
```

```bash
cd hanreikensaku-mcp
```

```bash
npm install
```

`npm install` の中でビルドも行われ、`dist/local.js` ができます。

### Claudeデスクトップ版

`claude_desktop_config.json`（macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`）に書きます。

```json
{
  "mcpServers": {
    "hanrei": {
      "command": "node",
      "args": ["/Users/you/hanreikensaku-mcp/dist/local.js"]
    }
  }
}
```

デスクトップ版から起動するとPATHが通っていないことがあるので、`command` は `node` のフルパス（`which node` で分かります）にすると確実です。

### Claude Code

```bash
claude mcp add hanrei -- node /Users/you/hanreikensaku-mcp/dist/local.js
```

### 環境変数

| 変数 | 内容 | 既定 |
|---|---|---|
| `HANREI_CACHE_DIR` | キャッシュの保存先 | `~/.cache/hanreikensaku-mcp` |
| `HANREI_MIN_INTERVAL_MS` | 裁判所サイトへのアクセス間隔（ミリ秒。1000未満にはできません） | `3000` |

### 頼み方の例

- 「安全配慮義務と過労死の両方に触れている、2015年以降の大阪地裁の裁判例を探して」
- 「令和6年(行ツ)第193号の判示事項と主文を教えて」
- 「この判決の『当裁判所の判断』の部分を要約して」

## 知っておくこと

- **全ての裁判例が載っているわけではありません。** 裁判所サイト自身がそう明記しています。「見つからない」は「存在しない」を意味しません
- **全文検索には2,000件の上限があります。** キーワードに該当する裁判例が全区分の合計で2,000件を超えると、裁判所サイトは結果を返しません（「損害賠償」「憲法」「契約」のような一般的な語）。期間・裁判所・区分で絞っても解消しないので、より具体的な語にするか、`keywords_and` で語を追加します。このときMCPは「0件」ではなくエラーとして知らせます
- **本文はPDFから機械的に取り出したものです。** 図表は含まれません。外字が「・」になっていることがあります。全角の英数字は半角にそろえています。正確な引用には、返されるURLの原文PDFを確認してください
- **本文中の `【N頁】` は元PDFのページ番号です。** 段落が始まる位置で示しています（ページをまたぐ段落は、始まりのページに含めます）
- **当事者名などは「A」「B」等に置き換えられていることがあります**（裁判所サイト側の処理）
- **IDだけを指定した `get_case` は、区分を推定します。** 裁判所サイトの詳細ページは区分ごとに項目が違い、区分が合っていなくてもページが返ってくるためです。検索結果に出たIDなら、検索時に分かった区分を使います

## 裁判所サイトへの配慮

- アクセスは1件ずつ、間隔を空けて行います（既定3秒）
- 取得済みの詳細ページ（30日）・検索結果（6時間）・PDFと本文（無期限）はキャッシュから返します
- User-Agent にこのリポジトリのURLを入れています
- 一括取得（全件クロール）は行いません

判決文は著作権法13条により権利の目的となりませんが、本文を一括で再配布する使い方は想定していません。

## 開発

```
src/
  core/       検索・詳細ページ解析・PDF処理・ツール定義（ローカル・リモート共通）
    site.ts     URLと区分の定義
    search.ts   検索条件の組み立てと、検索結果ページの解析
    detail.ts   詳細ページの解析
    pdf.ts      PDFから行を取り出す
    text.ts     行をつないで段落にし、見出しで区切る
    http.ts     間隔を空けたアクセス
    service.ts  取得とキャッシュの組み合わせ
    tools.ts    MCPツールの定義
  storage/    キャッシュの窓口（ファイル、メモリ）
  local.ts    stdioで起動
assets/cmaps/ 古いPDFの文字を取り出すための日本語CMap
tests/
  fixtures/   保存したHTML・PDF
```

裁判所サイトの構成が変わったときに直すのは、`src/core/` の `site.ts`・`search.ts`・`detail.ts` です。

```bash
npm test
```

保存したHTML・PDFを使った解析のテストです。裁判所サイトにはアクセスしません。

```bash
npm run test:live
```

本物の裁判所サイトから数件だけ取得して、解析できるかを確かめます。GitHub Actions（`.github/workflows/live-check.yml`）で週1回動かし、サイトの構成が変わって壊れたら気づけるようにしています。

## 同梱しているもの

`assets/cmaps/` は、[pdf.js](https://github.com/mozilla/pdf.js)（pdfjs-dist 6.4.299）に含まれるAdobeのCMapのうち、日本語のものです。ライセンスは `assets/cmaps/LICENSE` のとおりです。平成期以前のPDFはフォントを埋め込んでいないものが多く、これがないと文字を取り出せません。
