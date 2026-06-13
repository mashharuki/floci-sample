# Core

`floci-sample` は Floci 上で AWS 互換リソースとサーバーレス構成を学習・検証するサンプル集。

- リポジトリ全体と現在実装済みの機能: `mem:project_overview`
- 3つの作業領域の状態・差分・パッケージ構成: `mem:workspace_status`
- セットアップ、CDK、Todo CRUD、モノレポのコマンド: `mem:suggested_commands`
- TypeScript/CDK/shell/モノレポの規約とローカル AWS 安全ルール: `mem:style_and_conventions`
- `docs/plans.md` にある未実装のフルスタック/Blue-Green要件: `mem:roadmap/full_stack_serverless`
- タスク完了時の必須確認: `mem:task_completion`

Floci 操作では実 AWS を避け、ローカル専用ラッパーまたは endpoint `http://localhost:4566` を明示する。実装済みの事実と計画中の要件を混同しない。