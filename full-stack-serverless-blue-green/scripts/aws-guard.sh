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

# AWS_ACCOUNT_ID が未指定なら STS から自動取得
if [[ -z "${AWS_ACCOUNT_ID:-}" ]]; then
  AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  echo "AWS_ACCOUNT_ID (auto-detected): $AWS_ACCOUNT_ID"
fi

case "$ACTION" in
  diff)
    pnpm --filter @fsbg/cdk diff:aws
    ;;
  deploy)
    pnpm generate
    pnpm format:check
    pnpm typecheck
    pnpm test

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
    echo "=== Switching active color to: $ACTIVE ==="

    # アクティブ側スタックをアップデートして cross-stack export を確保する。
    # RouterStack は両色の API を常に参照するため、対象色の restApiId export が
    # 存在しない場合（初回切り替え直後など）にここで追加される。
    if [[ "$ACTIVE" == "green" ]]; then
      TARGET_STACK="TodoBgGreenStack"
    else
      TARGET_STACK="TodoBgBlueStack"
    fi
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" \
      pnpm --filter @fsbg/cdk exec -- cdk deploy "$TARGET_STACK" \
        -c target=aws -c active="$ACTIVE" \
        --require-approval never \
        --exclusively

    # RouterStack だけを切り替える。--exclusively で依存スタックを再デプロイしない。
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" \
      pnpm --filter @fsbg/cdk exec -- cdk deploy TodoBgRouterStack \
        -c target=aws -c active="$ACTIVE" \
        --require-approval never \
        --exclusively

    echo "=== Done. Active color: $ACTIVE ==="
    ;;
  destroy)
    # RouterStack を先に削除する。
    # RouterStack の BucketPolicy リソースと AppStack の BucketPolicy が同一バケットに
    # 存在する場合、CloudFormation が "Last applied policy" エラーで削除できないため
    # --retain-resources で問題リソースを skip してから RouterStack を削除する。
    ROUTER_STATUS=$(aws cloudformation describe-stacks \
      --stack-name TodoBgRouterStack --region ap-northeast-1 \
      --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")
    if [[ "$ROUTER_STATUS" != "NOT_FOUND" && "$ROUTER_STATUS" != "DELETE_COMPLETE" ]]; then
      echo "=== Deleting TodoBgRouterStack (status: $ROUTER_STATUS) ==="
      if [[ "$ROUTER_STATUS" == "DELETE_FAILED" ]]; then
        # --retain-resources は DELETE_FAILED 状態のときのみ指定可能
        aws cloudformation delete-stack \
          --stack-name TodoBgRouterStack \
          --retain-resources BlueBucketPolicy GreenBucketPolicy \
          --region ap-northeast-1
      else
        aws cloudformation delete-stack \
          --stack-name TodoBgRouterStack \
          --region ap-northeast-1
      fi
      aws cloudformation wait stack-delete-complete \
        --stack-name TodoBgRouterStack \
        --region ap-northeast-1
      echo "=== TodoBgRouterStack deleted ==="
    fi
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" \
      pnpm --filter @fsbg/cdk exec -- cdk destroy --all \
        -c target=aws --force
    ;;
  *)
    echo "Usage: $0 diff|deploy|switch|destroy" >&2
    exit 1
    ;;
esac
