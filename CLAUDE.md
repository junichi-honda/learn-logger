# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

学期・科目単位で学習進捗率を記録し、経過時間と比較する Slack Deno アプリ。単一のショートカットトリガーから全操作（学期作成、科目管理、進捗記録・確認、学期終了）をモーダルで行う。

## Development Commands

```bash
slack run              # ローカル開発サーバー起動
slack deploy           # 本番デプロイ
deno task test         # フォーマットチェック + lint + テスト実行
deno fmt               # フォーマット
deno lint              # lint
deno test --allow-read # テストのみ実行
```

トリガー作成:
```bash
slack trigger create --trigger-def triggers/learn_logger_trigger.ts
```

## Architecture

単一ワークフロー・単一関数アーキテクチャ。1つの `SlackFunction` にすべてのモーダル操作をチェーンしている。

**データフロー**: トリガー → ワークフロー → `run_learn_logger.ts`（メイン関数）

### メイン関数の構造 (`functions/run_learn_logger.ts`)

1つの `SlackFunction` に対して `addViewSubmissionHandler` / `addViewClosedHandler` / `addBlockActionsHandler` をチェーンし、全モーダル遷移を制御する。

- **View builders** (`build*View`): 各モーダルの Block Kit JSON を生成
- **private_metadata**: モーダル間の状態受け渡しに JSON 文字列で使用。`channel`, `semester_id` 等のコンテキストを保持
- **form_seq**: 連続入力時に block_id の一意性を確保するカウンター（`subject_name_block_0`, `subject_name_block_1`...）
- **completeQuietly**: モーダルクローズ時に `functions.completeSuccess` を呼んでワークフローを正常終了させるヘルパー

### Datastores

3つのデータストア。すべて `user_id` でフィルタし、`semester_id` でリレーションする。

| Datastore | Primary Key | 用途 |
|-----------|------------|------|
| Semesters | semester_id | 学期情報（年度、学期、期間、status: active/closed） |
| Subjects | subject_id | 科目情報（科目名、単位数、semester_id で紐付け） |
| Progress | subject_id | 進捗率（subject_id が PK なので科目あたり1レコード、上書き更新） |

### ユーティリティ (`functions/internals/`)

- `constants.ts`: CallbackId, ActionId, MenuAction の定数定義
- `datetime.ts`: JST日付取得、経過率計算、プログレスバーレンダリング。日付はすべて `YYYY-MM-DD` 文字列 + `+09:00` で JST 処理

## Commit Convention

```
Co-Authored-By: Claude <svc-devxp-claude@slack-corp.com>
```
