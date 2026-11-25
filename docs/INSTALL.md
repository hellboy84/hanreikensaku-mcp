# 導入の手順

[README](../README.md) の「導入」の続きです。3つの導入のしかたについて、手順、更新のしかた、やめかたをまとめています。

| 使っているAIアシスタント | 導入のしかた | 必要なもの |
|---|---|---|
| **Claudeデスクトップ版** | [.mcpb ファイルを入れる](#claudeデスクトップ版mcpb-ファイルを入れる)（いちばん簡単） | なし |
| Claude Code、Codex など、そのほかのMCPクライアント | [方法A：クローンして使う](#方法aクローンして使う) か [方法B：クローンせずに使う（npx）](#方法bクローンせずに使うnpx) | Node.js と Git |

- .mcpb・方法A・方法Bは、**どれか1つ**を選びます。「更新する」「やめる」の手順は方法ごとに違うので、それぞれの中に書いてあります
- **Claudeデスクトップ版で使うだけなら、最初の「.mcpb ファイルを入れる」だけ読めば足ります**
- Claudeデスクトップ版でも、方法A・Bは使えます（中身を見たい・直したい場合や、.mcpb を入れられない場合）
- 方法Aの手順は、AIに任せることもできます（「[AIに導入を任せる](#aiに導入を任せる)」）
- **すでに方法A・Bで使っている方は、何もしなくて構いません。** これまでどおり動きます。.mcpb に切り替えたい場合は、「[方法AまたはBから切り替える](#方法aまたはbから切り替える)」を見てください

目次：

- [Claudeデスクトップ版：.mcpb ファイルを入れる](#claudeデスクトップ版mcpb-ファイルを入れる)
- [方法A・Bに必要なもの](#方法abに必要なもの)
- [AIに導入を任せる](#aiに導入を任せる)
- [方法A：クローンして使う](#方法aクローンして使う)
- [方法B：クローンせずに使う（npx）](#方法bクローンせずに使うnpx)
- [うまくいかないとき](#うまくいかないとき)

## Claudeデスクトップ版：.mcpb ファイルを入れる

.mcpb は、MCPサーバーを1つのファイルにまとめた、Claudeデスクトップ版の「拡張機能」の形式です。必要なものはすべてファイルの中に入っているので、Node.js や Git を入れたり、設定ファイルを書き換えたりする必要はありません。Windows でも macOS でも、同じファイルを使います。

1. **ダウンロードする。** [hanreikensaku-mcp.mcpb](https://github.com/hellboy84/hanreikensaku-mcp/releases/latest/download/hanreikensaku-mcp.mcpb) をダウンロードします（[Releases](https://github.com/hellboy84/hanreikensaku-mcp/releases/latest) のページにある、最新版のファイルです）
2. **開く。** ダウンロードしたファイルをダブルクリックします。Claudeデスクトップ版が開き、インストールの確認が表示されます。開かないときは、Claudeデスクトップ版の「設定」→「拡張機能」を開き、その画面にファイルをドラッグ＆ドロップします
3. **インストールする。** 表示された内容（名前、説明、ツールの一覧）を確かめて、「インストール」を押します
4. **試す。** 新しいチャットで「安全配慮義務に関する最近の裁判例を探して」のように頼みます。ツールを使ってよいか尋ねられたら、許可します

知っておくこと：

- **インストールのとき、注意が表示されることがあります。** このファイルには開発元の署名を付けていないので、開発元を確認できないという趣旨の注意が出ることがあります。上のリンク（このリポジトリの Releases）から取得したファイルであることを確かめたうえで、進めてください
- **会社や事務所のアカウントでは、入れられないことがあります。** Team・Enterprise プランでは、管理者が拡張機能の追加を制限している場合があります。そのときは管理者に相談するか、[方法A](#方法aクローンして使う)を使ってください
- **Claudeデスクトップ版に入っている Node.js で動きます。** Node.js 22 以上が必要で、Claudeデスクトップ版が古いと動かないことがあります。まずClaudeデスクトップ版を最新にしてください（「[うまくいかないとき](#うまくいかないとき)」も参照）
- **READMEの「[設定](../README.md#設定)」の環境変数は、.mcpb では変えられません。** 既定のまま動きます。変えたい場合は、[方法A](#方法aクローンして使う)を使ってください

### 更新する（.mcpb）

自動では更新されません。新しい版が出たら、上の手順と同じように、新しい .mcpb をダウンロードして開きます。古いものと入れ替わります。取得済みの裁判例のキャッシュは、そのまま引き継がれます。

いま入っている版は、Claudeデスクトップ版の「設定」→「拡張機能」で確かめられます。新しい版が出ているかは、[Releases](https://github.com/hellboy84/hanreikensaku-mcp/releases) で確かめられます。

### やめる（.mcpb）

1. Claudeデスクトップ版の「設定」→「拡張機能」で、「裁判例検索（hanreikensaku-mcp）」をアンインストールする
2. キャッシュのフォルダ `~/.cache/hanreikensaku-mcp`（Windowsは `C:\Users\名前\.cache\hanreikensaku-mcp`）を消す

### 方法AまたはBから切り替える

すでに方法A・Bで、Claudeデスクトップ版に登録している場合の手順です。そのまま使い続けても構いません。

1. 設定ファイル `claude_desktop_config.json` から `"hanrei"` の項目を消す（場所は「[A-3](#a-3-aiアシスタントに登録する)」を参照）。消さずに .mcpb を入れると、同じツールが2組ずつ表示されます
2. Claudeデスクトップ版を完全に終了して、起動し直す
3. 上の手順で .mcpb を入れる
4. 方法Aで取得した `hanreikensaku-mcp` のフォルダは、ほかのクライアント（Claude Code など）で使っていなければ、消して構いません

キャッシュ（`~/.cache/hanreikensaku-mcp`）はどの方法でも共通なので、取得済みのものはそのまま使えます。

## 方法A・Bに必要なもの

.mcpb を使う場合は、この節から先は読まなくて構いません。

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
| [AIに導入を任せる](#aiに導入を任せる) | AIがこのファイルに従って、方法Aで導入する | 方法Aの手順を自分で進めたくない |

## AIに導入を任せる

> **Claudeデスクトップ版で使うだけなら、AIに任せる必要はありません。** 「[.mcpb ファイルを入れる](#claudeデスクトップ版mcpb-ファイルを入れる)」のほうが簡単です。この節は、方法Aの手順（Node.js のインストールから登録まで）をAIに任せたい場合のものです。

パソコン上でコマンドを実行できるAI（Claude Code、Claudeデスクトップ版のCodeモードで「このコンピューター」を選んだ会話 など）に、次のように頼みます。「Claude Code」のところは、使いたいAIアシスタントの名前に変えてください。Node.js や Git が入っていなくても構いません。

```
次のMCPサーバーを、このパソコンの Claude Code で使えるように導入してください。
https://github.com/hellboy84/hanreikensaku-mcp

リポジトリの docs/INSTALL.md にある「導入を行うAIへ」に従ってください。
Node.js や Git など必要なものが入っていなければ、何を入れるのかを説明したうえでインストールしてください。
```

途中で、ソフトのインストールやファイルの書き換えについて許可を求められます。内容を確かめて許可してください。終わったら、AIの案内に従ってAIアシスタントを起動し直します。

### 導入を行うAIへ

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

## 方法A：クローンして使う

### A-1. 取得してビルドする

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

### A-2. 起動できるか確かめる

```bash
node dist/local.js
```

`hanreikensaku-mcp: 起動しました（stdio）` と表示されれば成功です。そのまま待ち受けの状態になるので、Ctrl+C で止めてください。

### A-3. AIアシスタントに登録する

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

### 更新する（方法A）

自動では更新されません。`hanreikensaku-mcp` のフォルダで次の2つを順に実行し、AIアシスタントを起動し直します。

```bash
git pull
```

```bash
npm install
```

### やめる（方法A）

1. 設定ファイルから `"hanrei"` の項目を消す（Claude Code は `claude mcp remove hanrei`）
2. `hanreikensaku-mcp` のフォルダを消す
3. キャッシュのフォルダ `~/.cache/hanreikensaku-mcp`（Windowsは `C:\Users\名前\.cache\hanreikensaku-mcp`）を消す

## 方法B：クローンせずに使う（npx）

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

### 更新する（方法B）

何もしなくて構いません。AIアシスタントを起動し直せば、最新版になります。

### やめる（方法B）

1. 設定ファイルから `"hanrei"` の項目を消す（Claude Code は `claude mcp remove hanrei`）
2. キャッシュのフォルダ `~/.cache/hanreikensaku-mcp`（Windowsは `C:\Users\名前\.cache\hanreikensaku-mcp`）を消す

`npx` が取得したプログラムは npm のキャッシュの中に残りますが、そのままにしておいて差し支えありません。

## うまくいかないとき

導入でつまずいたときの表です。検索の結果やエラーについては、READMEの「[うまくいかないとき](../README.md#うまくいかないとき)」を見てください。

| 症状 | 確かめること |
|---|---|
| .mcpb をダブルクリックしても、Claudeデスクトップ版で開かない | Claudeデスクトップ版の「設定」→「拡張機能」を開き、その画面にファイルをドラッグ＆ドロップする。Claudeデスクトップ版が古い場合は、最新にする |
| .mcpb をインストールできない（許可されていない、などと表示される） | Team・Enterprise プランでは、管理者が拡張機能の追加を制限していることがあります。管理者に相談するか、[方法A](#方法aクローンして使う)を使う |
| .mcpb を入れたのに、ツールが出てこない・エラーになる | Claudeデスクトップ版を最新にする（中に入っている Node.js が22より古いと動きません）。直らなければ、パソコンに Node.js 22 以上を入れたうえで、「設定」→「拡張機能」の詳細設定にある、Claudeデスクトップ版に内蔵の Node.js を使うかどうかの項目を切り替えてみる。それでも動かなければ、[方法A](#方法aクローンして使う)を使う |
| 同じツールが2組ずつ表示される | .mcpb と、設定ファイルの `"hanrei"`（方法A・B）の両方が入っています。どちらかを消す（「[方法AまたはBから切り替える](#方法aまたはbから切り替える)」） |
| 方法A・Bで登録したのに、ツールが出てこない | 設定ファイルのJSONが正しいか（カンマや括弧）。パスがフルパスか。AIアシスタントを完全に終了して起動し直したか |
| Windowsで、設定を書いたのにツールが出てこない | Microsoft Store 版は、別の場所の設定ファイルを読んでいることがあります（「[A-3](#a-3-aiアシスタントに登録する)」にある注意） |
| 方法B（npx）で起動しない | Windowsでは `cmd` を使う書き方を試す（「[方法B](#方法bクローンせずに使うnpx)」の説明）。インターネットにつながっているか。だめなら方法Aを使う |
| `node` が見つからないと言われる | `command` を `node` のフルパスにする |
| `dist/local.js` がない | `hanreikensaku-mcp` のフォルダで `npm install` を実行する |
