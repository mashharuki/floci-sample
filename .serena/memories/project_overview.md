# Project Overview

## Purpose

`floci-sample` は、Floci 上で AWS 互換リソースをローカル学習・検証する AWS CDK TypeScript サンプル。現在は SQS キューと DynamoDB Todo テーブルを CDK で管理し、AWS CLI ベースの CRUD スクリプトを提供する。

## Architecture

- `cdk/bin/cdk.ts`: CDK アプリのエントリーポイント。
- `cdk/lib/cdk-stack.ts`: `CdkStack`。可視性タイムアウト300秒の SQS キューと `Todos` DynamoDB テーブルを定義。
- `cdk/config/todo-table.json`: Todo テーブル定義の単一ソース。テーブル名 `Todos`、文字列パーティションキー `id`、`PAY_PER_REQUEST`。
- `cdk/scripts/todo.sh`: `create/get/list/update/delete` を提供。JSON 定義からテーブル名を読み込む。
- `cdk/test/cdk.test.ts`: CDK assertions で SQS、DynamoDB、CloudFormation Output を検証。
- `cdk/scripts/floci-cdk.sh`: CDK/SDK を Floci に向ける。ダミー認証情報、account `000000000000`、region `us-east-1`。
- `cdk/scripts/setup-local-aws.sh`: Floci ヘルスチェック待機。
- `cdk/docker-compose.yml`: `floci/floci:latest` を port `4566` で起動。

## Technology

- TypeScript 5.9、ES2022、NodeNext、strict mode
- AWS CDK v2、Constructs v10
- Bun、Jest 30、ts-jest、Biome 1.9
- Docker Compose、AWS CLI v2、`curl`、`jq`

## Current Behavior

Todo item は `id`, `title`, `description`, `completed`, `createdAt`, `updatedAt` を保持する。重複 ID の作成と、存在しない ID の更新・削除は DynamoDB 条件式で拒否する。CRUD スクリプトは endpoint `http://localhost:4566` とダミー認証情報を固定する。

## Important Notes

- パッケージコマンドは `cdk/` で実行する。
- Floci ローカルフローの正しい region は `us-east-1`。
- `package.json` の `diff` は `ckd diff` という既知の誤記があるため、修正までは `bunx cdk diff` または `npx cdk diff` を使う。
- Stateful Construct ID `TodoTable` を安易に変更しない。論理 ID 変更による置換リスクがある。
- ユーザーの未コミット変更を破棄・上書きしない。