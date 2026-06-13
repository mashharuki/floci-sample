# Full-Stack Serverless Roadmap

Source: `docs/plans.md`. 以下は未実装の計画要件。

## Standard Workspace

対象: `full-stack-serverless/`。

- pnpm workspace の `cdk/backend/frontend/shared` を連携。
- Todo API: `GET /api/health`, list/get/create/patch/delete todos。
- Shared: Zod schema/types、API paths、統一エラー `{ error: { code, message, details? } }`。
- Backend: Hono app と Lambda handler 分離、AWS SDK v3 DynamoDB repository、条件式で競合防止。
- Frontend: React/Vite Todo UI、Shared の型/検証、`VITE_API_BASE_URL`。
- OpenAPI YAML と JSON テーブル設計を正本として用意。
- CDK context `target=floci|aws`、default は `floci`。
- 共通: DynamoDB、Lambda Node.js 22、API Gateway REST API、frontend S3。
- Floci: CloudFront/S3 Websiteなし、S3 REST URLとFloci API実行URLを使用。
- AWS: `ap-northeast-1`、private encrypted S3、CloudFront OAC、HTTPS、`/api/*` routing。
- 既存 Stateful Construct ID `TodoTable` を維持し、計画上は SQS を削除。
- README に機能、AWSサービス、API、テーブル、Floci/AWS構成差、Mermaid図を記載。

## Blue/Green Workspace

対象: `full-stack-serverless-blue-green/`。

標準版と同じ Todo 技術要件に加え、S3/API Gateway/Lambda を Blue/Green 別 stack とし、DynamoDB は共有する。詳細な切替方式は計画書でも未確定なので、実装前に設計を明確化する。

## Planned Verification

- Shared: schema boundary/error conversion tests。
- Backend: Hono `app.request()` + repository mocks。
- Frontend: React Testing Library。
- CDK: common resources/IAM、FlociにCloudFrontなし、AWSにprivate S3/CloudFront/API behaviorあり。
- `pnpm format`, `pnpm lint`, `pnpm build`, `pnpm test`, both targets synth。
- Floci deploy後にHTTP Todo CRUDとS3 assets取得。
- AWSは標準で `cdk diff -c target=aws` まで。deployは明示依頼時のみ。