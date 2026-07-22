#!/usr/bin/env bash
#
# Build ALL soloqueue tiers + the pro dataset into a frontend app's public/datasets.
# No S3/bucket needed — writes straight to the local filesystem.
#
# Usage:
#   ./build-tiers.sh [target-app] [oe1.csv oe2.csv ...]
#
# Examples:
#   ./build-tiers.sh                       # target frontend-v2, OE CSVs auto-found in ~/Downloads
#   ./build-tiers.sh frontend-v2 ~/Downloads/*OraclesElixir*.csv
#   ./build-tiers.sh frontend ./2025.csv ./2026.csv
#
# Notes:
#   * The soloqueue crawl hits lolalytics for every champion/role/tier and takes a
#     while (tens of minutes for 4 tiers) — that's expected.
#   * Higher tiers (master_plus) have smaller samples; missing champion/role data is
#     handled gracefully, the build won't crash.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"        # apps/dataset
APP="${1:-frontend-v2}"                       # default target: the ship (v2)
[ $# -gt 0 ] && shift || true                 # remaining args = OE CSV paths
DATASETS="$HERE/../$APP/public/datasets"

if [ ! -d "$HERE/../$APP" ]; then
    echo "✗ App '$APP' not found at apps/$APP" >&2
    exit 1
fi

export DATASET_LOCAL_DIR="$DATASETS"                                   # write locally, no S3
export TIERS="platinum_plus,emerald_plus,diamond_plus,master_plus"     # all four tiers
export PRO_PRIOR_TIER="diamond_plus"                                   # pro blends onto Diamond+
export PRO_OUTPUT="$DATASETS/pro-current-patch.json"                   # pro output for THIS app

echo "▶ Target app        : apps/$APP"
echo "▶ Datasets dir      : $DATASETS"
echo "▶ Building tiers     : $TIERS"
echo

# 1) Soloqueue tiers (scrapes lolalytics) -----------------------------------
echo "=== [1/2] Building soloqueue tiers (this is the long part) ==="
bun run "$HERE/src/index.ts"

# 2) Pro dataset on the Diamond+ prior --------------------------------------
CSVS=("$@")
if [ ${#CSVS[@]} -eq 0 ]; then
    shopt -s nullglob
    CSVS=("$HOME/Downloads/"*OraclesElixir*.csv "$HOME/Downloads/"*oracleselixir*.csv)
fi

echo
if [ ${#CSVS[@]} -gt 0 ]; then
    echo "=== [2/2] Rebuilding pro dataset on the $PRO_PRIOR_TIER prior ==="
    printf '   CSV: %s\n' "${CSVS[@]}"
    bun run "$HERE/src/pro-local.ts" "${CSVS[@]}"
else
    echo "=== [2/2] Skipped: no Oracle's Elixir CSVs found ==="
    echo "   Pass CSV paths as args, or drop *OraclesElixir*.csv into ~/Downloads, then rerun."
fi

echo
echo "✔ Done. Contents of $DATASETS/v5:"
ls -1 "$DATASETS/v5"
echo "  + $(basename "$PRO_OUTPUT") (pro)"
