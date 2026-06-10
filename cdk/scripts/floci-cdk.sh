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
npx cdk "$@"
