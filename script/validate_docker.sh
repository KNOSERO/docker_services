#!/bin/bash

has_compose_v2() { docker compose version >/dev/null 2>&1; }
has_compose_v1() { command -v docker-compose >/dev/null 2>&1; }

compose_config() {
  local file="$1"
  if has_compose_v2; then
    docker compose -f "$file" config >/dev/null
  elif has_compose_v1; then
    docker-compose -f "$file" config -q
  else
    echo "ERROR: brak docker compose (ani v2, ani docker-compose v1) w PATH" >&2
    exit 1
  fi
}

mapfile -d '' COMPOSE_FILES < <(
  git ls-files -z | grep -zE '(^|/)(docker-)?compose([^/]*?)\.ya?ml$'
)

if ((${#COMPOSE_FILES[@]}==0)); then
    echo "Brak plików docker-compose* w repo."
else
    for f in "${COMPOSE_FILES[@]}"; do
        echo "→ compose syntax OK?  $f"
        compose_config "$f"
    done
    echo "✓ Wszystkie compose’y przeszły walidację."
fi