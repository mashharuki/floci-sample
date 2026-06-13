#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="http://localhost:4566"
REGION="us-east-1"

export AWS_ACCESS_KEY_ID="local"
export AWS_SECRET_ACCESS_KEY="local"
export AWS_DEFAULT_REGION="$REGION"
export AWS_PAGER=""

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TABLE_DEFINITION="$REPO_ROOT/config/todo-table.json"
TABLE_NAME="$(jq -r ".TableName" "$TABLE_DEFINITION")"
AWS=(aws --endpoint-url "$ENDPOINT" --region "$REGION" --no-cli-pager)

usage() {
  cat <<'EOF'
Usage:
  bun run todo create <id> <title> [description]
  bun run todo get <id>
  bun run todo list
  bun run todo update <id> <title> [description] [true|false]
  bun run todo delete <id>
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_arg() {
  local value="${1:-}"
  local name="$2"

  if [[ -z "$value" ]]; then
    echo "Missing required argument: $name" >&2
    usage
    exit 1
  fi
}

create_todo() {
  local id="${1:-}"
  local title="${2:-}"
  local description="${3:-}"
  local now
  local item

  require_arg "$id" "id"
  require_arg "$title" "title"
  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  item="$(
    jq -n \
      --arg id "$id" \
      --arg title "$title" \
      --arg description "$description" \
      --arg now "$now" \
      '{
        id: {S: $id},
        title: {S: $title},
        description: {S: $description},
        completed: {BOOL: false},
        createdAt: {S: $now},
        updatedAt: {S: $now}
      }'
  )"

  "${AWS[@]}" dynamodb put-item \
    --table-name "$TABLE_NAME" \
    --item "$item" \
    --condition-expression "attribute_not_exists(id)"
  get_todo "$id"
}

get_todo() {
  local id="${1:-}"
  local key

  require_arg "$id" "id"
  key="$(jq -n --arg id "$id" '{id: {S: $id}}')"

  "${AWS[@]}" dynamodb get-item \
    --table-name "$TABLE_NAME" \
    --key "$key" \
    --consistent-read
}

list_todos() {
  "${AWS[@]}" dynamodb scan --table-name "$TABLE_NAME"
}

update_todo() {
  local id="${1:-}"
  local title="${2:-}"
  local description="${3:-}"
  local completed="${4:-false}"
  local now
  local key
  local values

  require_arg "$id" "id"
  require_arg "$title" "title"
  if [[ "$completed" != "true" && "$completed" != "false" ]]; then
    echo "completed must be true or false" >&2
    exit 1
  fi

  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  key="$(jq -n --arg id "$id" '{id: {S: $id}}')"
  values="$(
    jq -n \
      --arg title "$title" \
      --arg description "$description" \
      --argjson completed "$completed" \
      --arg now "$now" \
      '{
        ":title": {S: $title},
        ":description": {S: $description},
        ":completed": {BOOL: $completed},
        ":updatedAt": {S: $now}
      }'
  )"

  "${AWS[@]}" dynamodb update-item \
    --table-name "$TABLE_NAME" \
    --key "$key" \
    --update-expression \
      "SET title = :title, description = :description, completed = :completed, updatedAt = :updatedAt" \
    --expression-attribute-values "$values" \
    --condition-expression "attribute_exists(id)" \
    --return-values "ALL_NEW"
}

delete_todo() {
  local id="${1:-}"
  local key

  require_arg "$id" "id"
  key="$(jq -n --arg id "$id" '{id: {S: $id}}')"

  "${AWS[@]}" dynamodb delete-item \
    --table-name "$TABLE_NAME" \
    --key "$key" \
    --condition-expression "attribute_exists(id)" \
    --return-values "ALL_OLD"
}

require_command aws
require_command jq

case "${1:-}" in
  create)
    create_todo "${2:-}" "${3:-}" "${4:-}"
    ;;
  get)
    get_todo "${2:-}"
    ;;
  list)
    list_todos
    ;;
  update)
    update_todo "${2:-}" "${3:-}" "${4:-}" "${5:-}"
    ;;
  delete)
    delete_todo "${2:-}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
