#!/usr/bin/env bash
set -euo pipefail

KUBE_VERSION="${KUBE_VERSION:-1.29.0}"
STRICT="${STRICT:-1}"
STRICT_CRD="${STRICT_CRD:-0}"
SUMMARY="${SUMMARY:-1}"

REPO_ROOT="$(git rev-parse --show-toplevel)"

mapfile -t K8S_FILES < <(
    git -C "$REPO_ROOT" ls-files | grep -E '(^|/)manifest([^/]*?)\.ya?ml$' || true
)

if ((${#K8S_FILES[@]}==0)); then
    echo "No k3s/k8s manifest files to check."
    exit 0
fi

args=(-kubernetes-version "$KUBE_VERSION")
[[ "$STRICT" == "1" ]] && args+=(-strict)
[[ "$SUMMARY" == "1" ]] && args+=(-summary)
[[ "$STRICT_CRD" != "1" ]] && args+=(-ignore-missing-schemas)

echo "[DEBUG] PWD=$PWD"
echo "[DEBUG] REPO_ROOT=$REPO_ROOT"
echo "[DEBUG] Files to check:"
printf ' - %s\n' "${K8S_FILES[@]}"

set +e
docker run --rm -i \
  -v "$REPO_ROOT":/work -w /work \
  ghcr.io/yannh/kubeconform:latest-alpine \
  "${args[@]}" "${K8S_FILES[@]}"
status=$?
set -e

if [[ $status -ne 0 ]]; then
  echo "✗ Kubernetes/k3s YAML validation failed!"
  exit $status
else
  echo "✓ Kubernetes/k3s YAML is valid (schema)."
fi
