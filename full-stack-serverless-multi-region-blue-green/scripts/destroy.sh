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
export AWS_ACCESS_KEY_ID="local"
export AWS_SECRET_ACCESS_KEY="local"
export AWS_DEFAULT_REGION="us-east-1"

empty_bucket() {
  local bucket="$1"
  [[ -z "$bucket" || "$bucket" == "None" ]] && return
  echo "=== Clearing S3 bucket: $bucket ==="
  aws --endpoint-url "$ENDPOINT" --region us-east-1 \
    s3 rm "s3://$bucket" --recursive || true
}

for region in Tokyo Osaka; do
  for color in Blue Green; do
    stack="TodoBg${region}${color}Stack"
    bucket=""
    if [[ -f "$OUTPUTS" ]]; then
      bucket="$(jq -r ".${stack}.FrontendBucketNameOutput // empty" "$OUTPUTS")"
    fi
    empty_bucket "$bucket"

    # 部分デプロイ失敗時は outputs にスタック情報が存在しないため、
    # CloudFormation から物理バケット名を取得して空にする。
    buckets="$(aws --endpoint-url "$ENDPOINT" --region us-east-1 \
      cloudformation list-stack-resources --stack-name "$stack" \
      --query 'StackResourceSummaries[?ResourceType==`AWS::S3::Bucket`].PhysicalResourceId' \
      --output text 2>/dev/null || true)"
    for bucket in $buckets; do
      empty_bucket "$bucket"
    done
  done
done

pnpm cdk floci:cdk:destroy
