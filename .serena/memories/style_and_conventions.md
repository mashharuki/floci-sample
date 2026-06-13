# Style and Conventions

## Language and CDK

- TypeScript strict、ES2022、NodeNext を維持し、`any` で回避しない。
- AWS CDK L2 Construct を優先する。
- エントリーポイントは `cdk/bin/`、Stack/Construct は `cdk/lib/`。
- Stateful リソースの Construct ID を変更する場合は置換リスクを確認し、`cdk diff` を実行する。
- DynamoDB Todo テーブルのスキーマ元は `cdk/config/todo-table.json`。CDK と CRUD スクリプトで別々のテーブル名をハードコードしない。

## Formatting

- Biome を使用。スペースインデント、TypeScript/JavaScript はダブルクォート、import 自動整理。
- TypeScript/JSON 変更後は `bun run format`。
- コメントは非自明な理由だけを簡潔に記述する。

## Shell Scripts

- `#!/usr/bin/env bash` と `set -euo pipefail` を使う。
- 引数を引用し、JSON は文字列連結ではなく `jq` で生成する。
- Floci 用スクリプトでは endpoint、region、ダミー認証情報を明示し、実 AWS への誤接続を防ぐ。
- 変更後は `bash -n` で構文確認する。

## Tests

- Jest テストは `cdk/test/*.test.ts`。
- `aws-cdk-lib/assertions` で合成テンプレートのリソース、プロパティ、Output を検証する。
- 現在の基準は SQS、DynamoDB `Todos`、テーブル名 Output の3テスト。

## Local AWS Safety

- endpoint: `http://localhost:4566`
- account: `000000000000`
- region: `us-east-1`
- credentials: ダミー値のみ
- deploy/destroy 前に対象を確認する。
- 実 AWS の bootstrap/deploy/destroy は明示依頼なしに実行しない。