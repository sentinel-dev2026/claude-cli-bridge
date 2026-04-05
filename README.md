# claude-cli-bridge

OpenClaw 向けの Claude CLI ブリッジプラグインです。  
`claude` CLI を必要なときだけ起動し、`stream-json` 経由で OpenClaw から対話・状態確認・停止を行えます。

日本語ベースのプラグインなので、README も日本語を主として記載しています。英語版は `README_en.md` を参照してください。

## 概要

このプラグインは、Claude Code CLI を OpenClaw から扱いやすくするための薄いブリッジです。

以下のような用途を想定しています。

- Claude CLI をオンデマンドで起動したい
- 1つの CLI セッションに対して複数ターンやり取りしたい
- 一定時間アイドルなら自動停止したい
- OpenClaw のツールとして Claude を呼び出したい

## できること

- `claude_start` で Claude CLI プロセスを起動
- `claude_send` で実行中セッションにメッセージ送信
- `claude_status` で状態確認
- `claude_stop` で明示停止
- アイドルタイムアウトによる自動停止
- system prompt / model の指定

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

## 含まれるファイル

- `index.js`  
  プラグイン本体です。Claude CLI プロセスの起動、JSON ストリーム処理、停止、OpenClaw ツール登録を行います。

- `openclaw.plugin.json`  
  プラグインのメタデータと設定スキーマです。

- `skills/claude-assist/SKILL.md`  
  Claude CLI をどういう場面で使うか、いつ停止するかなどの運用ガイドです。

## 必要条件

- OpenClaw が動作していること
- `claude` CLI がインストール済みで、`PATH` から実行できること
- Claude CLI が `stream-json` 入出力を利用できること

## 使い方

### 1. プラグインを配置する

OpenClaw のプラグインディレクトリにこのフォルダを配置します。

### 2. プラグインを読み込む

OpenClaw 側のプラグイン設定に応じて読み込みます。  
設定方法は利用している OpenClaw 環境に合わせてください。

### 3. ツールを呼び出す

#### `claude_start`
Claude CLI を起動します。

指定できる主なパラメータ:

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

#### `claude_send`
起動中の Claude CLI セッションにメッセージを送ります。

例:

```json
{
  "message": "このコードの問題点をレビューして"
}
```

#### `claude_status`
現在のプロセス状態、セッションID、アイドル時間、自動停止設定を確認します。

#### `claude_stop`
実行中の Claude CLI を停止します。

## ツール一覧

- `claude_start`
- `claude_send`
- `claude_status`
- `claude_stop`

## 設定項目

`openclaw.plugin.json` では、以下の設定を受け取れるようになっています。

- `systemPrompt` — Claude CLI セッション用のシステムプロンプト
- `idleTimeoutMinutes` — 無操作時に自動停止するまでの分数
- `model` — 使用する Claude モデル名

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
