#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="/opt/services"
INVENTORY="$ROOT_DIR/inventory.ini"
PRIVATE_KEY="/run/services-secrets/id_home_lab"

if [[ ! -r "$PRIVATE_KEY" ]]; then
    echo "Brak $PRIVATE_KEY. Zamontuj katalog secrets." >&2
    exit 1
fi

install -d -m 0700 /root/.ssh
install -m 0600 "$PRIVATE_KEY" /root/.ssh/id_home_lab

run_stage() {
    local name="$1"
    local limit="$2"
    local playbook="$3"

    echo "===== START: $name ($limit) ====="
    ansible-playbook \
        -i "$INVENTORY" \
        -l "$limit" \
        -e ansible_become_flags=-n \
        "$ROOT_DIR/$playbook"
    echo "===== DONE: $name ($limit) ====="
}

run_stage "prepare Docker networks" "homelab" prepare.yml
run_stage "deploy DNS" onyx infrastructure/dns/playbook.yml
run_stage "deploy DNS" ruby infrastructure/dns/playbook.yml
run_stage "deploy proxy" ruby infrastructure/proxy/playbook.yml
run_stage "deploy Portainer" ruby infrastructure/portainer/playbook.yml

echo "===== SERVICES INSTALLATION COMPLETE ====="
