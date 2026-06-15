#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "floci" ]]; then
  echo "Usage: $0 floci" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== Generating OpenAPI spec and types ==="
pnpm generate

echo "=== Format check ==="
pnpm format:check

echo "=== Typecheck ==="
pnpm typecheck

echo "=== Test ==="
pnpm test

echo "=== CDK Deploy (Floci) ==="
pnpm cdk floci:cdk:deploy

echo "=== Read CDK outputs ==="
CDK_OUTPUTS="pkgs/cdk/cdk-outputs.json"

if [[ ! -f "$CDK_OUTPUTS" ]]; then
  echo "cdk-outputs.json not found. CDK deploy may not have generated outputs." >&2
  exit 1
fi

BLUE_BUCKET=$(jq -r '.TodoBgBlueStack.FrontendBucketNameOutput' "$CDK_OUTPUTS")
BLUE_API_URL=$(jq -r '.TodoBgBlueStack.ApiUrlOutput' "$CDK_OUTPUTS")
GREEN_BUCKET=$(jq -r '.TodoBgGreenStack.FrontendBucketNameOutput' "$CDK_OUTPUTS")
GREEN_API_URL=$(jq -r '.TodoBgGreenStack.ApiUrlOutput' "$CDK_OUTPUTS")

echo "=== Build & deploy Blue frontend ==="
VITE_API_BASE_URL="$BLUE_API_URL" pnpm --filter frontend build
aws --endpoint-url http://localhost:4566 --region us-east-1 \
  s3 sync pkgs/frontend/dist "s3://$BLUE_BUCKET" --delete

echo "=== Build & deploy Green frontend ==="
VITE_API_BASE_URL="$GREEN_API_URL" pnpm --filter frontend build
aws --endpoint-url http://localhost:4566 --region us-east-1 \
  s3 sync pkgs/frontend/dist "s3://$GREEN_BUCKET" --delete

echo ""
echo "=== Deployment complete ==="
echo "Blue  App: http://localhost:4566/$BLUE_BUCKET/index.html"
echo "Blue  API: $BLUE_API_URL"
echo "Green App: http://localhost:4566/$GREEN_BUCKET/index.html"
echo "Green API: $GREEN_API_URL"
echo ""
echo "Run 'pnpm switch blue' or 'pnpm switch green' to see active endpoint details."
