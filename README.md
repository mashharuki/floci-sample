# floci-sample

flociについて学習するためのサンプル

## 概要

`floci-sample` は、Floci を使って AWS 互換のサーバーレス構成をローカルで学習・検証するためのサンプル集です。

現在は、単体の CDK サンプルに加えて、Todo アプリを題材にした `full-stack-serverless` と `full-stack-serverless-blue-green` の 2 つのフルスタック構成を含みます。どちらも React フロントエンド、Hono バックエンド、DynamoDB、Lambda、API Gateway、S3 を組み合わせ、Floci と実 AWS の両方を `target=floci|aws` で切り替えられる設計です。

| ディレクトリ | 内容 |
| --- | --- |
| `cdk/` | Floci 向けの基本 CDK サンプル。SQS と DynamoDB の学習用スタックを定義 |
| `full-stack-serverless/` | 単一スタックで Todo アプリ全体を構築するフルスタックサーバーレス構成 |
| `full-stack-serverless-blue-green/` | DynamoDB を共有し、Blue/Green のアプリ環境と CloudFront ルーターを分離した構成 |

## 技術スタック

| カテゴリ | 技術 |
| --- | --- |
| 言語 | TypeScript 5.9、ES2022、Node.js 22 以上 |
| フロントエンド | React 19、Vite、TanStack Query、openapi-fetch |
| バックエンド | Hono、@hono/zod-openapi、AWS SDK for JavaScript v3 |
| API 契約 | OpenAPI 3.1、Zod、openapi-typescript |
| インフラ | AWS CDK v2、Constructs v10 |
| ローカル AWS 互換環境 | Floci、Docker Compose |
| パッケージ管理 | pnpm 10.33.0、Bun |
| テスト | Jest、Vitest、React Testing Library |
| 品質管理 | Biome、TypeScript strict mode |

## 採用しているAWSサービス

| サービス | 用途 |
| --- | --- |
| Amazon DynamoDB | Todo データストア。`Todos` テーブルを PAY_PER_REQUEST で利用 |
| AWS Lambda | Hono アプリケーションを実行する API バックエンド |
| Amazon API Gateway REST API | `/api/*` の HTTP エンドポイント |
| Amazon S3 | React/Vite の静的フロントエンド配信先 |
| Amazon CloudFront | 実 AWS でのフロントエンド配信、`/api/*` ルーティング、Blue/Green 切り替え |
| Amazon CloudWatch Logs | 実 AWS での API / Lambda ログ保持 |
| Amazon SQS | `cdk/` の基本学習用キュー |
| AWS IAM | Lambda から DynamoDB への最小権限、S3 バケットポリシー、CloudFront OAC アクセス制御 |
| AWS CloudFormation | CDK によるスタック合成・デプロイ先 |

## full-stack-serverlessのシステム構成図

AWSアーキテクチャアイコンを使った編集可能な draw.io 版は [docs/diagrams/cdk-stack-architecture.drawio](docs/diagrams/cdk-stack-architecture.drawio) にあります。

```mermaid
flowchart LR
  User[利用者ブラウザ]

  subgraph Local["Floci ローカル環境"]
    LocalS3[S3 REST URL<br/>静的フロントエンド]
    LocalApi[API Gateway REST API<br/>Floci endpoint]
    LocalLambda[Lambda<br/>Hono Todo API]
    LocalDdb[(DynamoDB<br/>Todos)]
  end

  subgraph Aws["AWS ap-northeast-1"]
    CloudFront[CloudFront Distribution]
    AwsS3[S3 private bucket<br/>静的フロントエンド]
    AwsApi[API Gateway REST API<br/>/api/*]
    AwsLambda[Lambda<br/>Hono Todo API]
    AwsDdb[(DynamoDB<br/>Todos)]
    Logs[CloudWatch Logs]
  end

  User -->|Floci frontend URL| LocalS3
  User -->|Floci API URL| LocalApi
  LocalApi --> LocalLambda
  LocalLambda --> LocalDdb

  User -->|HTTPS| CloudFront
  CloudFront -->|/*| AwsS3
  CloudFront -->|/api/*| AwsApi
  AwsApi --> AwsLambda
  AwsLambda --> AwsDdb
  AwsApi -. access logs .-> Logs
  AwsLambda -. function logs .-> Logs
```

## full-stack-serverlessのCDKスタック構成図

```mermaid
flowchart TD
  App[CDK App<br/>pkgs/cdk/bin/cdk.ts]
  Stack[CdkStack<br/>pkgs/cdk/lib/cdk-stack.ts]

  Table[TodoTable<br/>DynamoDB]
  Function[TodoFunction<br/>NodejsFunction]
  Api[TodoApi<br/>API Gateway REST API]
  Bucket[FrontendBucket<br/>S3]
  Distribution[Distribution<br/>CloudFront<br/>AWS target only]
  Deploy[FrontendDeploy<br/>S3 BucketDeployment<br/>AWS target only]
  Outputs[CloudFormation Outputs<br/>TableName / ApiUrl / BucketName / AppUrl]

  App -->|context target=floci| Stack
  App -->|context target=aws| Stack
  Stack --> Table
  Stack --> Function
  Stack --> Api
  Stack --> Bucket
  Function -->|grantReadWriteData| Table
  Api -->|LambdaIntegration| Function
  Stack -->|target=aws| Distribution
  Distribution --> Bucket
  Distribution -->|/api/*| Api
  Stack -->|target=aws| Deploy
  Deploy --> Bucket
  Deploy --> Distribution
  Stack --> Outputs
```

## full-stack-serverless-blue-greenのシステム構成図

```mermaid
flowchart LR
  User[利用者ブラウザ]

  subgraph Data["共有データ層"]
    Ddb[(DynamoDB<br/>Todos)]
  end

  subgraph Blue["Blue 環境"]
    BlueS3[S3<br/>Blue frontend]
    BlueApi[API Gateway REST API<br/>Blue]
    BlueLambda[Lambda<br/>Hono Todo API<br/>APP_COLOR=blue]
  end

  subgraph Green["Green 環境"]
    GreenS3[S3<br/>Green frontend]
    GreenApi[API Gateway REST API<br/>Green]
    GreenLambda[Lambda<br/>Hono Todo API<br/>APP_COLOR=green]
  end

  subgraph AwsRouter["AWS target only"]
    Router[CloudFront Distribution<br/>active=blue / green]
  end

  User -->|Floci direct URL| BlueS3
  User -->|Floci direct URL| GreenS3
  User -->|Floci API URL| BlueApi
  User -->|Floci API URL| GreenApi

  User -->|HTTPS| Router
  Router -->|frontend active blue| BlueS3
  Router -->|api active blue| BlueApi
  Router -->|frontend active green| GreenS3
  Router -->|api active green| GreenApi
  Router -. standby reference .-> BlueApi
  Router -. standby reference .-> GreenApi

  BlueApi --> BlueLambda
  GreenApi --> GreenLambda
  BlueLambda --> Ddb
  GreenLambda --> Ddb
```

## full-stack-serverless-blue-greenのCDKスタック構成図

```mermaid
flowchart TD
  App[CDK App<br/>pkgs/cdk/bin/cdk.ts]
  DataStack[TodoBgDataStack]
  BlueStack[TodoBgBlueStack<br/>TodoBgAppStack color=blue]
  GreenStack[TodoBgGreenStack<br/>TodoBgAppStack color=green]
  RouterStack[TodoBgRouterStack<br/>AWS target only]

  Table[TodoTable<br/>DynamoDB]
  BlueConstruct[TodoAppConstruct<br/>blue]
  GreenConstruct[TodoAppConstruct<br/>green]
  BlueFn[TodoFunctionBlue<br/>Lambda]
  BlueApi[TodoApiBlue<br/>API Gateway]
  BlueBucket[FrontendBucketBlue<br/>S3]
  GreenFn[TodoFunctionGreen<br/>Lambda]
  GreenApi[TodoApiGreen<br/>API Gateway]
  GreenBucket[FrontendBucketGreen<br/>S3]
  BlueOac[BlueS3Oac]
  GreenOac[GreenS3Oac]
  Distribution[Distribution<br/>CloudFront]

  App --> DataStack
  App --> BlueStack
  App --> GreenStack
  App -->|target=aws| RouterStack

  DataStack --> Table
  BlueStack -->|depends on| DataStack
  GreenStack -->|depends on| DataStack
  BlueStack --> BlueConstruct
  GreenStack --> GreenConstruct

  BlueConstruct --> BlueFn
  BlueConstruct --> BlueApi
  BlueConstruct --> BlueBucket
  GreenConstruct --> GreenFn
  GreenConstruct --> GreenApi
  GreenConstruct --> GreenBucket

  BlueFn -->|grantReadWriteData| Table
  GreenFn -->|grantReadWriteData| Table
  BlueApi -->|LambdaIntegration| BlueFn
  GreenApi -->|LambdaIntegration| GreenFn

  RouterStack -->|depends on| BlueStack
  RouterStack -->|depends on| GreenStack
  RouterStack --> BlueOac
  RouterStack --> GreenOac
  RouterStack --> Distribution
  Distribution -->|active frontend| BlueBucket
  Distribution -->|active frontend| GreenBucket
  Distribution -->|/api/* active API| BlueApi
  Distribution -->|/api/* active API| GreenApi
  Distribution -. /_bg-standby/* .-> BlueApi
  Distribution -. /_bg-standby/* .-> GreenApi
```

## flociの立ち上げ方

```bash
docker run --rm -p 4566:4566 \
  floci/floci:latest
```

以下で起動を確認できます。

```bash
docker ps
```

```bash
CONTAINER ID   IMAGE                COMMAND                  CREATED          STATUS                    PORTS                                         NAMES
891ca2d2e988   floci/floci:latest   "/usr/local/bin/dock…"   27 seconds ago   Up 20 seconds (healthy)   0.0.0.0:4566->4566/tcp, [::]:4566->4566/tcp   exciting_ride
```

## AWS 設定

```bash
aws configure
```

## AWS CLIによるリソースの確認

```bash
aws --endpoint-url http://localhost:4566 \
  s3 mb s3://my-bucket

aws --endpoint-url http://localhost:4566 \
  sqs create-queue --queue-name my-queue

aws --endpoint-url http://localhost:4566 \
  sqs list-queues
```

## DynamoDB取得

```bash
aws dynamodb list-tables --endpoint-url "http://localhost:4566" --region "us-east-1"
```

## CDKはじめ方

```bash
cdk bootstrap
```

```bash
✅  Environment aws://000000000000/us-east-1 bootstrapped.
```

## CDKデプロイ

```bash
npm run deploy
```

## CDKデストロイ

```bash
cdk destroy --force
```

## CDKスタックファイルについて

学習・検証用に作成したCDKスタックファイルがいくつかあります。

## 検証に使用したAI Coding Agent

- Claude Code
- Codex

## SKILLについて

`floci-dev-assistant`を自作

## ハマったポイント

- 一部制約があるためそのままbootstrapするとエラーが起きる
  - 例えばECRが使えないなど
  - セットアップ等は専用のコマンド化してしまった方が良い
- ローカルとAWSでちゃんとアカウント情報を切り替える
  - process.env.CDK_DEFAULT_ACCOUNTを設定する
  - 切り替えられる設定にしておくとGood!

## 参考文献
- [GitHub floci](https://github.com/floci-io/floci)
- [floci 公式ドキュメント](https://floci.io/)
- [Deepwiki floci](https://deepwiki.com/floci-io/floci)
- [Floci完全ガイド：LocalStack代替のAWSローカル開発環境【起動24ms・29サービス対応・1850テスト】](https://ai-heartland.com/tool/floci/)
- [Flociが1ヵ月で41サービス対応へ - 怒涛のアップデートをまとめてみた](https://dev.classmethod.jp/articles/floci-one-month-update-41-services/)
- [LocalStack Community Editionの代替として登場したFlociを試してみた](https://dev.classmethod.jp/articles/floci-localstack-alternative-aws-emulator-try/)
- [Flociが公開から2ヵ月で52サービスへ、アップデートをまとめてみた](https://dev.classmethod.jp/articles/floci-two-months-52-services-update/)
- [Meet Floci: a fast, free, no-strings AWS emulator (no auth token, no quotas)](https://dev.to/hectorvent/meet-floci-a-fast-free-no-strings-aws-emulator-no-auth-token-no-quotas-2gdh)
- [Deepwiki floci 解説](https://deepwiki.com/search/floci_54868ce7-a23f-4223-bb60-eaba8c286c89)
- [【初心者向け】 LocalStackの概要と基本的な使い方について解説します](https://dev.classmethod.jp/articles/how-to-localstack/)
- [LocalStack を用いてローカルに AWS 環境を構築する](https://developers.play.jp/entry/2025/06/05/171137)
- [入門！ AWS Blocks](https://speakerdeck.com/ysuzuki/ru-men-aws-blocks)
- [【AWS Blocks 入門】AWSのIfCツール「AWS Blocks」を体験してみた！](https://qiita.com/yosuke-suzuki/items/aaac7afe22edf08d8d7d)
- [GitHub AWS Blocks](https://github.com/aws-devtools-labs/aws-blocks)
- [2026年6月 Flociアップデートまとめ、CloudFormationとWebコンソールに対応した1ヵ月](https://dev.classmethod.jp/articles/floci-2026-06-cloudformation-web-console-update/)