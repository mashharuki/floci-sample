# Suggested Commands

## Root CDK Sample

原則 `cdk/` で実行。

```bash
bun install
bun run floci:up
curl -f http://localhost:4566/_floci/health
bun run floci:setup
bun run floci:cdk:bootstrap
bun run floci:cdk:synth
bun run floci:cdk:deploy
bun run floci:cdk:destroy
```

Todo CRUD:

```bash
bun run todo create todo-1 "タイトル" "説明"
bun run todo get todo-1
bun run todo list
bun run todo update todo-1 "更新タイトル" "更新説明" true
bun run todo delete todo-1
```

Validation:

```bash
bun run format
bun run build
bun run test
bun run synth
bash -n scripts/todo.sh scripts/floci-cdk.sh scripts/setup-local-aws.sh
git diff --check
```

## pnpm Workspaces

対象ルートは `full-stack-serverless/` または `full-stack-serverless-blue-green/`。現在 lockfile/node_modules はない。

```bash
pnpm install
pnpm format
pnpm --filter backend dev
pnpm --filter backend build
pnpm --filter frontend dev
pnpm --filter frontend build
pnpm --filter frontend lint
pnpm --filter cdk build
pnpm --filter cdk test
pnpm --filter cdk synth
```

CDK の Floci scripts は package directory 基準なので、必要なら `pkgs/cdk/` で `bun run floci:*` を実行する。pnpm workspace 全体の統一 build/test/lint scripts はまだない。

## Local AWS Safety

wrapper は endpoint `http://localhost:4566`, account `000000000000`, region `us-east-1`, dummy credentials を設定する。直接 AWS CLI を使う場合も `--endpoint-url` と `--region us-east-1` を明示する。

## Known Issue

3つの CDK package の `bun run diff` は `ckd diff` の誤記。修正までは `bunx cdk diff` または `npx cdk diff`。