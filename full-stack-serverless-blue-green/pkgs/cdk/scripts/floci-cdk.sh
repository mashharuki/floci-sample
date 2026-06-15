#!/usr/bin/env bash
# ============================================================
# floci-cdk.sh
#
# CDK wrapper for the Floci local AWS emulator.
# Sets dummy credentials and redirects all AWS SDK calls to
# http://localhost:4566 so CDK targets Floci instead of real AWS.
#
# Usage:
#   ./scripts/floci-cdk.sh bootstrap
#   ./scripts/floci-cdk.sh deploy --all
#   ./scripts/floci-cdk.sh destroy --force
# ============================================================
set -euo pipefail

ENDPOINT="http://localhost:4566"
REGION="us-east-1"
ACCOUNT="000000000000"

export AWS_ACCESS_KEY_ID="local"
export AWS_SECRET_ACCESS_KEY="local"
export AWS_DEFAULT_REGION="$REGION"

# AWS SDK v3 universal endpoint override — picked up by CDK's internal SDK calls.
# This redirects CloudFormation, STS, S3, and other service calls to Floci.
export AWS_ENDPOINT_URL="$ENDPOINT"

# Tell CDK which account/region to use without calling real AWS STS.
export CDK_DEFAULT_ACCOUNT="$ACCOUNT"
export CDK_DEFAULT_REGION="$REGION"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ Floci CDK  endpoint=$ENDPOINT  account=$ACCOUNT  region=$REGION"

cd "$REPO_ROOT"

# bootstrap だけフラグを追加（--cloudformation-execution-policies は bootstrap 専用）
# bootstrap-no-ecr.yaml を使って Floci 非対応の ECR リソースをスキップする
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ "${1:-}" == "bootstrap" ]]; then
  npx cdk bootstrap \
    -c target=floci \
    --template "$SCRIPT_DIR/bootstrap-no-ecr.yaml" \
    --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
    "${@:2}"
elif [[ "${1:-}" == "deploy" ]]; then
  npx cdk deploy \
    -c target=floci \
    --outputs-file "$SCRIPT_DIR/../cdk-outputs.json" \
    "${@:2}"
else
  npx cdk "$@" -c target=floci
fi
