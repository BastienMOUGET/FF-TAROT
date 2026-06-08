#!/usr/bin/env bash
# Lance le back AM en exportant .env (le back lit l'env process via Env.Get).
set -euo pipefail
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi
exec ./server
