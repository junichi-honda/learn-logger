# 学習進捗ロガー（Learn Logger）

[![Language: English](https://img.shields.io/badge/lang-en-blue.svg)](README.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*他の言語で読む: [English](README.md)*

このSlackアプリは、学習の進捗率を記録して経過日数と比較するためのツールです。

**主な機能**:

- 学習の進捗率（%）をフォームから入力して記録
- 学習期間の経過日数を自動計算（2025/4/1からの経過日数と総日数129日の比率）
- 進捗率と経過日数率を比較して評価するメッセージを表示

## セットアップ

### Slack CLIのインストール

このテンプレートを使用するには、Slack CLIをインストールして設定する必要があります。
詳細なインストール手順は[クイックスタートガイド](https://api.slack.com/automation/quickstart)をご覧ください。

### ローカルでの実行

開発中は、`slack run`コマンドを使用して変更をリアルタイムでワークスペースに反映できます。

```zsh
# アプリをローカルで実行
$ slack run

Connected, awaiting events
```

ローカル実行を停止するには、`<CTRL> + C`でプロセスを終了します。

## トリガーの作成

アプリを使用するには、トリガーを作成する必要があります。トリガーを手動で作成するには、以下のコマンドを使用します：

```zsh
$ slack trigger create --trigger-def triggers/sample_trigger.ts
```

## デプロイ

開発が完了したら、`slack deploy`コマンドでアプリをSlackインフラストラクチャにデプロイします：

```zsh
$ slack deploy
```

## プロジェクト構造

- `datastores/`: データ保存用のデータストア
- `functions/`: アプリのビジネスロジックを含む関数
- `triggers/`: ワークフローの起動条件を定義
- `workflows/`: ユーザーの入力を受け付け、関数を実行するワークフロー
- `manifest.ts`: アプリの設定を含むマニフェストファイル

## 使い方

1. Slackで提供されるショートカットURLをクリックしてアプリを起動
2. フォームに学習の進捗率（%）を入力
3. 送信すると、進捗率と経過日数の比較結果がメッセージとして表示されます

## License

MIT License
