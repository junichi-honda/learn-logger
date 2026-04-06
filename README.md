# 学習進捗ロガー（Learn Logger）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

学期・科目単位で学習の進捗率を記録し、経過時間と比較する Slack アプリです。

## 概要

学期と科目を登録し、科目ごとの進捗率をモーダルから記録できます。単位数による加重平均や、経過時間率との比較をプログレスバーで視覚的に確認でき、学習ペースの把握に役立ちます。

## 機能

メインメニュー用のショートカットに加え、進捗記録専用のショートカットも用意しています。

- **学期を作成する** — 年度、学期区分（春/秋）、開始日・終了日を登録
- **科目を追加する** — アクティブな学期に科目名と単位数を登録（連続追加対応）
- **科目を管理する** — 登録済み科目の編集・削除
- **進捗を記録する** —
  科目を選んで進捗率（0〜100%）を入力（複数科目の連続入力対応）
- **進捗を確認する** —
  全科目の進捗をプログレスバー付きで一覧表示（アクティブ学期をデフォルト選択）
- **学期を終了する** — アクティブな学期を終了し最終レポートを生成

## 前提条件

- [Slack CLI](https://api.slack.com/automation/quickstart) がインストール済み
- 有料プランの Slack ワークスペース
- Deno ランタイム

## セットアップ

### インストール

```bash
git clone https://github.com/junichi-honda/learn-logger.git
cd learn-logger
```

### ローカルでの実行

```bash
slack run
```

`<CTRL> + C` で停止します。

### トリガーの作成

```bash
# メインメニュー（全操作）
slack trigger create --trigger-def triggers/learn_logger_trigger.ts

# 進捗記録専用（メニューをスキップして直接記録）
slack trigger create --trigger-def triggers/log_progress_trigger.ts
```

発行されたショートカット URL をチャンネルにブックマークして使用します。

### デプロイ

```bash
slack deploy
```

デプロイ後、本番用のトリガーを再作成してください。

## プロジェクト構造

```
learn-logger/
├── datastores/
│   ├── semesters_datastore.ts       # 学期データ（年度、学期、期間、ステータス）
│   ├── subjects_datastore.ts        # 科目データ（科目名、単位数、学期ID）
│   └── progress_datastore.ts        # 進捗データ（進捗率、更新日時）
├── functions/
│   ├── run_learn_logger.ts          # メイン関数（メニュー表示・全操作のハンドラー）
│   ├── run_log_progress.ts          # 進捗記録専用関数（専用トリガー用）
│   └── internals/
│       ├── constants.ts             # コールバックID・アクションID定数
│       ├── datetime.ts              # 日付・経過率・プログレスバーユーティリティ
│       ├── helpers.ts               # 共通ヘルパー（アクティブ学期取得等）
│       └── log_progress_shared.ts   # 進捗記録の共有ロジック（ビュー・送信・サマリー）
├── workflows/
│   ├── learn_logger.ts              # メインワークフロー
│   └── log_progress.ts              # 進捗記録専用ワークフロー
├── triggers/
│   ├── learn_logger_trigger.ts      # メインメニュー用ショートカットトリガー
│   └── log_progress_trigger.ts      # 進捗記録専用ショートカットトリガー
├── manifest.ts                      # アプリマニフェスト
├── slack.json                       # SDK 依存関係
└── deno.jsonc                       # Deno 設定
```

## 使い方

1. ショートカット URL をクリックしてメインメニューを開く
2. メニューから操作を選択して「選択」を押す
3. 表示されたフォームで操作を実行
4. 各画面の「← ホームに戻る」ボタンでメインメニューに戻れます

### メッセージの送信先

| 操作                                       | 送信先         |
| ------------------------------------------ | -------------- |
| 学期を作成する                             | 実行チャンネル |
| 進捗を記録する                             | 実行チャンネル |
| 学期を終了する                             | 実行チャンネル |
| 科目を追加する / 管理する / 進捗を確認する | 実行者の DM    |

## 仕組み

- **経過時間率**: `(今日 - 開始日) / (終了日 - 開始日) × 100`（JST基準）
- **進捗比較**: 進捗率と経過時間率の差分を表示
- **加重平均**: 単位数で重み付けした全科目の全体進捗を算出
- **視覚表示**: プログレスバーとステータス（順調 / 予定通り / 遅れ）
- **チャンネル通知**:
  進捗記録時に学期期間・科目別進捗・全体進捗をチャンネルに投稿

## Bot スコープ

| スコープ            | 用途                                   |
| ------------------- | -------------------------------------- |
| `commands`          | ショートカットの処理                   |
| `chat:write`        | メッセージ送信（DM含む）               |
| `chat:write.public` | パブリックチャンネルへのメッセージ送信 |
| `datastore:read`    | データストアの読み取り                 |
| `datastore:write`   | データストアへの書き込み               |

## テスト

```bash
deno task test
```

## ライセンス

MIT License — 詳細は [LICENSE](LICENSE) を参照してください。

## 参考リンク

- [Slack オートメーションプラットフォーム](https://api.slack.com/automation)
- [Deno Slack SDK ドキュメント](https://api.slack.com/automation/quickstart)
- [データストアガイド](https://api.slack.com/automation/datastores)
