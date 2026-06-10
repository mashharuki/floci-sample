# AWS 制約・方針

## リージョン
- 使用リージョン: ap-northeast-1 (東京)
- マルチリージョン構成は不要（ハッカソン規模）

## コスト意識
- サーバーレス優先（Lambda, API Gateway, DynamoDB, S3, CloudFront）
- 常時稼働インスタンス（EC2, RDS）は避ける（コスト抑制）
- Free Tier内で収まる設計を優先する
- 必要に応じてスケールできる設計は保持する

## セキュリティ基本方針
- IAMロールは最小権限原則
- シークレットはSecrets ManagerまたはSSM Parameter Store
- APIキーをコードにハードコードしない
- HTTPS必須
