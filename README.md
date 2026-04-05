# claude-cli-bridge

OpenClaw から Claude CLI を呼び出すためのブリッジプラグインです。  
人が OpenClaw に依頼し、**必要なときだけ** OpenClaw 側で `claude` CLI を起動して処理させる、という使い方を想定しています。

このリポジトリは日本語ベースです。英語版の簡易説明は `README_en.md` を参照してください。

## これは何か

`claude-cli-bridge` は、Claude Code CLI を OpenClaw のツールとして扱うためのプラグインです。

ユーザーが OpenClaw に対して、たとえば次のように依頼したときに使われます。

- 「Claude でこのコードをレビューして」
- 「この実装を Claude に考えさせて」
- 「複雑なので Claude CLI を起動して進めて」
- 「長めの分析を Claude に回して」

つまり、**人が直接このプラグインを操作するというより、OpenClaw が裏側で Claude CLI を使うための部品**です。

## どう使われるか（ユーザー視点）

このプラグインを入れると、ユーザーは普段どおり OpenClaw に話しかけるだけでOKです。

たとえば:

- 「このバグ、Claude で深めに見て」
- 「このファイル群を Claude に整理させて」
- 「この設計案を Claude でレビューして」

すると OpenClaw 側で必要に応じて:

1. `claude_start` で Claude CLI を起動
2. `claude_send` で指示を送信
3. 必要なら複数ターンやり取り
4. 終わったら `claude_stop` で停止

という流れが内部で実行されます。

## どういう時に便利か

このプラグインは、特に次のような場面で役立ちます。

- Claude 品質の推論や長文整理を使いたい
- 複雑なコード実装やレビューを Claude に任せたい
- OpenClaw から Claude CLI を毎回手動起動せず使いたい
- 1回きりではなく、同じ Claude セッションで数ターンやり取りしたい

## 導入方法

### 1. プラグインを配置する

このディレクトリを OpenClaw のプラグインディレクトリに配置します。

例:

```text
~/.openclaw/plugins/claude-cli-bridge/
```

## ディレクトリ構成

```text
claude-cli-bridge/
├── openclaw.plugin.json
├── package.json
├── index.js
└── skills/
    └── claude-assist/
        └── SKILL.md
```

### 2. OpenClaw から読み込める状態にする

OpenClaw 側のプラグイン設定に応じて有効化します。  
読み込み方法は OpenClaw のバージョンや構成に依存するため、利用中の環境に合わせて設定してください。

### 3. Claude CLI を使える状態にする

このプラグインは `claude` コマンドを実行するため、事前に Claude CLI が入っていて `PATH` から見えている必要があります。

必要条件:

- OpenClaw が動作していること
- `claude` CLI がインストール済みであること
- Claude CLI が `stream-json` 入出力を利用できること

## OpenClaw 経由での利用イメージ

### 例1: コードレビューを頼む

ユーザー:

> この変更を Claude でレビューして

OpenClaw 内部:

- `claude_start`
- `claude_send` にレビュー依頼を渡す
- 返答を受けて必要なら追加質問
- 完了後に `claude_stop`

### 例2: 複雑な実装を Claude に回す

ユーザー:

> この処理、Claude に考えさせながら進めて

OpenClaw は必要に応じて Claude CLI セッションを維持しながら複数ターンで処理できます。

### 例3: 長文の整理や分析

ユーザー:

> この仕様書を Claude で要約して、論点も整理して

Claude に長文処理を任せたいときの裏側コンポーネントとして使えます。

## エージェント / 実装者向けの使い方

この節は、OpenClaw 側でこのプラグインを呼ぶ人向けです。

### `claude_start`
Claude CLI を起動します。

主なパラメータ:

- `systemPrompt`: セッションのシステムプロンプト
- `model`: 使用モデル名
- `idleTimeoutMinutes`: アイドル時に自動停止するまでの分数

例:

```json
{
  "systemPrompt": "あなたは補助AIです。簡潔かつ正確に答えてください。",
  "model": "claude-opus-4-6",
  "idleTimeoutMinutes": 10
}
```

### `claude_send`
起動中セッションにメッセージを送ります。

例:

```json
{
  "message": "このコードの問題点をレビューして"
}
```

### `claude_status`
現在の状態を確認します。

確認できる内容:

- 稼働中か停止中か
- セッションID
- アイドル時間
- 自動停止設定

### `claude_stop`
実行中の Claude CLI プロセスを停止します。

## ツール一覧

- `claude_start`
- `claude_send`
- `claude_status`
- `claude_stop`

## 設定項目

`openclaw.plugin.json` では、以下の設定を受け取れます。

- `systemPrompt` — Claude CLI セッション用のシステムプロンプト
- `idleTimeoutMinutes` — 無操作時に自動停止するまでの分数
- `model` — 使用する Claude モデル名

## 含まれるファイル

- `index.js`  
  プラグイン本体です。Claude CLI プロセスの起動、JSON ストリーム処理、停止、OpenClaw ツール登録を行います。

- `openclaw.plugin.json`  
  プラグインのメタデータと設定スキーマです。

- `skills/claude-assist/SKILL.md`  
  Claude CLI をどういう場面で使うか、いつ停止するかなどの運用ガイドです。

## 実装メモ

- CLI は `--input-format stream-json` / `--output-format stream-json` で起動
- セッション永続化は無効化（`--no-session-persistence`）
- 標準出力を1行ずつ JSON として読み取り、`assistant` / `result` イベントを集約
- 一定時間無操作の場合は自動停止
- すでに起動中の場合は二重起動を防止

## 注意事項

- このプラグインは `claude` CLI の挙動に依存します
- Claude CLI 側の仕様変更により動作しなくなる可能性があります
- 長時間の放置を避けるため、不要になったら `claude_stop` で停止する運用を推奨します
- 認証情報や API キーのような秘密情報は、このリポジトリには含めない前提です

## ライセンス

MIT License

詳細は `LICENSE` を参照してください。

## English README

英語版は `README_en.md` を参照してください。
