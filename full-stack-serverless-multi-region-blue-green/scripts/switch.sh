#!/usr/bin/env bash
set -euo pipefail

REGION=""
COLOR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="${2:-}"; shift 2 ;;
    --color) COLOR="${2:-}"; shift 2 ;;
    *) echo "Usage: $0 --region tokyo|osaka --color blue|green" >&2; exit 1 ;;
  esac
done

if [[ ! "$REGION" =~ ^(tokyo|osaka)$ || ! "$COLOR" =~ ^(blue|green)$ ]]; then
  echo "Usage: $0 --region tokyo|osaka --color blue|green" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUTS="$ROOT/pkgs/cdk/cdk-outputs.json"
if [[ ! -f "$OUTPUTS" ]]; then
  echo "cdk-outputs.json not found. Run 'pnpm deploy:floci' first." >&2
  exit 1
fi

case "$REGION" in tokyo) REGION_NAME="Tokyo" ;; osaka) REGION_NAME="Osaka" ;; esac
case "$COLOR" in blue) COLOR_NAME="Blue" ;; green) COLOR_NAME="Green" ;; esac
STACK="TodoBg${REGION_NAME}${COLOR_NAME}Stack"
APP_URL="$(jq -r ".${STACK}.AppUrlOutput" "$OUTPUTS")"
API_URL="$(jq -r ".${STACK}.ApiUrlOutput" "$OUTPUTS")"
if [[ "$APP_URL" == "null" || "$API_URL" == "null" ]]; then
  echo "No outputs for $REGION / $COLOR. Run 'pnpm deploy:floci' again." >&2
  exit 1
fi

echo "Active local target: $REGION / $COLOR"
echo "App URL: $APP_URL"
echo "API URL: $API_URL/api/health"
echo "Verify: curl -fsS '$API_URL/api/health'"
