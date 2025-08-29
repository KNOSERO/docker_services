#!/usr/bin/env bash

KUBE_VERSION="${KUBE_VERSION:-1.29.0}"
STRICT="${STRICT:-1}"
STRICT_CRD="${STRICT_CRD:-0}"
SUMMARY="${SUMMARY:-1}"

REPO_ROOT="$(git rev-parse --show-toplevel)"

mapfile -t K8S_FILES < <(
    git -C "$REPO_ROOT" ls-files | grep -E '(^|/)manifest([^/]*?)\.ya?ml$' || true
)
if ((${#K8S_FILES[@]}==0)); then
    echo "No Kubernetes manifest files to check."
    exit 0
fi

if ! command -v kubeconform >/dev/null 2>&1; then
  echo "[INFO] Downloading kubeconform..."
  curl -sSL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz \
    | tar -xz -C /usr/local/bin
fi

args=(-kubernetes-version "$KUBE_VERSION")
[[ "$STRICT" == "1" ]] && args+=(-strict)
[[ "$SUMMARY" == "1" ]] && args+=(-summary)
[[ "$STRICT_CRD" != "1" ]] && args+=(-ignore-missing-schemas)

echo "[INFO] Running kubeconform (local binary)..."
kubeconform "${args[@]}" "${K8S_FILES[@]}"