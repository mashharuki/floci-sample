# Task Completion Checklist

## All Changes

1. `git status --short --branch` で既存変更を確認し、ユーザー変更を保持。
2. 対象 workspace/package を明示し、無関係なコピーや別サンプルを変更していないか確認。
3. 対象 formatter/linter/build/test を実行。
4. `git diff --check` と `git diff` で変更範囲を確認。
5. 変更ファイル、検証結果、未実行項目と残存リスクを日本語で報告。

## Root `cdk/` or a CDK Package

- TypeScript/JSON: `bun run format`。
- `bun run build`, `bun run test`。
- CDK change: `bun run synth` または Floci起動中なら `bun run floci:cdk:synth`。
- Stateful logical ID risk: `bunx cdk diff` または `npx cdk diff`。`bun run diff` は既知の誤記で使用不可。
- shell change: `bash -n scripts/todo.sh scripts/floci-cdk.sh scripts/setup-local-aws.sh`。
- Floci deploy時: endpoint/account/region確認、health確認、必要なintegration test、検証データ削除。

## pnpm Monorepos

対象 root で dependencies を用意した上で、変更 package に応じて実行:

- root format: `pnpm format`
- backend: `pnpm --filter backend build`
- frontend: `pnpm --filter frontend lint` と `pnpm --filter frontend build`
- CDK: `pnpm --filter cdk build`, `pnpm --filter cdk test`, `pnpm --filter cdk synth`

現状は workspace 全体の統一 `build/test/lint` scripts と lockfile がない。shared の test script は意図的な失敗placeholderなので、実装時に正常なtest setupへ置き換える。

## Memory/Docs Only

内容、参照関係、リンク、`git diff --check` を確認すればCDKフルビルド不要。