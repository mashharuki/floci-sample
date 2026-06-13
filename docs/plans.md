# flociで検証したいCDKスタックの構成

## フルスタックサーバーレスアプリ (S3 + API Gateway + Lambda + dynamoDB)

- 作業対象ディレクトリは `full-stack-serverless`
- パッケージマネージャーはpnpm
- シンプルな todo アプリ
- モノレポで管理
  - CDKスタック
  - バックエンド
  - フロントエンド
  - shared
    - 定数系
    - エラーハンドリング
    - バリデーション
      - zod
- フロントエンドは React + Vite + typeScriptにて実装する
- バックエンドは Hono + Typescriptにて実装する
- 目標はfloci上にデプロイしたCDKスタック上でアプリが動作すること
- そして最終的にはAWS上にデプロイして動かせることも目標とする
- テーブル設計はjsonファイルに記載すること

## Blue/Green構成のサーバーレスAPI (S3 + API Gateway + Lambda + dynamoDB)

- 作業対象ディレクトリは `full-stack-serverless-blue-green`
- パッケージマネージャーはpnpm
- モノレポで管理
  - CDKスタック
  - バックエンド
  - フロントエンド
    - shared
    - 定数系
    - エラーハンドリング
    - バリデーション
      - zod
- ロジック自体はシンプルな todo アプリ
- フロントエンドは React + Vite + typeScriptにて実装する
- バックエンドは Hono + Typescriptにて実装する
- 目標はfloci上にデプロイしたCDKスタック上でアプリが動作すること
- そして最終的にはAWS上にデプロイして動かせることも目標とする
- 一つ目と異なり blue/green構成となるため複雑となる。
  - S3バケット、API Gateway、LambdaについてはそれぞれBlue用 Green用のスタックを構成する
  - データベースは同じDynamoDBを見ることとする
- テーブル設計はjsonファイルに記載すること
