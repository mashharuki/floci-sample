#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "floci" ]]; then
  echo "deploy.sh supports only the floci target; use aws-guard.sh for AWS" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CDK_DIR="$ROOT/pkgs/cdk"
ENDPOINT="http://localhost:4566"
REGION="us-east-1"

export AWS_ACCESS_KEY_ID="local"
export AWS_SECRET_ACCESS_KEY="local"
export AWS_DEFAULT_REGION="$REGION"

curl -fsS "$ENDPOINT/_floci/health" >/dev/null
cd "$ROOT"
pnpm generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build

cd "$CDK_DIR"
bash scripts/floci-cdk.sh deploy --all --require-approval never --outputs-file cdk-outputs.json
API_URL="$(jq -r '.CdkStack.ApiUrlOutput' cdk-outputs.json)"

MESSAGE="$(printf 'floci smoke' | base64)"
CREATE_BODY='{"aliasName":"floci-smoke"}'
KEY_SET_ID="$(curl -fsS -X POST "$API_URL/api/key-sets" \
  -H 'content-type: application/json' \
  -d "$CREATE_BODY" | jq -r '.data.keySetId')"
SIGNATURE="$(curl -fsS -X POST "$API_URL/api/key-sets/$KEY_SET_ID/sign" \
  -H 'content-type: application/json' \
  -d "{\"region\":\"tokyo\",\"message\":\"$MESSAGE\"}" | jq -r '.data.signature')"
curl -fsS -X POST "$API_URL/api/key-sets/$KEY_SET_ID/verify" \
  -H 'content-type: application/json' \
  -d "{\"region\":\"osaka\",\"message\":\"$MESSAGE\",\"signature\":\"$SIGNATURE\"}" \
  | jq -e '.data.valid == true' >/dev/null
curl -fsS -X DELETE "$API_URL/api/key-sets/$KEY_SET_ID" >/dev/null

echo "Floci deploy complete"
echo "API: $API_URL"
echo "Smoke key set: $KEY_SET_ID"
