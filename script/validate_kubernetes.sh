#!/usr/bin/env bash

KUBE_VERSION="${KUBE_VERSION:-1.29.0}"
STRICT="${STRICT:-1}"
STRICT_CRD="${STRICT_CRD:-0}"
SUMMARY="${SUMMARY:-1}"

mapfile -t K8S_FILES < <(git ls-files | grep -E '(^|/)(manifest([^/]*?)\.ya?ml$' || true)

if ((${#K8S_FILES[@]}==0)); then
    echo "No k3s/k8s manifest files to check."
    exit 0
fi

args=( -kubernetes-version "$KUBE_VERSION" )
[[ "$STRICT" == "1" ]] && args+=( -strict )
[[ "$SUMMARY" == "1" ]] && args+=( -summary )
[[ "$STRICT_CRD" != "1" ]] && args+=( -ignore-missing-schemas )

docker run --rm -i \
  -v "$PWD":/work -w /work \
  ghcr.io/yannh/kubeconform:latest-alpine \
  "${args[@]}" "${K8S_FILES[@]}"

echo "✓ Kubernetes/k3s YAML is valid (schema)."