#!/usr/bin/env bash
# ============================================================
# setup-local-aws.sh
#
# Initializes AWS resources on Floci (http://localhost:4566)
# for local development.  Run once after `docker compose up`.
#
# Requirements: aws CLI v2, jq
# Usage:        ./scripts/setup-local-aws.sh
# ============================================================
set -euo pipefail

ENDPOINT="http://localhost:4566"
REGION="us-east-1"

# Dummy credentials required by AWS CLI even against a local emulator
export AWS_ACCESS_KEY_ID="local"
export AWS_SECRET_ACCESS_KEY="local"
export AWS_DEFAULT_REGION="$REGION"

AWS="aws --endpoint-url $ENDPOINT --region $REGION"

echo "▶ Floci endpoint: $ENDPOINT"

# ─────────────────────────────────────────────────────────────
# 1. Wait for Floci to be ready
# ─────────────────────────────────────────────────────────────
echo "⏳ Waiting for Floci..."
until curl -sf "$ENDPOINT/_floci/health" > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Floci is up"