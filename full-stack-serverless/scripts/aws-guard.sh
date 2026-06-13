#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
case "$ACTION" in
  diff|deploy|destroy) ;;
  *)
    echo "Usage: $0 diff|deploy|destroy" >&2
    exit 1
    ;;
esac

: "${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID to the intended AWS account ID}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACTUAL_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$ACTUAL_ACCOUNT" != "$AWS_ACCOUNT_ID" ]]; then
  echo "AWS account mismatch: expected=$AWS_ACCOUNT_ID actual=$ACTUAL_ACCOUNT" >&2
  exit 1
fi

export CDK_DEFAULT_ACCOUNT="$ACTUAL_ACCOUNT"
export CDK_DEFAULT_REGION="ap-northeast-1"
echo "target=aws account=$ACTUAL_ACCOUNT region=$CDK_DEFAULT_REGION action=$ACTION"

if [[ "$ACTION" == "diff" ]]; then
  cd "$ROOT/pkgs/cdk"
  pnpm exec cdk diff -c target=aws
  exit
fi

if [[ "${CONFIRM_AWS_DEPLOY:-}" != "yes" ]]; then
  echo "Set CONFIRM_AWS_DEPLOY=yes to run AWS $ACTION" >&2
  exit 1
fi

if [[ "$ACTION" == "destroy" ]]; then
  cd "$ROOT/pkgs/cdk"
  pnpm exec cdk destroy -c target=aws --force
  exit
fi

cd "$ROOT"
pnpm generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cd pkgs/cdk
pnpm exec cdk deploy -c target=aws --require-approval never --outputs-file cdk-outputs.json
BUCKET="$(jq -r '.CdkStack.FrontendBucketNameOutput' cdk-outputs.json)"
cd "$ROOT"
VITE_API_BASE_URL="" pnpm --filter @full-stack-serverless/frontend build
aws s3 sync pkgs/frontend/dist "s3://$BUCKET" --delete --region ap-northeast-1
