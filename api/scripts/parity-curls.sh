#!/usr/bin/env bash
# Parity curl matrix for plan 022 (Supabase migration).
# Captures ten /v1/* responses as canonical-JSON snapshots. Used to diff
# pre-cutover (RDS) vs post-cutover (Supabase) and staging vs prod during
# the 24h soak.
#
# Usage:
#   BASE_URL=https://api.festivus.hapticlabs.ai \
#   OUT_DIR=api/scripts/parity-baseline \
#   bash api/scripts/parity-curls.sh
#
# Requires: curl, jq.

set -euo pipefail

BASE_URL="${BASE_URL:?set BASE_URL, e.g. https://api.festivus.hapticlabs.ai}"
OUT_DIR="${OUT_DIR:?set OUT_DIR, e.g. api/scripts/parity-baseline}"
# Optional: RESOLVE='staging-api.festivus.hapticlabs.ai:80:3.149.60.233' when DNS isn't set yet.
RESOLVE="${RESOLVE:-}"

CURL_EXTRA=()
if [[ -n "$RESOLVE" ]]; then
  CURL_EXTRA+=(--resolve "$RESOLVE")
fi

mkdir -p "$OUT_DIR"

# 3 policies, 3 datasets, 2 robots, 2 search = 10 endpoints.
# Slugs picked from real prod data 2026-04-19 (spread across the dataset).
declare -a ENDPOINTS=(
  "policies/openvla-openvla-7b|policy-openvla.json"
  "policies/ucsc-vlaa-vit-h-14-clipa-336-laion2b|policy-ucsc-vlaa.json"
  "policies/ashunsasaki-so101-pp-box-3col-bg-gray-300-policy-rev1|policy-so101.json"
  "datasets/ropedia-ai-xperience-10m|dataset-xperience.json"
  "datasets/moretorque-rlogs|dataset-moretorque.json"
  "datasets/bytedance-seed-bytecameradepth|dataset-bytecamera.json"
  "robots/boston-dynamics-atlas|robot-atlas.json"
  "robots/unitree-h1|robot-unitree-h1.json"
  "search?q=unitree|search-unitree.json"
  "search?q=aloha|search-aloha.json"
)

for ep in "${ENDPOINTS[@]}"; do
  path="${ep%%|*}"
  out="${ep##*|}"
  url="${BASE_URL}/v1/${path}"
  echo "GET $url"
  # -S shows errors, -f fails on non-2xx so the script halts on a bad URL.
  # jq -S sorts keys so diffs are stable regardless of server map ordering.
  if [[ ${#CURL_EXTRA[@]} -gt 0 ]]; then
    curl -sS -f --max-time 30 "${CURL_EXTRA[@]}" "$url" | jq -S . > "$OUT_DIR/$out"
  else
    curl -sS -f --max-time 30 "$url" | jq -S . > "$OUT_DIR/$out"
  fi
done

echo ""
echo "Wrote $(ls "$OUT_DIR"/*.json | wc -l | tr -d ' ') snapshots to $OUT_DIR/"
