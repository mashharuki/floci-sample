#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
ACTIVE_REGION="${ACTIVE_REGION:-tokyo}"
ACTIVE_COLOR="${ACTIVE_COLOR:-blue}"
TOKYO_REGION="ap-northeast-1"
OSAKA_REGION="ap-northeast-3"

if [[ "${CONFIRM_AWS_DEPLOY:-}" != "yes" ]]; then
  echo "Set CONFIRM_AWS_DEPLOY=yes to allow AWS operations." >&2
  exit 1
fi
if [[ ! "$ACTIVE_REGION" =~ ^(tokyo|osaka)$ || ! "$ACTIVE_COLOR" =~ ^(blue|green)$ ]]; then
  echo "ACTIVE_REGION must be tokyo|osaka and ACTIVE_COLOR must be blue|green." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"

region_code() {
  [[ "$1" == "tokyo" ]] && echo "$TOKYO_REGION" || echo "$OSAKA_REGION"
}
stack_name() {
  local region_name color_name
  case "$1" in tokyo) region_name="Tokyo" ;; osaka) region_name="Osaka" ;; esac
  case "$2" in blue) color_name="Blue" ;; green) color_name="Green" ;; esac
  printf 'TodoBg%s%sStack' "$region_name" "$color_name"
}
stack_output() {
  local stack="$1" region="$2" key="$3"
  aws cloudformation describe-stacks --stack-name "$stack" --region "$region" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue | [0]" --output text
}
deploy_router() {
  local stack region api_url bucket distribution_id invalidation_id
  region="$(region_code "$ACTIVE_REGION")"
  stack="$(stack_name "$ACTIVE_REGION" "$ACTIVE_COLOR")"
  api_url="$(stack_output "$stack" "$region" ApiUrlOutput)"
  bucket="$(stack_output "$stack" "$region" FrontendBucketNameOutput)"
  curl -fsS "${api_url}api/health" >/dev/null
  CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" pnpm --filter @fsbg/cdk exec -- cdk deploy TodoBgRouterStack \
    -c target=aws -c activeRegion="$ACTIVE_REGION" -c activeColor="$ACTIVE_COLOR" \
    -c activeApiUrl="$api_url" -c activeBucketName="$bucket" \
    --require-approval never --exclusively
  distribution_id="$(stack_output TodoBgRouterStack "$TOKYO_REGION" DistributionIdOutput)"
  invalidation_id="$(aws cloudfront create-invalidation --distribution-id "$distribution_id" \
    --paths '/*' --query 'Invalidation.Id' --output text)"
  aws cloudfront wait invalidation-completed \
    --distribution-id "$distribution_id" --id "$invalidation_id"
  echo "CloudFront App URL: $(stack_output TodoBgRouterStack "$TOKYO_REGION" AppUrlOutput)"
}

case "$ACTION" in
  diff)
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" pnpm --filter @fsbg/cdk exec -- cdk diff --all -c target=aws
    ;;
  deploy)
    pnpm generate
    pnpm format:check
    pnpm typecheck
    pnpm test
    for region in "$TOKYO_REGION" "$OSAKA_REGION"; do
      CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" pnpm --filter @fsbg/cdk exec -- cdk bootstrap "aws://$AWS_ACCOUNT_ID/$region"
    done
    # GlobalTable は初回作成でプライマリ以外のレプリカを同時追加できない。
    # 東京プライマリを作成後、2回目のスタック更新で大阪レプリカを追加する。
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" pnpm --filter @fsbg/cdk exec -- cdk deploy TodoBgDataStack \
      -c target=aws -c globalTablePhase=primary --require-approval never --exclusively
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" pnpm --filter @fsbg/cdk exec -- cdk deploy TodoBgDataStack \
      -c target=aws -c globalTablePhase=all --require-approval never --exclusively
    for region in tokyo osaka; do
      for color in blue green; do
        CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" pnpm --filter @fsbg/cdk exec -- cdk deploy "$(stack_name "$region" "$color")" -c target=aws --require-approval never --exclusively
      done
    done
    pnpm --filter frontend build
    for region in tokyo osaka; do
      region_id="$(region_code "$region")"
      for color in blue green; do
        bucket="$(stack_output "$(stack_name "$region" "$color")" "$region_id" FrontendBucketNameOutput)"
        aws s3 sync pkgs/frontend/dist "s3://$bucket" --delete --region "$region_id"
      done
    done
    deploy_router
    ;;
  switch)
    deploy_router
    echo "Active AWS target: $ACTIVE_REGION / $ACTIVE_COLOR"
    ;;
  destroy)
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" pnpm --filter @fsbg/cdk exec -- cdk destroy TodoBgRouterStack -c target=aws --force --exclusively || true
    for region in tokyo osaka; do
      for color in blue green; do
        CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" pnpm --filter @fsbg/cdk exec -- cdk destroy "$(stack_name "$region" "$color")" -c target=aws --force --exclusively
      done
    done
    CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" pnpm --filter @fsbg/cdk exec -- cdk destroy TodoBgDataStack -c target=aws --force --exclusively
    ;;
  *)
    echo "Usage: $0 diff|deploy|switch|destroy" >&2
    exit 1
    ;;
esac
