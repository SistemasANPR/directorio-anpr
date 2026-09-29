#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "[post-merge] Installing locked dependencies"
npm ci --include=dev --no-audit --no-fund

echo "[post-merge] Running regression checks"
npm run check:image-boundaries
npm run check:admin-export
npm run check:admin-export-client

echo "[post-merge] Building application"
npm run build

# Database changes require a reviewed migration; never force a schema push here.
# The platform reconciles/restarts managed workflows after this script succeeds.
echo "[post-merge] Setup complete"