# Project Overview

## Purpose

Floci 上で AWS 互換リソースと将来のサーバーレスアプリ構成をローカル学習・検証する TypeScript サンプル集。

## Current Top-Level Layout

- `cdk/`: Bun 管理の単体 AWS CDK サンプル。
- `full-stack-serverless/`: pnpm workspace のフルスタック用ベースプロジェクト。
- `full-stack-serverless-blue-green/`: pnpm workspace の Blue/Green 用ベースプロジェクト。
- `docs/plans.md`: 2つのモノレポを今後実装するための要件・計画。現在の実装状態ではない。

各領域の現状は `mem:workspace_status`。

## Implemented Infrastructure

3つの CDK ディレクトリは現在同じ雛形。`CdkStack` は次を定義する。

- 可視性タイムアウト300秒の SQS キュー `CdkQueue`。
- DynamoDB `Todos` テーブル。文字列パーティションキー `id`、`PAY_PER_REQUEST`、`RemovalPolicy.DESTROY`。
- Queue名とTodoテーブル名の CloudFormation Output。

Todo テーブル定義の正本は各 CDK ディレクトリの `config/todo-table.json`。CLI CRUD は `scripts/todo.sh`。

## Current Todo Behavior

Todo item は `id`, `title`, `description`, `completed`, `createdAt`, `updatedAt` を保持する。重複 ID 作成と、存在しない ID の更新・削除は DynamoDB 条件式で拒否する。CRUD スクリプトは Floci endpoint とダミー認証情報を固定する。

## Technology

- CDK: TypeScript 5.9、ES2022、NodeNext、AWS CDK v2、Constructs v10、Jest 30、Biome 1.9。
- Monorepos: pnpm 10 workspace (`pkgs/*`)。
- Backend templates: Hono 4 + Node server + TypeScript、現状は `GET /` の Hello Hono のみ。
- Frontend templates: React 19 + Vite 8 + TypeScript、現状は Vite starter UI。
- Shared packages: package manifest のみで実装なし。

## Safety and Known Issues

- Floci: endpoint `http://localhost:4566`, account `000000000000`, region `us-east-1`, dummy credentials only。
- 実 AWS の bootstrap/deploy/destroy は明示依頼なしに実行しない。
- 3つの CDK `package.json` の `diff` は `ckd diff` の誤記。`bunx cdk diff` または `npx cdk diff` を使う。
- Stateful Construct ID `TodoTable` を安易に変更しない。