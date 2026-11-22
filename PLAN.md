# 判例検索MCP 開発計画

裁判所ウェブサイトの「裁判例検索」（https://www.courts.go.jp/hanrei/search1/index.html）を、Claudeから検索・取得できるようにするMCPサーバー。

## 進め方

1. フェーズ1：ローカルMCP（stdio）として、作りやすい形で実装し、使い勝手を確かめる
2. フェーズ2：うまくいけばリモートMCP（Cloudflare Workers）への移行を検討する

フェーズ1の段階から、フェーズ2で中身を使い回せる構成にしておく。

## 背景

- 日本の判例DB（LEX/DB、D1-Law、Westlaw Japan、判例秘書など）に、Claudeの公式コネクターはない（日本の判例DBで公式コネクターがあるのは有料のLegal Brain Agentのみ）
- 裁判所の「裁判例検索」を正面から扱い、PDFのテキスト化まで行うMCPサーバーは見当たらない
  - 参考：labor-law-mcp（omusubiman5、労働分野で裁判所判例DBの検索あり）、Legal Leap MCP（裁判例ツールあり、稼働状況が不安定）、jpcite（有料、判例は機能の一部）
  - 参考：Apifyの「Japan Courts Judgment Scraper」（MCPではないが、出力項目の参考になる）
- 法令はe-Gov法令API（Version2で時点指定に対応、平成29年4月1日以降のデータ）と、それを使う既存MCPが多数あるので、本MCPでは扱わない。法令の取得は既存の法令MCPに任せる

## 裁判例検索サイトについて分かっていること

- 収録件数は公表されていない。「すべての判決等が掲載されているわけではない」と明記されている
- 掲載区分：最高裁判所判例集、高等裁判所判例集、下級裁判所裁判例速報、行政事件裁判例集、労働事件裁判例集、知的財産裁判例集の6種類
- 詳細ページ：`https://www.courts.go.jp/hanrei/{ID}/detail{N}/index.html`
  - 事件番号、事件名、裁判年月日、裁判所名、権利種別、訴訟類型などがHTMLで載っている
  - `{N}` は区分による番号（2〜8）。IDだけでは正しい `{N}` は決まらない（「フェーズ1の確認結果」を参照）
- 全文PDF：`https://www.courts.go.jp/assets/hanrei/hanrei-pdf-{ID}.pdf`
  - 判決本文はHTMLにはなく、PDFのみ
- 「最近の裁判例」のリンクでは `courtCaseType`、`filter[recent]=1`、`view` などのURLパラメータが使われている
- robots.txt：`/hanrei/` と `/assets/` への制限なし、Crawl-delayの指定なし
- 判決文は著作権法13条により権利の目的とならない。ただし本文テキストを一括で再配布することは控える

## フェーズ1：ローカルMCP

### 方式

都度検索型（索引は作らない）＋キャッシュ。

- 検索は、その都度、裁判所サイトの検索に問い合わせる
- 一度取得した詳細ページ・本文テキストは手元にキャッシュして再利用する
- 一括取得（全件クロール）は行わない

### ツール（案）

| ツール | 内容 |
|---|---|
| `search_cases` | キーワード、裁判所、期間、事件番号、区分などで検索し、一覧（ID、事件番号、裁判年月日、裁判所、事件名、URL）を返す |
| `get_case` | IDを指定して、詳細ページのメタデータを返す |
| `get_full_text` | IDを指定して、本文テキストを返す。ページ範囲や見出し単位（主文、事実及び理由など）で分けて返せるようにする |
| `extract_cited_provisions` | 本文から引用条文（例：民法709条）を抜き出し、法令名・条番号・裁判年月日を構造化して返す（後回しでよい） |

ツールの入出力は増やしすぎず、フェーズ2でも同じ形を保つ。

### PDF処理

1. 取り出し：PDFから文字のデータを取り出す。画像だけのPDF（古い判決など）がどの程度あるかを確認し、あればOCRの要否を判断する
2. 整形：文の途中の改行をつなぐ（日本語はスペースなしで連結）、ページ番号・ヘッダーなどの繰り返し文字を除く、全角・半角をそろえる。JIS外字が「・」で表示されている箇所がありうるので、必要なら注記する
3. 構造化：「主文」「事実及び理由」「第1」「第2」などの見出しで区切る。元PDFのページ番号を保持する
4. 分割：長い判決（100ページ超もある）に備えて、ページ範囲・見出し単位で返す

### 構成

```
src/
  core/       検索・詳細ページ解析・PDF処理（ローカル・リモート共通）
  storage/    キャッシュの窓口（ローカル用：ファイル/SQLite、リモート用：R2/KV）
  local.ts    stdioで起動（Claudeデスクトップ版・Claude Code用）
  worker.ts   （フェーズ2）HTTPで起動＋認証
tests/
  fixtures/   保存したHTML・PDF
```

- サイトへのアクセスと解析は `core/` の中の小さなモジュールに閉じ込める。サイトが変わったときに直すのはそこだけにする
- 詳細ページの項目は、CSSのclass名ではなく「事件番号」「裁判年月日」などの見出し文字で取り出す
- 公式SDKを使い、バージョンを固定する

### 言語

TypeScriptを第一候補とする。フェーズ2のCloudflare Workersでそのまま動かせるため。PDF処理にもWorkersで動くライブラリ（pdf.js系など）を選ぶ。

Pythonで作る場合は、フェーズ2の置き場所をWorkersではなく、Pythonが動くサービス（Cloud Run、Fly.ioなど）にする。FastMCPはstdioとStreamable HTTPの両方に対応している。

### サイトへの配慮

- アクセスは間隔を空ける（数秒おき）
- 取得済みのページ・PDFはキャッシュし、再取得しない
- User-Agentに連絡先（リポジトリURL）を入れる

### テスト

- 保存したHTML・PDFで解析のテストを作る
- GitHub Actionsで週1回、本物のページを1件取得して解析できるか確認し、壊れたら気づけるようにする

### 設定例（Claudeデスクトップ版）

`claude_desktop_config.json`（macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`）に書く。チャット画面とCodeタブの両方で使える。

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

- デスクトップ版から起動するとPATHが通っていないことがあるので、コマンドはフルパスで書くと確実
- 単体のClaude Codeは `claude_desktop_config.json` を読まない。`claude mcp add-from-claude-desktop` でコピーできる
- 他の人に配る場合は、GitHubから直接実行できる形（`npx github:hellboy84/hanreikensaku-mcp` など）か、Desktop Extension（`.mcpb`）を検討する

## フェーズ1で最初に確かめること

1. 検索がURLパラメータ（GET）で呼べるか。呼べない場合はフォーム送信の仕組みを調べる
2. IDから詳細ページの `{N}` を決められるか
3. PDFのうち、文字を取り出せないもの（画像だけのもの）の割合
4. 数十件で、検索→詳細→PDF→テキスト化→返却までが一通り動くか

## フェーズ1の確認結果（2026年11月22日）

上の4点を実際のサイトで確かめ、ローカルMCP（`search_cases`、`get_case`、`get_full_text`）を実装した。`extract_cited_provisions` は未着手。

### 1. 検索はURLパラメータ（GET）で呼べる

- 検索ページは7つある：`/hanrei/search1/`（統合）、`search2`（最高裁）、`search3`（高裁）、`search4`（下級裁）、`search5`（行政）、`search6`（労働）、`search7`（知財）
- 主なパラメータ：`query1`（いずれかの語を含む）、`query2`（さらに含む語）、`filter[judgeDateMode]`＋`filter[judgeGengoFrom]` など（裁判年月日。元号で指定）、`filter[jikenGengo]`／`[jikenYear]`／`[jikenCode]`／`[jikenNumber]`（事件番号。符号は番号で指定）、`filter[courtName]`、`filter[branchName]`、`filter[jikenName]`、`courtCaseType`、`offset`、`sort`
- 1ページ30件で固定。`offset` は任意の値を指定できる
- **全文検索に該当する裁判例が全区分の合計で2,000件を超えると、結果は返らずエラーの表示になる**（「損害賠償」「憲法」「契約」など）。期間・裁判所・区分で絞っても解消しない。`query2` で語を追加すると、該当が2,000件以下になれば返る
- 複数の区分に載っている裁判例は、検索結果の1行に区分ごとのリンクが並ぶ

### 2. IDから `{N}` は決められない

- `{N}` は2＝最高裁判例、3＝高裁判例、4＝下級裁裁判例、5＝行政事件裁判例、6＝労働事件裁判例、7＝知的財産裁判例、8＝知財高裁裁判例
- `{N}` が合っていなくてもサイトは200を返し、その区分の書式で共通の項目だけを表示する。HTTPの結果からは正しい `{N}` を判定できない（存在しないIDは404）
- 対処：検索結果のリンクから分かった `{N}` をキャッシュしておく。分からないIDは `detail4` で取得し、裁判所名が最高裁なら `detail2`、知財高裁なら `detail8` も取得する
- 自前索引（将来の拡張）を作る場合も、詳細ページを総当たりするのではなく、検索結果の一覧から区分を得るのがよい

### 3. 画像だけのPDFは見つからなかった

- 昭和24年（1949年）から令和8年（2026年）まで、7区分あわせて約75件を処理し、すべて文字を取り出せた。OCRは当面不要
- ただし平成期以前のPDFは、フォントを埋め込まずに既定の文字対応表（CMap。`90msp-RKSJ-H` など）を参照している。pdf.js にCMapを渡さないと文字が1つも取り出せない。日本語のCMap（約630KB）を `assets/cmaps/` に同梱した
- 図表だけのページ（文字が取れないページ）を含む判決はある。該当ページを出力で知らせる
- 知財事件などには左余白に行番号（5、10、15…）があり、本文から取り除く処理を入れた
- 主文は本文より幅を狭くして組まれることが多く、行の右端の位置では文の続きを判断できない。主文の中だけ別の規則でつないでいる
- 和文と半角英数字の間に自動で入るすき間（約1/4文字）が空白として取り出され、「令和 6 年 2 月」のようになるPDFがある。すき間の幅を見て、空白にしないようにした

### 4. 通しの動作

- 検索→詳細→PDF→テキスト化→返却まで動く。649ページ（約49万字）の判決も処理できた（PDFの処理は6秒程度）
- 詳細ページには、全文PDFのほかに添付文書のPDFが付くことがある（別のパスにある）。URLだけ返し、本文化はしていない

### 使ったもの

- TypeScript、公式SDK（`@modelcontextprotocol/sdk`）、`unpdf`（Workersで動く pdf.js）、`node-html-parser`。いずれもバージョンを固定
- テスト：保存したHTML・PDFでの解析テスト（`npm test`）と、週1回の実サイト確認（`.github/workflows/live-check.yml`）

### 残っていること

- `extract_cited_provisions`（引用条文の抽出）
- 添付文書PDFの本文化
- 表や別紙の整形（現状は行ごとにそのまま出る）
- 配布方法（`npx github:…`、`.mcpb`）の確認
- ライセンスの決定

## フェーズ2：リモート化（検討事項）

### 置き場所

Cloudflare Workers（TypeScriptの場合）。

### 利用者の限定

- Cloudflare Access：許可するメールアドレスやドメインを管理画面で指定できる。コードを書かずに済み、手間が最も少ない
- GitHubログイン＋許可リスト：`@cloudflare/workers-oauth-provider` を使う
- APIキー（固定トークン）：簡単だが、誰が使っているかは区別できない
- IPアドレスでの制限は使えない。claude.aiやデスクトップ版のカスタムコネクターは、Anthropicのサーバーから接続するため

### 料金

- 無料プラン：1日10万リクエスト、1回あたりCPU時間10ms、外部アクセス50回/リクエスト、KV書き込み1日1,000回。利用回数は数十人規模なら十分
- 問題はPDF処理のCPU時間。10msでは足りない見込み
- 対処の候補：
  1. Workers AIの `toMarkdown` でPDFを変換する（ほとんどの形式は無料）。日本語の判決での品質は要確認
  2. Workers Paid（月5ドル）にする。CPU時間が既定30秒（最大5分）になり、自前で処理できる
  3. PDF処理だけ別のサービス（Cloud Runなど）で行う
- キャッシュは、書き込み上限の都合でKVよりR2が向いている
- 送信元IPが他の利用者と共有なので、裁判所サイト側で制限される可能性がある。キャッシュとアクセス間隔で対処する

### 避ける方法

PDFのデータをツール結果に埋め込んで返す方法（EmbeddedResourceのblob）は、Claude側で無視されたりエラーになったりする報告があるため使わない。

## 将来の拡張（必要になったら）

- 自前索引：メタデータを全件取得してSQLite（FTS5）で検索する。引用条文の逆引き、年・裁判所別の集計が可能になる
  - 初回取得：9万件規模・3秒間隔で数日（`{N}` の判定次第で増える）
  - 定期取得：既知の最大IDより後を確認するだけなので、1日数十件・1分以内
  - 公開する場合は、メタデータのSQLiteをGitHub Releasesなどで配布し、本文は各自がその都度取得する
- 法令との連携：引用条文を裁判年月日の時点の条文（e-Gov法令API Version2）と結び付ける。2017年4月以降の判決に限られる

## 参考

- 裁判例検索：https://www.courts.go.jp/hanrei/search1/index.html
- e-Gov法令API Version2：https://laws.e-gov.go.jp/api/2/swagger-ui/
- Claude デスクトップ版のローカルMCP：https://support.claude.com/en/articles/10949351
- Claude カスタムコネクター（リモートMCP）：https://support.claude.com/en/articles/11175166
- Claude Code デスクトップ版の設定共有：https://code.claude.com/docs/en/desktop
- Cloudflare Workers の制限：https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare MCPの認可：https://developers.cloudflare.com/agents/model-context-protocol/authorization/
- Workers AI toMarkdown：https://developers.cloudflare.com/workers-ai/features/markdown-conversion/
- 類似：mcp-tw-judgment（台湾の司法院裁判書）https://pypi.org/project/mcp-tw-judgment
