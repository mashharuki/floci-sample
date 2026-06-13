# Style and Conventions

## General

- ユーザー対話・ドキュメントは原則日本語、コード識別子は英語。
- 変更前に対象を `cdk/`, `full-stack-serverless/`, `full-stack-serverless-blue-green/` から特定する。
- 2つのモノレポは現状コピーだが、目的が異なるため依頼なしに相互同期しない。
- `docs/plans.md` の計画を現行実装と誤認しない。

## TypeScript and CDK

- strict mode を維持し、`any` で回避しない。
- CDK は L2 Construct を優先し、IAM は `grant*()` で最小権限。
- CDK entrypoint は各 `bin/`、Stack/Construct は各 `lib/`。
- Stateful Construct ID、とくに `TodoTable` の変更時は replacement risk を確認し `cdk diff`。
- Todo table schema は各 CDK package の `config/todo-table.json` を正本とする。

## Monorepos

- pnpm workspace は `pkgs/*`。package manager は pnpm 10。
- `pkgs/backend`: Hono + TypeScript。
- `pkgs/frontend`: React + Vite + TypeScript。
- `pkgs/shared`: 将来の共通型・schema・constants用。現状は空。
- 将来のフルスタック要件は `mem:roadmap/full_stack_serverless`。

## Formatting

- CDK は Biome 1.9、spaces、double quotes、organized imports。
- Monorepo root の Biome も spaces/double quotes/recommended lint。generated/public/build/dist/cdk.out 等を除外。
- 既存 frontend/backend 雛形には single quotes/no semicolons が残る。編集時は対象 package の formatter/linter を実行し、無関係な全体整形を避ける。
- コメントは非自明な理由だけを簡潔に記述。

## Shell

- `#!/usr/bin/env bash`, `set -euo pipefail`。
- 引数を引用し、JSON は `jq` で生成。
- Floci script は endpoint/region/dummy credentials を明示。
- shell変更後は `bash -n`。

## Tests

- CDK Jest tests は各 `pkgs/cdk/test/*.test.ts` または `cdk/test/*.test.ts`。
- `aws-cdk-lib/assertions` で resources/properties/outputs/security を検証。
- 現在の3 CDK package は SQS、DynamoDB Todos、Todo table output の3テスト。

## Local AWS Safety

- endpoint `http://localhost:4566`
- account `000000000000`
- region `us-east-1`
- dummy credentials only
- deploy/destroy 前に対象確認
- 実 AWS の bootstrap/deploy/destroy は明示依頼なしに実行しない