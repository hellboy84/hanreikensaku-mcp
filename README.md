# hanreikensaku-mcp

裁判所ウェブサイトの「[裁判例検索](https://www.courts.go.jp/hanrei/search1/index.html)」を、ClaudeなどのAIアシスタントから検索・取得できるようにするMCPサーバーです。

*An MCP server that lets AI assistants search Japanese court decisions on courts.go.jp and read their full text (extracted from the official PDFs).*

- 裁判例を、キーワード・事件番号・裁判年月日・裁判所名などで検索できます
- 判決の全文はPDFでしか公開されていませんが、PDFから文字を取り出し、読みやすく整えて返します
- 自分のパソコンの中で動きます。アカウントの登録やAPIキーは要りません

裁判所とは関係のない、個人が作った非公式のツールです。

## できること

| ツール | 内容 |
|---|---|
| `search_cases` | 裁判例を検索し、一覧（ID、事件番号、事件名、裁判年月日、裁判所など）を返す |
| `get_case` | 裁判例1件の詳細（結果、原審、判示事項、裁判要旨、参照法条など）と全文PDFのURLを返す |
| `get_full_text` | 裁判例1件の本文を返す。見出し（主文、理由、第1…）の一覧が付き、見出し単位・ページ範囲で取り出せる |

AIアシスタントには、たとえば次のように頼めます。

- 「安全配慮義務と過労死の両方に触れている、2015年以降の大阪地裁の裁判例を探して」
- 「令和6年(行ツ)第193号の判示事項と主文を教えて」
- 「この判決の『当裁判所の判断』の部分を要約して」

## 導入

### 必要なもの

- [Node.js](https://nodejs.org/) 22 以上（`node --version` で確認できます）
- [Git](https://git-scm.com/)
- MCPに対応したAIアシスタント（Claudeデスクトップ版、Claude Code など）

### 1. 取得してビルドする

置きたい場所で、次の3つを順に実行します。

```bash
git clone https://github.com/hellboy84/hanreikensaku-mcp.git
```

```bash
cd hanreikensaku-mcp
```

```bash
npm install
```

`npm install` の中でビルドも行われ、`dist/local.js` ができます。これがサーバーの本体です。

### 2. 起動できるか確かめる

```bash
node dist/local.js
```

`hanreikensaku-mcp: 起動しました（stdio）` と表示されれば成功です。そのまま待ち受けの状態になるので、Ctrl+C で止めてください。

### 3. AIアシスタントに登録する

登録には、次の2つの**フルパス**が必要です。

| 必要なもの | 調べ方 | 例 |
|---|---|---|
| `node` の場所 | macOS・Linux：`which node`、Windows：`where node` | `/usr/local/bin/node` |
| `dist/local.js` の場所 | `hanreikensaku-mcp` のフォルダで `pwd`（Windowsは `cd`）を実行し、後ろに `/dist/local.js` を付ける | `/Users/you/hanreikensaku-mcp/dist/local.js` |

#### Claudeデスクトップ版

設定ファイル `claude_desktop_config.json` に書き足します。Claudeデスクトップ版の「設定」→「開発者」→「設定を編集（Edit Config）」で、このファイルの場所が開きます。

| OS | 場所 |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "hanrei": {
      "command": "/usr/local/bin/node",
      "args": ["/Users/you/hanreikensaku-mcp/dist/local.js"]
    }
  }
}
```

- `command` と `args` は、上で調べたフルパスに置き換えます
- すでに `mcpServers` がある場合は、その中に `"hanrei": { … }` を足します（ほかの設定は消さないでください）
- Windowsでは、パスの `\` を `\\` と書きます（例：`"C:\\Users\\you\\hanreikensaku-mcp\\dist\\local.js"`）
- 書いたあと、Claudeデスクトップ版を完全に終了して起動し直します

#### Claude Code

```bash
claude mcp add hanrei -- node /Users/you/hanreikensaku-mcp/dist/local.js
```

パスは自分の環境のものに置き換えます。登録できたかは `claude mcp list` で確認できます。

#### そのほかのMCPクライアント

stdio（標準入出力）で動くMCPサーバーです。起動コマンドに `node`、引数に `dist/local.js` のフルパスを指定してください。

### クローンせずに使う（npx）

`npx` でGitHubから直接起動することもできます。手順は少なくなりますが、初回の起動に時間がかかり（取得とビルドを行うため）、更新がすぐには反映されないことがあります。確実なのは上の方法です。

```json
{
  "mcpServers": {
    "hanrei": {
      "command": "npx",
      "args": ["-y", "github:hellboy84/hanreikensaku-mcp"]
    }
  }
}
```

### 更新する

`hanreikensaku-mcp` のフォルダで、次の2つを順に実行し、AIアシスタントを起動し直します。

```bash
git pull
```

```bash
npm install
```

### やめる

1. 設定ファイルから `"hanrei"` の項目を消す（Claude Code は `claude mcp remove hanrei`）
2. `hanreikensaku-mcp` のフォルダを消す
3. キャッシュのフォルダ `~/.cache/hanreikensaku-mcp` を消す

### AIに導入を任せる場合

AIアシスタント（コーディングエージェントなど）にこのREADMEを渡して導入させるときは、次の点を守らせてください。

1. `node --version` が 22 以上であることを確かめる。満たさなければ、そこで止めて利用者に伝える
2. 「1. 取得してビルドする」の3つのコマンドを実行し、`dist/local.js` ができたことを確かめる
3. 設定には `node` と `dist/local.js` の**フルパス**を書く（相対パスや `~` は使わない）
4. 設定ファイルは上書きしない。既存の内容を読み、`mcpServers` に `hanrei` を足す。書き換える前に控えを取る
5. 終わったら、AIアシスタントを起動し直す必要があることを利用者に伝える

## ツールの使い方

AIアシスタントが自分で引数を組み立てるので、利用者が覚える必要はありません。どんな条件で探せるかの参考にしてください。

### `search_cases`

条件は少なくとも1つ必要です。1回に最大30件を返し、続きは `offset` で取得します。

| 引数 | 内容 |
|---|---|
| `keywords` | 全文検索の語。スペースで区切ると「いずれかを含む」 |
| `keywords_and` | `keywords` の結果を、さらにこの語を含むものに絞る |
| `category` | 検索する区分（下の表）。省略すると全区分 |
| `date_from`、`date_to` | 裁判年月日の範囲。西暦で `2020-04-01`（`2020`、`2020-04` も可）。昭和以降 |
| `case_number` | 事件番号。例：`令和5年(ワ)第680号`。一部だけでもよい |
| `court_name` | 裁判所名。例：`東京地方裁判所` |
| `branch_name` | 支部名。例：`立川支部` |
| `case_name` | 事件名に含まれる語（区分が `supreme`・`high`・`administrative`・`labor` のときだけ） |
| `sort` | `date_desc`（新しい順。既定）、`date_asc`（古い順）、`court`（裁判所の建制順） |
| `offset` | 何件目から返すか（0始まり） |

| `category` | 区分 |
|---|---|
| `all`（既定） | 統合検索（全区分） |
| `supreme` | 最高裁判所判例集 |
| `high` | 高等裁判所判例集 |
| `lower` | 下級裁判所裁判例速報 |
| `administrative` | 行政事件裁判例集 |
| `labor` | 労働事件裁判例集 |
| `ip` | 知的財産裁判例集 |

### `get_case`

| 引数 | 内容 |
|---|---|
| `id` | 裁判例のID（検索結果に出る番号。詳細ページのURL `/hanrei/{ID}/detail{N}/` のIDと同じ） |
| `detail_type` | 詳細ページの種類（URLの `{N}`）。ふつうは省略する |

### `get_full_text`

| 引数 | 内容 |
|---|---|
| `id` | 裁判例のID |
| `section` | 見出しの番号。その見出しの部分だけを返す |
| `page_from`、`page_to` | 元PDFのページ範囲 |
| `max_chars` | 1回に返す文字数の上限（既定 12,000、最大 40,000）。超える場合はページの区切りで打ち切り、続きの取得方法を案内する |

本文は次のような形で返ります。1段落が1行で、`【N頁】` は元PDFのページ番号です。

```
【1頁】
主文
1 原告の請求を棄却する。
2 訴訟費用は原告の負担とする。
事実及び理由
第1 請求
特許庁が不服2023－3961号事件について令和7年9月17日にした審決を取り消す。
```

## 知っておくこと

- **全ての裁判例が載っているわけではありません。** 裁判所サイト自身がそう明記しています。「見つからない」は「存在しない」を意味しません
- **全文検索には2,000件の上限があります。** キーワードに該当する裁判例が全区分の合計で2,000件を超えると、裁判所サイトは結果を返しません（「損害賠償」「憲法」「契約」のような一般的な語）。期間・裁判所・区分で絞っても解消しないので、より具体的な語にするか、`keywords_and` で語を追加します。このときは「0件」ではなくエラーとして知らせます
- **本文はPDFから機械的に取り出したものです。** 文の途中の改行はつなぎ、ページ番号や行番号は取り除き、全角の英数字は半角にそろえています。図・表の罫線・数式・下線は含まれません。表や別紙は行ごとにばらばらに出ます。正確な引用には、返されるURLの原文PDFを確認してください
- **外字は「・」になっていることがあります。** 裁判所サイトが公開の時点で置き換えているもので、本来の中黒と見分けられません
- **`【N頁】` は段落が始まる位置で示しています。** ページをまたぐ段落は、始まりのページに含めます
- **当事者名などは「A」「B」等に置き換えられていることがあります**（裁判所サイト側の処理）
- **IDだけを指定した `get_case` は、区分を推定します。** 裁判所サイトの詳細ページは区分ごとに項目が違い、区分が合っていなくてもページが返ってくるためです。検索結果に出たIDなら、検索時に分かった区分を使います
- **法令の条文は扱いません。** e-Gov法令APIを使うMCPサーバーなどと組み合わせてください

## 裁判所サイトへの配慮

このツールは、利用者が検索するたびに、利用者のパソコンから裁判所サイトにアクセスします。サイトに負担をかけないよう、次のようにしています。

- アクセスは1件ずつ、間隔を空けて行います（既定3秒）
- 一度取得したものは手元にキャッシュし、取り直しません（検索結果は6時間、詳細ページは30日、PDFと本文は無期限）
- User-Agent にこのリポジトリのURLを入れています
- 一括取得（全件を順に取得すること）は行いません

判決文は著作権法13条により著作権の対象になりませんが、取得した本文をまとめて再配布するような使い方は想定していません。

## 設定

環境変数で変えられます。ふつうは設定不要です。

| 変数 | 内容 | 既定 |
|---|---|---|
| `HANREI_CACHE_DIR` | キャッシュの保存先 | `~/.cache/hanreikensaku-mcp` |
| `HANREI_MIN_INTERVAL_MS` | 裁判所サイトへのアクセス間隔（ミリ秒。1000未満にはできません） | `3000` |

Claudeデスクトップ版では、設定ファイルの `"hanrei"` の中に `"env": { "HANREI_CACHE_DIR": "/path/to/cache" }` のように書きます。

## うまくいかないとき

| 症状 | 確かめること |
|---|---|
| AIアシスタントにツールが出てこない | 設定ファイルのJSONが正しいか（カンマや括弧）。パスがフルパスか。AIアシスタントを完全に終了して起動し直したか |
| `node` が見つからないと言われる | `command` を `node` のフルパスにする |
| `dist/local.js` がない | `hanreikensaku-mcp` のフォルダで `npm install` を実行する |
| 検索がエラーになる（2000件を超えました） | 上の「全文検索には2,000件の上限があります」を参照 |
| 以前は動いていたのに、検索や取得が失敗する | 裁判所サイトの構成が変わった可能性があります。「更新する」を試し、直らなければIssueでお知らせください |

## 開発

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
tests/
  fixtures/           裁判所サイトのHTMLの抜粋と、判決のPDF
```

裁判所サイトの構成が変わったときに直すのは、`src/core/` の `site.ts`・`search.ts`・`detail.ts` です。

```bash
npm test
```

保存したデータ（`tests/fixtures/`）を使った解析のテストです。裁判所サイトにはアクセスしません。

```bash
npm run test:live
```

本物の裁判所サイトから数件だけ取得して、解析できるかを確かめます。GitHub Actionsで週1回動かし、サイトの構成が変わって壊れたら気づけるようにしています。

開発とテストは Linux（Node.js 22）で行っています。

## 背景と今後

なぜ作ったか、裁判所サイトについて調べたこと、設計の理由は [PLAN.md](PLAN.md) に記録しています（開発時の計画書で、このREADMEを読むのに必要なものではありません）。

今後の候補：

- 本文から引用条文（民法709条 など）を抜き出すツール
- 添付文書PDFの本文化、表・別紙の整形
- 自分のパソコンに入れなくても使える形（リモートMCP）

## 免責

- 裁判所とは関係のない非公式のツールです。裁判所サイトの構成が変わると、動かなくなることがあります
- 取得した内容の正確さ・完全さは保証しません。実務で使うときは、必ず原文（裁判所サイトのPDF、判例集など）で確認してください
- このツールは情報の取得を助けるもので、法的な助言をするものではありません

## ライセンス

[MIT License](LICENSE)（© 2026 S.HASHIMOTO）

このライセンスが及ぶのは、このリポジトリのプログラムと文書です。次のものは別の扱いです。

- 取得される判決文：著作権法13条により著作権の対象になりません
- `assets/cmaps/`：下のとおり、元のライセンスのままです
- `tests/fixtures/`：裁判所ウェブサイトから取得したテスト用のデータです（[説明](tests/fixtures/README.md)）

## 同梱しているもの

`assets/cmaps/` は、[pdf.js](https://github.com/mozilla/pdf.js)（pdfjs-dist 6.4.299）に含まれるAdobeのCMapのうち、日本語のものです。ライセンスは `assets/cmaps/LICENSE` のとおりです。平成期以前のPDFはフォントを埋め込んでいないものが多く、これがないと文字を取り出せません。
