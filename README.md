# hanreikensaku-mcp

裁判所ウェブサイトの「[裁判例検索](https://www.courts.go.jp/hanrei/search1/index.html)」を、ClaudeなどのAIアシスタントから検索・取得できるようにするMCPサーバーです。

*An MCP server that lets AI assistants search Japanese court decisions on courts.go.jp and read their full text (extracted from the official PDFs).*

- 裁判例を、キーワード・事件番号・裁判年月日・裁判所名などで検索できます
- 判決の全文はPDFでしか公開されていませんが、PDFから文字を取り出し、読みやすく整えて返します
- 自分のパソコンの中で動きます。アカウントの登録やAPIキーは要りません

裁判所とは関係のない、個人が作った非公式のツールです。

> **Claudeデスクトップ版なら、[.mcpb ファイル](https://github.com/hellboy84/hanreikensaku-mcp/releases/latest/download/hanreikensaku-mcp.mcpb)をダウンロードして開くだけで使えます。** Node.js のインストールも、設定ファイルの書き換えも要りません。手順は「[導入](#導入)」にあります。

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

### 導入のしかたを選ぶ

使っているAIアシスタントによって、導入のしかたが違います。

| 使っているAIアシスタント | 導入のしかた | 必要なもの |
|---|---|---|
| **Claudeデスクトップ版** | [.mcpb ファイルを入れる](#claudeデスクトップ版mcpb-ファイルを入れる)（いちばん簡単） | なし |
| Claude Code、Codex など、そのほかのMCPクライアント | [方法A：クローンして使う](#方法aクローンして使う) か [方法B：クローンせずに使う（npx）](#方法bクローンせずに使うnpx) | Node.js と Git |

- .mcpb・方法A・方法Bは、**どれか1つ**を選びます。「更新する」「やめる」の手順は方法ごとに違うので、それぞれの中に書いてあります
- Claudeデスクトップ版でも、方法A・Bは使えます（中身を見たい・直したい場合や、.mcpb を入れられない場合）
- **すでに方法A・Bで使っている方は、何もしなくて構いません。** これまでどおり動きます。.mcpb に切り替えたい場合は、「[方法AまたはBから切り替える](#方法aまたはbから切り替える)」を見てください

### Claudeデスクトップ版：.mcpb ファイルを入れる

.mcpb は、MCPサーバーを1つのファイルにまとめた、Claudeデスクトップ版の「拡張機能」の形式です。必要なものはすべてファイルの中に入っているので、Node.js や Git を入れたり、設定ファイルを書き換えたりする必要はありません。Windows でも macOS でも、同じファイルを使います。

1. **ダウンロードする。** [hanreikensaku-mcp.mcpb](https://github.com/hellboy84/hanreikensaku-mcp/releases/latest/download/hanreikensaku-mcp.mcpb) をダウンロードします（[Releases](https://github.com/hellboy84/hanreikensaku-mcp/releases/latest) のページにある、最新版のファイルです）
2. **開く。** ダウンロードしたファイルをダブルクリックします。Claudeデスクトップ版が開き、インストールの確認が表示されます。開かないときは、Claudeデスクトップ版の「設定」→「拡張機能」を開き、その画面にファイルをドラッグ＆ドロップします
3. **インストールする。** 表示された内容（名前、説明、ツールの一覧）を確かめて、「インストール」を押します
4. **試す。** 新しいチャットで「安全配慮義務に関する最近の裁判例を探して」のように頼みます。ツールを使ってよいか尋ねられたら、許可します

知っておくこと：

- **インストールのとき、注意が表示されることがあります。** このファイルには開発元の署名を付けていないので、開発元を確認できないという趣旨の注意が出ることがあります。上のリンク（このリポジトリの Releases）から取得したファイルであることを確かめたうえで、進めてください
- **会社や事務所のアカウントでは、入れられないことがあります。** Team・Enterprise プランでは、管理者が拡張機能の追加を制限している場合があります。そのときは管理者に相談するか、方法Aを使ってください
- **Claudeデスクトップ版に入っている Node.js で動きます。** Node.js 22 以上が必要で、Claudeデスクトップ版が古いと動かないことがあります。まずClaudeデスクトップ版を最新にしてください（「[うまくいかないとき](#うまくいかないとき)」も参照）
- **「[設定](#設定)」の環境変数は、.mcpb では変えられません。** 既定のまま動きます。変えたい場合は、方法Aを使ってください

#### 更新する（.mcpb）

自動では更新されません。新しい版が出たら、上の手順と同じように、新しい .mcpb をダウンロードして開きます。古いものと入れ替わります。取得済みの裁判例のキャッシュは、そのまま引き継がれます。

いま入っている版は、Claudeデスクトップ版の「設定」→「拡張機能」で確かめられます。新しい版が出ているかは、[Releases](https://github.com/hellboy84/hanreikensaku-mcp/releases) で確かめられます。

#### やめる（.mcpb）

1. Claudeデスクトップ版の「設定」→「拡張機能」で、「裁判例検索（hanreikensaku-mcp）」をアンインストールする
2. キャッシュのフォルダ `~/.cache/hanreikensaku-mcp`（Windowsは `C:\Users\名前\.cache\hanreikensaku-mcp`）を消す

#### 方法AまたはBから切り替える

すでに方法A・Bで、Claudeデスクトップ版に登録している場合の手順です。そのまま使い続けても構いません。

1. 設定ファイル `claude_desktop_config.json` から `"hanrei"` の項目を消す（場所は「[A-3](#a-3-aiアシスタントに登録する)」を参照）。消さずに .mcpb を入れると、同じツールが2組ずつ表示されます
2. Claudeデスクトップ版を完全に終了して、起動し直す
3. 上の手順で .mcpb を入れる
4. 方法Aで取得した `hanreikensaku-mcp` のフォルダは、ほかのクライアント（Claude Code など）で使っていなければ、消して構いません

キャッシュ（`~/.cache/hanreikensaku-mcp`）はどの方法でも共通なので、取得済みのものはそのまま使えます。

### 方法A・Bに必要なもの

.mcpb を使う場合は、この節は読み飛ばしてください。

- [Node.js](https://nodejs.org/) 22 以上（`node --version` で確認できます）
- [Git](https://git-scm.com/)（`git --version` で確認できます）
- MCPに対応したAIアシスタント（Claude Code、Claudeデスクトップ版 など）

Node.js や Git が入っていない場合は、それぞれの公式サイトのインストーラーか、次のコマンドで入れられます。入れたあとは、ターミナルを開き直してください。

| OS | Node.js | Git |
|---|---|---|
| Windows | `winget install OpenJS.NodeJS.LTS` | `winget install Git.Git` |
| macOS（[Homebrew](https://brew.sh/)） | `brew install node` | `brew install git` |

方法A・Bの違いは、次のとおりです。

| 方法 | どうなるか | 向いている場合 |
|---|---|---|
| [方法A：クローンして使う](#方法aクローンして使う) | パソコンのフォルダーに取得してビルドする。更新は自分で行う | 確実に動かしたい。中身を見たい・直したい |
| [方法B：クローンせずに使う（npx）](#方法bクローンせずに使うnpx) | 設定を書くだけ。起動のたびに最新版を確認して自動で更新する | 手軽に試したい |
| [AIに導入を任せる](#aiに導入を任せる) | AIがこのREADMEに従って、方法Aで導入する | 方法Aの手順を自分で進めたくない |

### AIに導入を任せる

> **Claudeデスクトップ版で使うだけなら、AIに任せる必要はありません。** 「[.mcpb ファイルを入れる](#claudeデスクトップ版mcpb-ファイルを入れる)」のほうが簡単です。この節は、方法Aの手順（Node.js のインストールから登録まで）をAIに任せたい場合のものです。

パソコン上でコマンドを実行できるAI（Claude Code、Claudeデスクトップ版のCodeモードで「このコンピューター」を選んだ会話 など）に、次のように頼みます。「Claude Code」のところは、使いたいAIアシスタントの名前に変えてください。Node.js や Git が入っていなくても構いません。

```
次のMCPサーバーを、このパソコンの Claude Code で使えるように導入してください。
https://github.com/hellboy84/hanreikensaku-mcp

READMEの「AIに導入を任せる」に従ってください。
Node.js や Git など必要なものが入っていなければ、何を入れるのかを説明したうえでインストールしてください。
```

途中で、ソフトのインストールやファイルの書き換えについて許可を求められます。内容を確かめて許可してください。終わったら、AIの案内に従ってAIアシスタントを起動し直します。

#### 導入を行うAIへ

**最初に、どのAIアシスタントで使うのかを確かめてください。**

- **Claudeデスクトップ版のチャットで使う場合は、.mcpb を案内する。** 方法Aで導入するのは、利用者が方法Aを望んでいるとき、または .mcpb を入れられなかったときだけにする
  - 利用者に、`https://github.com/hellboy84/hanreikensaku-mcp/releases/latest/download/hanreikensaku-mcp.mcpb` をダウンロードして、ダブルクリックするよう伝える（「[.mcpb ファイルを入れる](#claudeデスクトップ版mcpb-ファイルを入れる)」の手順）。ダウンロードまではAIが行ってもよいが、インストールの確認の画面は利用者が自分で操作する
  - Node.js や Git は入れない。`claude_desktop_config.json` も書き換えない
  - `claude_desktop_config.json` にすでに `"hanrei"` の項目がある場合は、方法A・Bで導入済みである。そのまま使えること、.mcpb に切り替えるならこの項目を消す必要があること（消さないとツールが重複する）を伝え、どちらにするかを利用者に決めてもらう
- **それ以外（Claude Code、Codex など）の場合は、次の順に方法Aで導入する。**

1. **環境を確かめる。** OS、`node --version`（22以上が必要）、`git --version`。足りないものは、何を入れるのかを利用者に伝えてから入れる（上の「方法A・Bに必要なもの」の表）。入れた直後は、いまのシェルにPATHが反映されていないことがある。新しいシェルを開くか、フルパスで実行する
2. **置き場所に、直接取得する。** 置き場所は、利用者のホームフォルダーの直下にする（例：`C:\Users\名前\hanreikensaku-mcp`）。次のように取得先を指定して実行する（`$HOME` はホームフォルダーを指し、bash でも PowerShell でも使える）
   ```
   git clone https://github.com/hellboy84/hanreikensaku-mcp.git "$HOME/hanreikensaku-mcp"
   ```
   - 別の場所に取得してから移動する、という進め方はしない。フォルダーの移動や削除は、AIの安全確認で止められることがある
   - すでに別の場所に取得してしまった場合は、動かさずにそのまま進めてよい。どこに置いても動く（以降の手順では、その場所のフルパスを使う）
   - 「ドキュメント」や「デスクトップ」には置かない。Windowsでは OneDrive で同期されていることが多く、大量のファイル（`node_modules`）が同期の対象になってしまう
3. **ビルドする。** 取得したフォルダーに移動して `npm install` を実行し、`dist/local.js` ができたことを確かめる。WindowsのPowerShellで `npm` がスクリプトの実行ポリシーにより止められた場合は、`npm.cmd` を使う
4. **起動を確かめる。** `node dist/local.js` を実行し、`hanreikensaku-mcp: 起動しました（stdio）` と表示されることを確かめる。待ち受けの状態になり自分では終了しないので、表示を確かめたら止める
5. **登録先を間違えない。** Claude Code には `claude mcp add` で登録する（「A-3」を参照）。これは Claude Code 用の登録で、Claudeデスクトップ版のチャットには反映されない。方法AでClaudeデスクトップ版のチャットに登録する場合は、設定ファイル `claude_desktop_config.json` に書く
6. **フルパスで書く。** 設定ファイルに書く場合、`command` には `node` のフルパス、`args` には `dist/local.js` のフルパスを書く。相対パスや `~` は使わない。Windowsでは、JSONの中の `\` を `\\` と書く
7. **設定ファイルを上書きしない。** 既存の内容を読み、`mcpServers` に `hanrei` を足す。書き換える前に控えを取り、書いたあとJSONとして正しいことを確かめる
8. **Windowsで `claude_desktop_config.json` に書く場合は、場所を2か所とも確かめる。** 「A-3」の「Claudeデスクトップ版」にある注意を参照
9. **最後に、利用者に次のことを伝える。** AIアシスタントを完全に終了して起動し直す必要があること（その方法も）。新しいチャットで「安全配慮義務に関する最近の裁判例を探して」のように頼めば確かめられること。どこに置いたか
10. **うまくいかないときは、無理に進めない。** 何が起きたかを利用者に伝える

### 方法A：クローンして使う

#### A-1. 取得してビルドする

置き場所はどこでも動きますが、ホームフォルダーの直下（例：`C:\Users\名前`、`/Users/名前`）をおすすめします。Windowsの「ドキュメント」や「デスクトップ」は、OneDrive で同期されていることが多いので避けてください。あとから移動すると設定の書き直しが必要になるので、最初に場所を決めます。

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

#### A-2. 起動できるか確かめる

```bash
node dist/local.js
```

`hanreikensaku-mcp: 起動しました（stdio）` と表示されれば成功です。そのまま待ち受けの状態になるので、Ctrl+C で止めてください。

#### A-3. AIアシスタントに登録する

登録には、次の2つの**フルパス**が必要です。

| 必要なもの | 調べ方 | 例 |
|---|---|---|
| `node` の場所 | macOS・Linux：`which node`、Windows：`where node` | `/usr/local/bin/node` |
| `dist/local.js` の場所 | `hanreikensaku-mcp` のフォルダで `pwd`（Windowsは `cd`）を実行し、後ろに `/dist/local.js` を付ける | `/Users/you/hanreikensaku-mcp/dist/local.js` |

**Claudeデスクトップ版**

Claudeデスクトップ版では、設定ファイルを書かずに済む「[.mcpb ファイルを入れる](#claudeデスクトップ版mcpb-ファイルを入れる)」のほうが簡単です。方法Aで登録する場合は、次のようにします。

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
- 書いたあと、Claudeデスクトップ版を**完全に終了して**起動し直します。ウィンドウを閉じるだけでは終了しません。Windowsは画面右下の通知領域にあるClaudeのアイコンを右クリックして終了、macOSは Cmd+Q です
- **Windowsでの注意**：Microsoft Store から入れたClaudeデスクトップ版は、上の場所ではなく `%LOCALAPPDATA%\Packages\Claude_…\LocalCache\Roaming\Claude\claude_desktop_config.json`（`Claude_` で始まるフォルダーの中）を読んでいることがある、と報告されています。書いたのにツールが出てこないときは、こちらにも同じ内容を書いてください

**Claude Code**

```bash
claude mcp add hanrei -- node /Users/you/hanreikensaku-mcp/dist/local.js
```

パスは自分の環境のものに置き換えます。登録できたかは `claude mcp list` で確認できます。これは Claude Code 用の登録で、Claudeデスクトップ版のチャットには反映されません。

**そのほかのMCPクライアント**

stdio（標準入出力）で動くMCPサーバーです。起動コマンドに `node`、引数に `dist/local.js` のフルパスを指定してください。

#### 更新する（方法A）

自動では更新されません。`hanreikensaku-mcp` のフォルダで次の2つを順に実行し、AIアシスタントを起動し直します。

```bash
git pull
```

```bash
npm install
```

#### やめる（方法A）

1. 設定ファイルから `"hanrei"` の項目を消す（Claude Code は `claude mcp remove hanrei`）
2. `hanreikensaku-mcp` のフォルダを消す
3. キャッシュのフォルダ `~/.cache/hanreikensaku-mcp`（Windowsは `C:\Users\名前\.cache\hanreikensaku-mcp`）を消す

### 方法B：クローンせずに使う（npx）

フォルダーを自分で用意せず、設定を書くだけで使う方法です。AIアシスタントがこのサーバーを起動するたびに、`npx` がGitHubで最新版を確認し、初回と更新があったときは取得とビルドを行います。

方法Aとの違い：

- 起動のたびにインターネット接続が必要です。初回と更新があったときは、起動に少し時間がかかります
- いつも最新版になります。更新の時期を自分で決めることはできません
- Node.js と Git が必要な点は同じです

**Claudeデスクトップ版**

設定ファイルの場所と書き方の注意は、方法Aの「A-3」と同じです。

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

Windowsでは、この書き方で起動しないことがあります。その場合は `"command": "cmd"`、`"args": ["/c", "npx", "-y", "github:hellboy84/hanreikensaku-mcp"]` としてください。それでも動かなければ、方法Aを使ってください。

**Claude Code**

```bash
claude mcp add hanrei -- npx -y github:hellboy84/hanreikensaku-mcp
```

#### 更新する（方法B）

何もしなくて構いません。AIアシスタントを起動し直せば、最新版になります。

#### やめる（方法B）

1. 設定ファイルから `"hanrei"` の項目を消す（Claude Code は `claude mcp remove hanrei`）
2. キャッシュのフォルダ `~/.cache/hanreikensaku-mcp`（Windowsは `C:\Users\名前\.cache\hanreikensaku-mcp`）を消す

`npx` が取得したプログラムは npm のキャッシュの中に残りますが、そのままにしておいて差し支えありません。

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

方法A・Bで登録したClaudeデスクトップ版では、設定ファイルの `"hanrei"` の中に `"env": { "HANREI_CACHE_DIR": "/path/to/cache" }` のように書きます。.mcpb で入れた場合は変えられません（既定のまま動きます）。

## うまくいかないとき

| 症状 | 確かめること |
|---|---|
| .mcpb をダブルクリックしても、Claudeデスクトップ版で開かない | Claudeデスクトップ版の「設定」→「拡張機能」を開き、その画面にファイルをドラッグ＆ドロップする。Claudeデスクトップ版が古い場合は、最新にする |
| .mcpb をインストールできない（許可されていない、などと表示される） | Team・Enterprise プランでは、管理者が拡張機能の追加を制限していることがあります。管理者に相談するか、方法Aを使う |
| .mcpb を入れたのに、ツールが出てこない・エラーになる | Claudeデスクトップ版を最新にする（中に入っている Node.js が22より古いと動きません）。直らなければ、パソコンに Node.js 22 以上を入れたうえで、「設定」→「拡張機能」の詳細設定にある、Claudeデスクトップ版に内蔵の Node.js を使うかどうかの項目を切り替えてみる。それでも動かなければ、方法Aを使う |
| 同じツールが2組ずつ表示される | .mcpb と、設定ファイルの `"hanrei"`（方法A・B）の両方が入っています。どちらかを消す（「[方法AまたはBから切り替える](#方法aまたはbから切り替える)」） |
| AIアシスタントにツールが出てこない（方法A・B） | 設定ファイルのJSONが正しいか（カンマや括弧）。パスがフルパスか。AIアシスタントを完全に終了して起動し直したか |
| Windowsで、設定を書いたのにツールが出てこない | Microsoft Store 版は、別の場所の設定ファイルを読んでいることがあります（方法Aの「A-3」にある注意） |
| 方法B（npx）で起動しない | Windowsでは `cmd` を使う書き方を試す（方法Bの説明）。インターネットにつながっているか。だめなら方法Aを使う |
| `node` が見つからないと言われる | `command` を `node` のフルパスにする |
| `dist/local.js` がない | `hanreikensaku-mcp` のフォルダで `npm install` を実行する |
| 検索がエラーになる（2000件を超えました） | 上の「全文検索には2,000件の上限があります」を参照 |
| 以前は動いていたのに、検索や取得が失敗する | 裁判所サイトの構成が変わった可能性があります。.mcpb なら「更新する（.mcpb）」、方法Aなら「更新する（方法A）」を試し、直らなければIssueでお知らせください |

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
manifest.json         .mcpb（Claudeデスクトップ版向けの配布ファイル）の説明書き
scripts/              .mcpb を作る・確かめるためのスクリプト
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

### .mcpb を作る

```bash
npm run pack:mcpb
```

`build/hanreikensaku-mcp.mcpb` ができます。実行に必要なもの（`manifest.json`、`dist/`、`assets/`、実行時の依存だけの `node_modules/`）を `build/mcpb/` に集め、[mcpb](https://github.com/modelcontextprotocol/mcpb) で1つのファイルにまとめています。

```bash
npm run smoke:mcpb
```

作った .mcpb を展開し、中身だけで起動できること、同梱のCMapでPDFから文字を取り出せることを確かめます。裁判所サイトにはアクセスしません。

### 新しい版を出す

1. `package.json`・`manifest.json`・`src/core/tools.ts`（`SERVER_VERSION`）の版を、同じ番号に上げる（そろっていないと `npm test` が失敗します）
2. main に入れたあと、`v` を付けたタグ（例：`v0.2.0`）を打ってプッシュする
3. GitHub Actions（`.github/workflows/release.yml`）が .mcpb を作り、[Releases](https://github.com/hellboy84/hanreikensaku-mcp/releases) に添付する

方法B（npx）の利用者には、main に入った時点で変更が届きます。.mcpb の利用者には、Releases から新しいファイルを取得して入れ直してもらう必要があります。

開発とテストは Linux（Node.js 22）で行っています。WindowsとmacOSでの動作は、作者の側では確認できていません。動いた・動かなかったの報告を歓迎します。

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
