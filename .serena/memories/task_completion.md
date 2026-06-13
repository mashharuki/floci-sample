# Task Completion Checklist

コードまたは設定変更時:

1. `git status --short --branch` で既存変更を確認し、ユーザー変更を保持する。
2. TypeScript/JSON 変更時は `bun run format`。
3. `bun run build`。
4. `bun run test`。
5. CDK 変更時は `bun run synth` または Floci 起動中なら `bun run floci:cdk:synth`。
6. shell 変更時は `bash -n`。
7. `git diff --check` と `git diff` で変更範囲を確認する。
8. ローカル deploy を伴う場合は endpoint/account/region を確認し、Floci health 後に `bun run floci:cdk:deploy`。
9. Todo CRUD 変更時は一時 ID で create/get/update/list/delete を実行し、検証データを削除する。
10. 変更ファイル、検証結果、未実行項目と残存リスクを日本語で簡潔に報告する。

ドキュメントまたは Serena メモリーのみの変更では、内容と参照関係を確認すれば CDK フルビルドは不要。