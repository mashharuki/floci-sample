#!/usr/bin/env bash
set -euo pipefail

COLOR="${1:-}"
if [[ "$COLOR" != "blue" && "$COLOR" != "green" ]]; then
  echo "Usage: $0 blue|green" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CDK_OUTPUTS="$ROOT/pkgs/cdk/cdk-outputs.json"

if [[ ! -f "$CDK_OUTPUTS" ]]; then
  echo "cdk-outputs.json not found. Run 'pnpm deploy:floci' first." >&2
  exit 1
fi

STACK_KEY="TodoBgBlueStack"
[[ "$COLOR" == "green" ]] && STACK_KEY="TodoBgGreenStack"

APP_URL=$(jq -r ".${STACK_KEY}.AppUrlOutput" "$CDK_OUTPUTS")
API_URL=$(jq -r ".${STACK_KEY}.ApiUrlOutput" "$CDK_OUTPUTS")

echo ""
echo "=== Active: $COLOR ==="
echo "  App URL: $APP_URL"
echo "  API URL: $API_URL/api/todos"
echo ""
echo "To switch to the other color:"
[[ "$COLOR" == "blue" ]] && echo "  pnpm switch green" || echo "  pnpm switch blue"
echo ""
echo "For AWS Blue/Green switch:"
echo "  ACTIVE=green CONFIRM_AWS_DEPLOY=yes AWS_ACCOUNT_ID=xxx bash scripts/aws-guard.sh switch"
