#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "floci" ]]; then
  echo "destroy.sh supports only the floci target; use aws-guard.sh for AWS" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CDK_DIR="$ROOT/pkgs/cdk"
OUTPUTS="$CDK_DIR/cdk-outputs.json"
ENDPOINT="http://localhost:4566"
REGION="us-east-1"

export AWS_ACCESS_KEY_ID="local"
export AWS_SECRET_ACCESS_KEY="local"
export AWS_DEFAULT_REGION="$REGION"

echo "target=floci endpoint=$ENDPOINT account=000000000000 region=$REGION"
[[ -f "$OUTPUTS" ]] && jq -r '.CdkStack.ApiUrlOutput // empty' "$OUTPUTS" >/dev/null

cd "$CDK_DIR"
bash scripts/floci-cdk.sh destroy --force
