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

echo "[DEBUG] Files to check:"
printf ' - %s\n' "${K8S_FILES[@]}"

# Policz resources w każdym pliku
echo "[DEBUG] Resource count per file:"
for f in "${K8S_FILES[@]}"; do
    count=$(grep -c '^---' "$f" || true)
    count=$((count+1))
    echo "   $f → $count resources"
done

args=(-kubernetes-version "$KUBE_VERSION")
[[ "$STRICT" == "1" ]] && args+=(-strict)
[[ "$SUMMARY" == "1" ]] && args+=(-summary)
[[ "$STRICT_CRD" != "1" ]] && args+=(-ignore-missing-schemas)

echo "[DEBUG] Checking for invalid characters..."
bad_files=0
for f in "${K8S_FILES[@]}"; do
    if grep -q -P '[\x00-\x09\x0B\x0C\x0E-\x1F]' "$f"; then
        echo "✗ Invalid control characters in $f"
        bad_files=1
    fi
done
if [[ $bad_files -ne 0 ]]; then
    echo "✗ Found invalid characters in YAML files, aborting."
    exit 1
fi
echo "[INFO] Running kubeconform..."
set +e
tar -C "$REPO_ROOT" -cf - "${K8S_FILES[@]}" | \
docker run --rm -i ghcr.io/yannh/kubeconform:latest \
    "${args[@]}" -
status=$?
set -e

if [[ $status -ne 0 ]]; then
  echo "✗ Kubernetes YAML validation failed!"
  exit $status
else
  echo "✓ Kubernetes YAML is valid (schema)."
fi
