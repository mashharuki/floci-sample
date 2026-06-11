# floci-sample

flociについて学習するためのサンプル

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

## 参考文献
- [GitHub floci](https://github.com/floci-io/floci)
- [floci 公式ドキュメント](https://floci.io/)
- [Deepwiki floci](https://deepwiki.com/floci-io/floci)
- [Floci完全ガイド：LocalStack代替のAWSローカル開発環境【起動24ms・29サービス対応・1850テスト】](https://ai-heartland.com/tool/floci/)
- [Flociが1ヵ月で41サービス対応へ - 怒涛のアップデートをまとめてみた](https://dev.classmethod.jp/articles/floci-one-month-update-41-services/)
- [LocalStack Community Editionの代替として登場したFlociを試してみた](https://dev.classmethod.jp/articles/floci-localstack-alternative-aws-emulator-try/)
- [Flociが公開から2ヵ月で52サービスへ、アップデートをまとめてみた](https://dev.classmethod.jp/articles/floci-two-months-52-services-update/)