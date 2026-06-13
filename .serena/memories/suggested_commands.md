# Suggested Commands

すべて原則 `cdk/` で実行する。

## Setup and Floci

```bash
bun install
bun run floci:up
bun run floci:setup
bun run floci:down
```

ヘルス確認:

```bash
curl -f http://localhost:4566/_floci/health
```

## CDK Against Floci

```bash
bun run floci:cdk:bootstrap
bun run floci:cdk:synth
bun run floci:cdk:deploy
bun run floci:cdk:destroy
```

`floci:cdk:*` は endpoint `http://localhost:4566`、account `000000000000`、region `us-east-1`、ダミー認証情報を設定する。実 AWS へは使用しない。

## Todo CRUD

```bash
bun run todo create todo-1 "タイトル" "説明"
bun run todo get todo-1
bun run todo list
bun run todo update todo-1 "更新タイトル" "更新説明" true
bun run todo delete todo-1
```

CRUD スクリプトは `config/todo-table.json` からテーブル名を読み、常に Floci へ接続する。AWS CLI v2 と `jq` が必要。

## Validation

```bash
bun run format
bun run build
bun run test
bun run synth
bash -n scripts/todo.sh scripts/floci-cdk.sh scripts/setup-local-aws.sh
git diff --check
```

CDK 変更の実動確認では、Floci health 確認後に `floci:cdk:deploy` と一時 Todo の CRUD を実行し、最後に削除する。

## Direct Local Checks

```bash
aws --endpoint-url http://localhost:4566 --region us-east-1 dynamodb describe-table --table-name Todos
aws --endpoint-url http://localhost:4566 --region us-east-1 dynamodb scan --table-name Todos
```

## Known Issue

`bun run diff` は `ckd diff` の誤記がある。修正までは次を使う。

```bash
bunx cdk diff
# または
npx cdk diff
```