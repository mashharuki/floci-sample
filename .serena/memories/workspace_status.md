# Workspace Status

## `cdk/`

Bun 管理の実装済み Floci CDK サンプル。SQS + DynamoDB Todo テーブル、Jest assertions、Floci CDK wrapper、AWS CLI Todo CRUD を含む。`bun.lock` あり。

## `full-stack-serverless/`

pnpm 10 workspace。packages は `pkgs/cdk`, `pkgs/backend`, `pkgs/frontend`, `pkgs/shared`。

現状:
- `pkgs/cdk` はルート `cdk/` と同じ SQS + DynamoDB 雛形。
- backend は Hono Node server の `GET /` Hello World のみ。
- frontend は React/Vite starter のみ。
- shared は manifest のみ。
- lockfile と `node_modules` はない。
- S3/API Gateway/Lambda/CloudFront/OpenAPI/Zod/Todo UI は未実装。

今後の要件は `mem:roadmap/full_stack_serverless`。

## `full-stack-serverless-blue-green/`

`full-stack-serverless/` と同じ pnpm workspace 構成・同じ雛形コード。名称以外の Blue/Green 固有実装はまだない。

未実装:
- Blue/Green 別 S3、API Gateway、Lambda stack。
- 共通 DynamoDB への接続。
- トラフィック切替・デプロイ戦略。

## Important Distinction

`docs/plans.md` は実装計画。メモリや回答で、そこにある構成を現行機能として扱わない。コード変更時は対象ディレクトリを最初に特定し、他のコピーへ機械的に同期しない。