# 学習進捗ロガー（Learn Logger）

[![Language: English](https://img.shields.io/badge/lang-en-blue.svg)](README.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*他の言語で読む: [English](README.md)*

学期・科目単位で学習の進捗率を記録し、経過時間と比較する Slack アプリです。

## 機能

- 学期の作成・管理（年度、学期区分、開始日・終了日）
- 科目の登録（科目名、単位数）
- 科目ごとの進捗率（%）をモーダルから記録
- 全科目の進捗一覧表示（単位数による加重平均つき）
- 進捗率と経過時間率の比較（プログレスバーで視覚表示）
- 学期の終了と最終レポート生成

## 前提条件

- [Slack CLI](https://api.slack.com/automation/quickstart) がインストール済み
- 有料プランの Slack ワークスペース
- Deno ランタイム

## セットアップ

### ローカルでの実行

```bash
slack run
```

`<CTRL> + C` で停止します。

### トリガーの作成

各ワークフローのトリガーを作成します：

```bash
slack trigger create --trigger-def triggers/semester_setup_trigger.ts
slack trigger create --trigger-def triggers/subject_setup_trigger.ts
slack trigger create --trigger-def triggers/log_progress_trigger.ts
slack trigger create --trigger-def triggers/view_progress_trigger.ts
slack trigger create --trigger-def triggers/semester_close_trigger.ts
```

各コマンドでショートカット URL が発行されます。

### デプロイ

```bash
slack deploy
```

デプロイ後、本番用のトリガーを再作成してください。

## プロジェクト構造

```
learn-logger/
├── datastores/
│   ├── semesters_datastore.ts   # 学期データ（年度、学期、期間、ステータス）
│   ├── subjects_datastore.ts    # 科目データ（科目名、単位数、学期ID）
│   └── progress_datastore.ts    # 進捗データ（進捗率、更新日時）
├── functions/
│   ├── create_semester_function.ts  # 学期作成
│   ├── add_subject_function.ts      # 科目追加
│   ├── log_progress_function.ts     # 進捗記録（モーダル）
│   ├── view_progress_function.ts    # 進捗一覧表示
│   └── close_semester_function.ts   # 学期終了
├── workflows/                   # ワークフロー定義
├── triggers/                    # ショートカットトリガー定義
├── manifest.ts                  # アプリマニフェスト
├── slack.json                   # SDK 依存関係
└── deno.jsonc                   # Deno 設定
```

## 使い方

1. **学期を作成する** — 年度、学期区分（春/秋）、開始日・終了日を登録
2. **科目を追加する** — アクティブな学期に科目名と単位数を登録
3. **進捗を記録する** — 科目を選んで進捗率（0〜100%）を入力
4. **進捗を確認する** — 全科目の進捗をプログレスバー付きで一覧表示
5. **学期を終了する** — アクティブな学期を終了し最終レポートを表示

## 仕組み

- **経過時間率**: `(今日 - 開始日) / (終了日 - 開始日) × 100`（JST）
- **進捗比較**: 進捗率と経過時間率の差分を表示
- **加重平均**: 単位数で重み付けした全体進捗を算出
- **視覚表示**: プログレスバーとステータス（順調 / 予定通り / 遅れ）

## テスト

```bash
deno task test
```

## License

MIT License
