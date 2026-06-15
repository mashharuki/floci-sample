#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "floci" ]]; then
  echo "Usage: $0 floci" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CDK_OUTPUTS="pkgs/cdk/cdk-outputs.json"
if [[ -f "$CDK_OUTPUTS" ]]; then
  BLUE_BUCKET=$(jq -r '.TodoBgBlueStack.FrontendBucketNameOutput // empty' "$CDK_OUTPUTS")
  GREEN_BUCKET=$(jq -r '.TodoBgGreenStack.FrontendBucketNameOutput // empty' "$CDK_OUTPUTS")

  for BUCKET in "$BLUE_BUCKET" "$GREEN_BUCKET"; do
    if [[ -n "$BUCKET" ]]; then
      echo "=== Clearing S3 bucket: $BUCKET ==="
      aws --endpoint-url http://localhost:4566 --region us-east-1 \
        s3 rm "s3://$BUCKET" --recursive || true
    fi
  done
fi

echo "=== CDK Destroy (Floci) ==="
pnpm cdk floci:cdk:destroy

echo "=== Done ==="
