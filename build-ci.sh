#!/usr/bin/env bash
#
# PABB90 — Build local « comme la CI »
#
# Reproduit la chaîne de release.yml : la version d'amc épinglée par la CI
# (tarball GitHub), un HOME dédié avec un cache de packages vierge rempli
# depuis amalgame.lock, puis build.sh. Le binaire qui en sort est celui
# qu'on livre, à la plateforme près.
#
# Pourquoi : sur un poste où amc a une autre version et un cache accumulé,
# build.sh produit un binaire qui répond 401 à toute requête authentifiée
# (ROADMAP v3.0.22). Pour tester l'API en local, utiliser CE script.
#
#   ./build-ci.sh                  # → ./server-ci
#   OUT=/tmp/x ./build-ci.sh       # binaire ailleurs
#   ./build-ci.sh --refresh        # re-télécharge amc et vide le cache
#
# Tout vit dans ~/.cache/pabb90-ci/<version amc>/ (persistant, hors dépôt).
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"
OUT="${OUT:-./server-ci}"
AMC_VERSION=$(grep -oE 'AMC_VERSION: *"?[0-9.]+' .github/workflows/release.yml | head -1 | grep -oE '[0-9.]+$')
[ -n "$AMC_VERSION" ] || { echo "AMC_VERSION introuvable dans release.yml" >&2; exit 1; }

CACHE="$HOME/.cache/pabb90-ci/$AMC_VERSION"
if [ "${1:-}" = "--refresh" ]; then rm -rf "$CACHE"; fi
mkdir -p "$CACHE"

TOOL="$CACHE/amc-$AMC_VERSION-linux-x86_64"
if [ ! -x "$TOOL/bin/amc" ]; then
    echo "→ téléchargement amc $AMC_VERSION"
    curl -fsSL "https://github.com/amalgame-lang/Amalgame/releases/download/v${AMC_VERSION}/amc-${AMC_VERSION}-linux-x86_64.tar.gz" \
        | tar -xz -C "$CACHE"
fi

# HOME dédié : amc y range ~/.amalgame/packages sans toucher au vrai cache.
export HOME="$CACHE/home"
export PATH="$TOOL/bin:$PATH"
mkdir -p "$HOME"
echo "→ amc $("$TOOL/bin/amc" --version | head -1)"

# Packages : même recette que ci.yml — tout ce que liste le lock, puis
# net-http / tls / async en dernier (amalgame-web les rétrograde sinon).
# amc réécrit amalgame.lock/.toml : on travaille sur des copies et on
# vérifie qu'elles ressortent identiques, comme la CI.
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp amalgame.lock amalgame.toml "$WORK/"
(
    cd "$WORK"
    awk '/^\[\[package\]\]/{g="";t=""} /^git/{gsub(/"/,"",$3);g=$3} /^tag/{gsub(/"/,"",$3);t=$3; if (g!="") print g"@"t}' amalgame.lock \
        | while read -r p; do amc package add "$p" >/dev/null 2>&1 || { echo "amc package add $p a échoué" >&2; exit 1; }; done
    for p in net-http@v0.26.1 tls@v0.3.5 async@v0.4.0; do
        amc package add "github.com/amalgame-lang/amalgame-${p}" >/dev/null 2>&1 || exit 1
    done
)
if ! diff -q amalgame.lock "$WORK/amalgame.lock" >/dev/null; then
    echo "!! amalgame.lock diffère après résolution : le build ne serait pas celui de la CI" >&2
    diff amalgame.lock "$WORK/amalgame.lock" >&2 || true
    exit 1
fi
echo "→ packages résolus, lock identique"

OUT="$OUT" ./build.sh
