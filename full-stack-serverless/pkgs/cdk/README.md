# Floci CDK Sample

Floci 上に AWS CDK で SQS キューと DynamoDB の Todo テーブルを作成する
TypeScript サンプルです。

## 必要なツール

- Bun
- Docker Compose
- AWS CLI v2
- `jq`

## Floci へのデプロイ

```bash
bun install
bun run floci:up
bun run floci:setup
bun run floci:cdk:bootstrap
bun run floci:cdk:deploy
```

CDK ラッパーは以下のローカル設定を使用します。

- endpoint: `http://localhost:4566`
- account: `000000000000`
- region: `us-east-1`
- credentials: ダミー値

Todo テーブルの定義元は
[`config/todo-table.json`](config/todo-table.json) です。テーブル名は `Todos`、
パーティションキーは文字列型の `id`、課金モードはオンデマンドです。

## Todo CRUD

CRUD スクリプトもテーブル定義 JSON からテーブル名を読み込み、常に Floci の
エンドポイントへ接続します。

```bash
# Create
bun run todo create todo-1 "Flociを試す" "DynamoDB CRUDを確認する"

# Read
bun run todo get todo-1
bun run todo list

# Update: id, title, description, completed
bun run todo update todo-1 "Flociを試す" "CRUD確認済み" true

# Delete
bun run todo delete todo-1
```

存在済み ID の作成、存在しない ID の更新・削除は DynamoDB の条件式により
失敗します。

## 品質確認

```bash
bun run format
bun run build
bun run test
bun run synth
```
