#!/bin/bash

has_compose_v2() { docker compose version >/dev/null 2>&1; }
has_compose_v1() { command -v docker-compose >/dev/null 2>&1; }

FAIL_ON_WARNING="${FAIL_ON_WARNING:-0}"
STRICT_ENV="${STRICT_ENV:-0}"

compose_check() {
  local file="$1"
  echo "→ compose syntax check: $file"
  local tmp; tmp="$(mktemp)"

  if has_compose_v2; then
    # błąd YAML → exit!=0 → skrypt kończy się przez set -e
    docker compose -f "$file" config >/dev/null 2>"$tmp" || {
      echo "✗ ERROR in $file:" >&2; cat "$tmp" >&2; exit 1; }
  elif has_compose_v1; then
    docker-compose -f "$file" config -q >/dev/null 2>"$tmp" || {
      echo "✗ ERROR in $file:" >&2; cat "$tmp" >&2; exit 1; }
  else
    echo "✗ ERROR: hasn't docker compose (v2 ani v1) in PATH" >&2; exit 1
  fi

  # Twarde reguły opcjonalne:
  if [[ "$STRICT_ENV" == "1" ]] && grep -qi 'variable is not set' "$tmp"; then
    echo "✗ ERROR (missing env) in $file:" >&2; cat "$tmp" >&2; exit 2
  fi
  if [[ "$FAIL_ON_WARNING" == "1" ]] && grep -qi 'warning' "$tmp"; then
    echo "✗ ERROR (warnings as error) in $file:" >&2; cat "$tmp" >&2; exit 3
  fi

  # Miękki hint: Compose v2 ignoruje 'version:'
  if grep -q '^[[:space:]]*version:' "$file"; then
    echo "⚠ warning: 'version:' is obsolete in $file"
  fi

  rm -f "$tmp"
}

mapfile -t COMPOSE_FILES < <(git ls-files | grep -E '(^|/)(docker-)?compose([^/]*?)\.ya?ml$' || true)
((${#COMPOSE_FILES[@]})) || { echo "Hasn't file docker-compose in repo."; exit 0; }

for f in "${COMPOSE_FILES[@]}"; do compose_check "$f"; done
echo "✓ All docker-compose files valid."