# Core

`floci-sample` は Floci 上で AWS 互換リソースを学習・検証する AWS CDK TypeScript サンプル。

- 全体構成・現在のリソース: `mem:project_overview`
- セットアップ、CDK、Todo CRUD、検証コマンド: `mem:suggested_commands`
- TypeScript/CDK/shell の実装規約とローカル AWS 安全ルール: `mem:style_and_conventions`
- タスク完了時の必須確認: `mem:task_completion`

主要作業ディレクトリは `cdk/`。Floci 操作では実 AWS を避け、必ずローカル専用ラッパーまたは `http://localhost:4566` を明示する。