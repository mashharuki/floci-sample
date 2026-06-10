# AGENTS.md

このファイルは、`floci-sample` で作業するコーディングエージェント向けの
プロジェクト固有ガイドです。ユーザーとの対話とドキュメントは原則として
日本語、コード上の識別子は英語を使用してください。

## プロジェクト概要

Floci を使って AWS 互換リソースをローカルで学習・検証するための
AWS CDK TypeScript サンプルです。現在の CDK スタックは SQS キューを
1つ定義しています。

```text
.
├── README.md
└── cdk/
    ├── bin/cdk.ts               # CDK アプリのエントリーポイント
    ├── lib/cdk-stack.ts         # CDK スタック
    ├── test/cdk.test.ts         # Jest テスト
    ├── scripts/floci-cdk.sh     # Floci 向け CDK ラッパー
    ├── scripts/setup-local-aws.sh
    ├── docker-compose.yml       # Floci
    └── package.json
```

主な技術:

- TypeScript 5.9、ES2022、NodeNext、strict mode
- AWS CDK v2、Constructs v10
- Bun
- Jest 30、ts-jest
- Biome 1.9
- Docker Compose、Floci

## 作業開始時

1. `git status --short --branch` で既存変更を確認する。
2. Serena MCP が利用可能なら `floci-sample` をアクティベートし、以下の
   メモリを必要に応じて読む。
   - `project_overview`
   - `suggested_commands`
   - `style_and_conventions`
   - `task_completion`
3. 関連ファイルだけを `rg`、`rg --files`、Serena のシンボル検索で調べる。
4. AWS CDK の変更では `aws-cdk`、Floci 関連では
   `floci-dev-assistant` スキルを使用する。

ユーザーの未コミット変更を消去、巻き戻し、上書きしないでください。
無関係な変更はそのまま残し、今回のタスクに必要な範囲だけ編集します。

## コマンド

パッケージ関連のコマンドは、特記がなければ `cdk/` で実行します。

```bash
cd cdk
bun install
```

### Floci

```bash
bun run floci:up
curl -f http://localhost:4566/_floci/health
bun run floci:setup
bun run floci:down
```

### CDK を Floci に対して実行

```bash
bun run floci:cdk:bootstrap
bun run floci:cdk:synth
bun run floci:cdk:deploy
bun run floci:cdk:destroy
```

ローカル検証では、認証情報、アカウント、リージョン、エンドポイントを設定する
`floci:cdk:*` スクリプトを優先してください。

### 品質確認

```bash
bun run format
bun run build
bun run test
bun run synth
```

`package.json` の `diff` は現在 `ckd diff` という誤記を含むため、修正されるまで
`bunx cdk diff` または `npx cdk diff` を使用してください。

## AWS と Floci の安全ルール

- Floci のエンドポイントは `http://localhost:4566`。
- Floci 用のアカウントは `000000000000`、リージョンは `us-east-1`。
- Floci ではダミー認証情報のみを使用し、実 AWS の認証情報を使わない。
- AWS CLI を直接使う場合も `--endpoint-url http://localhost:4566` と
  `--region us-east-1` を明示する。
- deploy/destroy 前に、対象エンドポイント、アカウント、リージョンを確認する。
- 実 AWS を対象にする変更やコマンドは、ユーザーの明示的な依頼なしに実行しない。
- 実 AWS の設計では既定リージョンを `ap-northeast-1` とし、最小権限、
  シークレット非埋め込み、HTTPS、低コストなサーバーレス構成を優先する。

`cdk/.env.example` のリージョンは Floci ラッパーと異なります。ローカル CDK
フローでは `scripts/floci-cdk.sh` の `us-east-1` を正としてください。

## 実装規約

- CDK アプリのエントリーポイントは `cdk/bin/`、スタックと Construct は
  `cdk/lib/` に置く。
- AWS CDK は L2 Construct を優先し、L1 や escape hatch は必要な場合だけ使う。
- IAM 権限は `grant*()` などを使って最小権限にする。
- Stateful リソースの Construct ID を安易に変更しない。論理 ID が変わり、
  リソース置換につながるため、変更時は必ず `cdk diff` を確認する。
- TypeScript の strict 設定を維持し、`any` による回避をしない。
- Biome に従い、スペースインデント、ダブルクォート、import 自動整理を使う。
- コメントは非自明な理由だけを簡潔に記述する。
- 周辺コードの言語に合わせ、日本語コメントがあるファイルでは日本語を維持してよい。
- タスクに無関係なリファクタリングや依存関係更新を混ぜない。

## テスト規約

- Jest テストは `cdk/test/*.test.ts` に置く。
- 空のテストではなく、`aws-cdk-lib/assertions` を使って合成テンプレートの
  リソース、プロパティ、セキュリティ設定を検証する。
- バグ修正では、可能な限り再現テストを先に追加する。
- CDK 変更では最低限 `build`、`test`、`synth` を実行する。
- Floci が起動している場合は `floci:cdk:synth` を優先し、必要に応じて
  AWS CLI/SDK から実際の互換動作も確認する。

## 完了条件

コードまたは設定を変更したら、以下を満たしてください。

1. `git diff` で変更範囲がタスクに限定されている。
2. TypeScript/JSON を変更した場合は `bun run format` を実行した。
3. `bun run build` が成功した。
4. `bun run test` が成功した。
5. CDK 変更は synth でき、置換リスクがある場合は diff も確認した。
6. 実行できなかった検証は、理由と残存リスクを最終報告に明記した。
7. 変更ファイルと検証結果を日本語で簡潔に報告した。

ドキュメントまたは Serena メモリのみの変更では、内容とリンクの確認を行えば
CDK のフルビルドは不要です。

## 禁止事項

- `.env`、認証情報、API キー、シークレットを読み取り・出力・コミットしない。
- 明示的な依頼なしに実 AWS へ bootstrap、deploy、destroy しない。
- `git reset --hard`、`git checkout --` などでユーザー変更を破棄しない。
- CDK の deploy 前確認を省略しない。
- テスト失敗や型エラーを無視して完了扱いにしない。
