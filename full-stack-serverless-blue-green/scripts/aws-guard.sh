#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
ACTIVE="${ACTIVE:-blue}"

if [[ "${CONFIRM_AWS_DEPLOY:-}" != "yes" ]]; then
  echo "Set CONFIRM_AWS_DEPLOY=yes to allow AWS operations." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

case "$ACTION" in
  diff)
    pnpm --filter @fsbg/cdk diff:aws
    ;;
  deploy)
    pnpm generate
    pnpm format:check
    pnpm typecheck
    pnpm test

    AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?Please set AWS_ACCOUNT_ID}"
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" \
      pnpm --filter @fsbg/cdk exec -- cdk deploy --all \
        -c target=aws -c active="$ACTIVE" \
        --require-approval never \
        --outputs-file cdk-outputs.json

    BLUE_BUCKET=$(jq -r '.TodoBgBlueStack.FrontendBucketNameOutput' pkgs/cdk/cdk-outputs.json)
    GREEN_BUCKET=$(jq -r '.TodoBgGreenStack.FrontendBucketNameOutput' pkgs/cdk/cdk-outputs.json)

    # AWS: CloudFront が /api/* をルーティングするため VITE_API_BASE_URL="" でビルド可
    pnpm --filter frontend build
    aws s3 sync pkgs/frontend/dist "s3://$BLUE_BUCKET" --delete
    aws s3 sync pkgs/frontend/dist "s3://$GREEN_BUCKET" --delete
    ;;
  switch)
    AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?Please set AWS_ACCOUNT_ID}"
    echo "=== Switching active color to: $ACTIVE ==="
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" \
      pnpm --filter @fsbg/cdk exec -- cdk deploy TodoBgRouterStack \
        -c target=aws -c active="$ACTIVE" \
        --require-approval never
    echo "=== Done. Active color: $ACTIVE ==="
    ;;
  destroy)
    AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?Please set AWS_ACCOUNT_ID}"
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" \
      pnpm --filter @fsbg/cdk exec -- cdk destroy --all \
        -c target=aws --force
    ;;
  *)
    echo "Usage: $0 diff|deploy|switch|destroy" >&2
    exit 1
    ;;
esac
