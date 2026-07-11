#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "floci" ]]; then
  echo "Usage: $0 floci" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
OUTPUTS="pkgs/cdk/cdk-outputs.json"
ENDPOINT="http://localhost:4566"

stack_name() {
  local region_name color_name
  case "$1" in tokyo) region_name="Tokyo" ;; osaka) region_name="Osaka" ;; esac
  case "$2" in blue) color_name="Blue" ;; green) color_name="Green" ;; esac
  printf 'TodoBg%s%sStack' "$region_name" "$color_name"
}

cleanup_orphan_policy() {
  local stack="$1" policy_prefix="$2" status policies policy_arn
  status="$(aws --endpoint-url "$ENDPOINT" --region us-east-1 \
    cloudformation describe-stacks --stack-name "$stack" \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")"
  case "$status" in
    CREATE_COMPLETE|UPDATE_COMPLETE) return ;;
  esac

  policies="$(aws --endpoint-url "$ENDPOINT" --region us-east-1 \
    iam list-policies --scope Local \
    --query "Policies[?starts_with(PolicyName, '$policy_prefix')].Arn" \
    --output text)"
  for policy_arn in $policies; do
    echo "=== Removing orphan IAM policy: $policy_arn ==="
    aws --endpoint-url "$ENDPOINT" --region us-east-1 \
      iam delete-policy --policy-arn "$policy_arn"
  done
}

pnpm generate
pnpm format:check
pnpm typecheck
pnpm test

export AWS_ACCESS_KEY_ID="local"
export AWS_SECRET_ACCESS_KEY="local"
export AWS_DEFAULT_REGION="us-east-1"

for region in Tokyo Osaka; do
  for color in Blue Green; do
    stack="TodoBg${region}${color}Stack"
    cleanup_orphan_policy \
      "$stack" "TodoApp${region}${color}TodoFunction${color}ServiceRoleDefaultPolicy"
  done
done

pnpm cdk floci:cdk:deploy

for region in tokyo osaka; do
  for color in blue green; do
    stack="$(stack_name "$region" "$color")"
    bucket="$(jq -r ".${stack}.FrontendBucketNameOutput" "$OUTPUTS")"
    api_url="$(jq -r ".${stack}.ApiUrlOutput" "$OUTPUTS")"
    VITE_API_BASE_URL="$api_url" pnpm --filter frontend build
    aws --endpoint-url http://localhost:4566 --region us-east-1 \
      s3 sync pkgs/frontend/dist "s3://$bucket" --delete
    echo "$region/$color: http://localhost:4566/$bucket/index.html"
  done
done

echo "Run: pnpm switch --region tokyo --color blue"
