#!/usr/bin/env bash

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