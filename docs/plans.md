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
- ベースプロジェクトはすでにインストール済み
  - しっかりと既存のコードの作りを確認した上で作成すること
- 目標はfloci上にデプロイしたCDKスタック上でアプリが動作すること
- そして最終的にはAWS上にデプロイして動かせることも目標とする
- テーブル設計はjsonファイルに記載すること
- READMEには機能一覧、採用したAWSサービス一覧、システム構成図を掲載すること

# Todo サーバーレスアプリ実装計画

  ## 概要

  - full-stack-serverless を pnpm workspace として整備し、cdk、backend、frontend、shared を連携させる。
  - 現在の SQS サンプルと CLI Todo 実装を、S3 + API Gateway REST API + Lambda + DynamoDB のフルスタック構成へ置き換える。
  - CDK コンテキスト target=floci|aws を導入し、デフォルトを安全な floci にする。
  - Floci では S3 REST URL、AWS では CloudFront + 非公開S3を使用する。APIとアプリケーションコードは共通化する。
  - 現状は依存関係未インストールで pnpm-lock.yaml もなく、既存ビルドは失敗するため、最初に pnpm install とワークスペース設定を正常化する。

  ## 実装内容

  ### Shared

  - パッケージ名を @full-stack-serverless/shared とし、Zodを追加する。
  - Todoモデルを以下で統一する。
      - id: UUID
      - title: 1～100文字
      - description: 0～500文字
      - completed: boolean
      - createdAt、updatedAt: ISO 8601文字列

  - 作成・部分更新・APIレスポンス用Zodスキーマと推論型を公開する。
  - APIパス、エラーコード、AppError、Zodエラー変換処理を共有する。
  - エラー形式を { error: { code, message, details? } } に統一する。

  ### Backend

  - HonoアプリとLambdaエントリーポイントを分離し、handle(app) でLambdaハンドラーを公開する。
  - APIを次で固定する。
      - GET /api/health
      - GET /api/todos
      - GET /api/todos/:id
      - POST /api/todos
      - PATCH /api/todos/:id
      - DELETE /api/todos/:id

  - 成功レスポンスは { data: ... }、削除成功は 204 とする。
  - DynamoDBアクセスをRepositoryへ分離し、AWS SDK v3 DocumentClientを使用する。
  - テーブル名はLambda環境変数から取得し、Flociが注入するAWSエンドポイント設定をそのまま利用する。
  - 条件式で競合、存在しないTodoの更新・削除、上書きを防止する。
  - ステータスはバリデーションエラー 400、未存在 404、競合 409、想定外 500 とする。
  - 一覧は小規模Todo用途としてScanし、createdAt降順で返す。

  ### Frontend

  - Viteスターター画面をTodo UIへ置き換える。
  - 一覧表示、追加、完了切替、編集、削除、ローディング、空状態、APIエラー表示を実装する。
  - Sharedの型とバリデーションをフォーム入力およびAPIレスポンス検証に使用する。
  - APIベースURLは VITE_API_BASE_URL から取得する。
  - Viteのbaseを相対パスにして、FlociのS3パス形式でもアセットを読み込めるようにする。
  - AWSではCloudFrontの /api/* をAPI Gatewayへ転送し、ブラウザからは同一オリジンでアクセスする。

  ### CDK・デプロイ

  - 既存の TodoTable Construct IDを維持し、SQSを削除する。
  - config/todo-table.json をテーブル設計の正本として拡張し、キー、課金方式、属性モデル、アクセスパターンを記載する。
  - Node.js 22 LambdaをNodejsFunctionでバンドルし、DynamoDB権限はgrantReadWriteData()で付与する。
  - API Gateway REST APIのLambdaプロキシ統合とステージv1を作成する。
  - フロント用S3バケット、API URL、アプリURL、テーブル名をCloudFormation Outputへ出力する。
  - target=floci:
      - CloudFrontとS3 Website設定を生成しない。
      - Floci実行URL /restapis/{id}/v1/_user_request_ を出力する。
      - S3 REST URLからフロントを表示する。

  - target=aws:
      - 既定リージョンをap-northeast-1とする。
      - S3を非公開・暗号化・パブリックアクセス禁止にする。
      - CloudFront OAC、HTTPSリダイレクト、SPAフォールバックを設定する。
      - /api/*のみAPI Gatewayへ転送し、キャッシュを無効化する。

  - docker-compose.yml にDockerソケットとFLOCI_HOSTNAME=flociを追加し、LambdaコンテナからFlociへ到達可能にする。
  - ルートスクリプトで、バックエンド/CDKデプロイ、Output取得、環境別フロントビルド、S3 syncを順番に実行する。
  - 実AWS用コマンドはAWSアカウントID確認を必須とし、自動実行しない。

  ## テストと検証

  - Shared: Todo作成・更新スキーマ、境界値、エラー変換をVitestで検証する。
  - Backend: Hono app.request() とRepositoryモックで全API、404、409、不正JSON、Zodエラーを検証する。
  - Frontend: React Testing Libraryで初期取得、作成、完了切替、編集、削除、失敗表示を検証する。
  - CDK: Jest assertionsで共通リソースとIAM最小権限を検証し、FlociではCloudFrontなし、AWSではS3非公開・CloudFront・APIビヘイビアありを確認
    する。

  - 品質確認は pnpm format、pnpm lint、pnpm build、pnpm test、両ターゲットのsynthを実行する。
  - Floci統合試験ではデプロイ後、HTTP経由でTodo CRUDを実行し、S3上のindex.htmlとアセット取得も確認する。
  - AWSはcdk diff -c target=awsまでを標準検証とし、実デプロイは明示依頼時のみ行う。

  - ルートREADMEを日本語で作成し、機能一覧、モノレポ構成、API仕様、テーブル設計、ローカル起動、Flociデプロイ、AWSデプロイ手順を掲載する。
  - 採用サービスとしてS3、CloudFront、API Gateway REST API、Lambda、DynamoDB、IAM、CloudFormationを説明する。
  - Floci構成とAWS構成の差を注記したMermaidシステム構成図を掲載し、構文検証する。

  ## 前提

  - 初期版は認証なしの単一ユーザーTodoアプリとする。
  - FlociはLambda/API Gateway統合をサポートするが、LambdaにはDockerソケットが必要。
  - FlociはS3 Website Hostingを未実装のため、ローカルではS3 REST URLを使用する。
  - 参考: Floci Lambda (https://floci.io/floci/services/lambda/)、API Gateway (https://floci.io/floci/services/api-gateway/)、S3
    (https://floci.io/floci/services/s3/)、CloudFormation (https://floci.io/floci/services/cloudformation/)

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
- ベースプロジェクトはすでにインストール済み
  - しっかりと既存のコードの作りを確認した上で作成すること
- 目標はfloci上にデプロイしたCDKスタック上でアプリが動作すること
- そして最終的にはAWS上にデプロイして動かせることも目標とする
- 一つ目と異なり blue/green構成となるため複雑となる。
  - S3バケット、API Gateway、LambdaについてはそれぞれBlue用 Green用のスタックを構成する
  - データベースは同じDynamoDBを見ることとする
- テーブル設計はjsonファイルに記載すること
- READMEには機能一覧、採用したAWSサービス一覧、システム構成図を掲載すること