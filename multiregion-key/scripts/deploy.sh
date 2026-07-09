#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "floci" ]]; then
  echo "deploy.sh supports only the floci target; use aws-guard.sh for AWS" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CDK_DIR="$ROOT/pkgs/cdk"
ENDPOINT="http://localhost:4566"
REGION="us-east-1"

export AWS_ACCESS_KEY_ID="local"
export AWS_SECRET_ACCESS_KEY="local"
export AWS_DEFAULT_REGION="$REGION"

curl -fsS "$ENDPOINT/_floci/health" >/dev/null
cd "$ROOT"
pnpm generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build

cd "$CDK_DIR"
bash scripts/floci-cdk.sh deploy --all --require-approval never --outputs-file cdk-outputs.json
API_URL="$(jq -r '.CdkStack.ApiUrlOutput' cdk-outputs.json)"
BUCKET="$(jq -r '.CdkStack.FrontendBucketNameOutput' cdk-outputs.json)"

cd "$ROOT"
VITE_API_BASE_URL="$API_URL" pnpm --filter @full-stack-serverless/frontend build
aws --endpoint-url "$ENDPOINT" --region "$REGION" s3 sync \
  pkgs/frontend/dist "s3://$BUCKET" --delete

echo "Floci deploy complete"
echo "API: $API_URL"
echo "App: http://localhost:4566/$BUCKET/index.html"
