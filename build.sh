#!/usr/bin/env bash
# Build FF-TAROT (Amalgame/Mosaic, multi-fichier) → ./server
#
# Adapté de mosaic/tools/mosaic-build.sh : même résolution amc/runtime/lib
# et même link gcc, mais on passe TOUTES nos sources (server.am + lib/*.am +
# modules/**/*.am + routes.am) à amc au lieu de `entry _routes.am`, car on
# fait du routing manuel (pas de filesystem-routing).
set -euo pipefail

OUT="${OUT:-./server}"
ENTRY="server.am"

# ── Résolution amc + runtime ─────────────────────────────────────
AMC="${AMC:-}"
if [ -z "$AMC" ]; then
    if command -v amc >/dev/null 2>&1; then AMC="$(command -v amc)"
    elif [ -x "$HOME/.local/bin/amc" ];   then AMC="$HOME/.local/bin/amc"
    elif [ -x "$HOME/.amalgame/bin/amc" ]; then AMC="$HOME/.amalgame/bin/amc"
    else echo "error: amc not found" >&2; exit 1; fi
fi

AMC_RUNTIME="${AMC_RUNTIME:-}"
if [ -z "$AMC_RUNTIME" ]; then
    for cand in \
        "$HOME/.local/share/amalgame/runtime" \
        "/usr/local/share/amalgame/runtime" \
        "$(dirname "$AMC")/../share/amalgame/runtime" \
        "$(dirname "$(dirname "$AMC")")/../Amalgame/runtime"; do
        if [ -d "$cand" ]; then AMC_RUNTIME="$cand"; break; fi
    done
fi
[ -z "$AMC_RUNTIME" ] && { echo "error: AMC_RUNTIME not found"; exit 1; }

LIBAMALGAME=""
for cand in \
    "$HOME/.local/share/amalgame/lib/libamalgame.a" \
    "/usr/local/share/amalgame/lib/libamalgame.a" \
    "$(dirname "$AMC")/../share/amalgame/lib/libamalgame.a"; do
    if [ -f "$cand" ]; then LIBAMALGAME="$cand"; break; fi
done
[ -z "$LIBAMALGAME" ] && { echo "error: libamalgame.a not found"; exit 1; }

echo "→ amc          $AMC"
echo "→ amc runtime  $AMC_RUNTIME"
echo "→ libamalgame  $LIBAMALGAME"

[ -f amalgame.toml ] || { echo "error: no amalgame.toml in $PWD" >&2; exit 1; }
[ -f amalgame.lock ] || { echo "error: no amalgame.lock — run \`amc package add ...\` here" >&2; exit 1; }

# ── Step 1: collecte des sources ─────────────────────────────────
# Ordre = dépendances AVANT dépendants (amc émet les structs C dans
# l'ordre des fichiers ; un accès champ avant l'émission du struct →
# "incomplete typedef"). Donc : lib/ → modules/ → routes.am → server.am.
SOURCES=()
while IFS= read -r f; do SOURCES+=("$f"); done < <(
    find lib modules -name '*.am' 2>/dev/null | sort
)
[ -f routes.am ] && SOURCES+=("routes.am")
SOURCES+=("$ENTRY")
echo "→ sources      ${#SOURCES[@]} fichier(s)"

# ── Step 2: amc → server.c ───────────────────────────────────────
NAME="$(basename "${ENTRY%.am}")"
if ! "$AMC" "${SOURCES[@]}" -o "$NAME"; then
    echo "error: amc failed — see resolver errors above" >&2
    exit 1
fi
[ -f "$NAME.c" ] || { echo "error: amc didn't generate $NAME.c" >&2; exit 1; }

# ── Step 3: facades + libs système depuis amalgame.lock ──────────
PKG_INCLUDES=()
if [ -d "$HOME/.amalgame/packages/github.com/amalgame-lang" ]; then
    for pkg_parent in "$HOME/.amalgame/packages/github.com/amalgame-lang"/*/; do
        latest=$(ls -1 "$pkg_parent" 2>/dev/null | sort -V | tail -1)
        runtime_dir="${pkg_parent}${latest}/runtime"
        if [ -n "$latest" ] && [ -d "$runtime_dir" ]; then
            PKG_INCLUDES+=(-I"$runtime_dir")
        fi
    done
fi

PKG_ARCHIVES=()
SYS_LIBS=()
while IFS='|' read -r name git tag rev; do
    [ -z "${name:-}" ] && continue
    PKG_CACHE="$HOME/.amalgame/packages/$git/${tag}_${rev}"
    [ -d "$PKG_CACHE" ] || { echo "warn: pkg cache missing for $name: $PKG_CACHE" >&2; continue; }
    CLS=$(awk '/^classes/,/]/' "$PKG_CACHE/amalgame.toml" \
          | grep -oE '"[A-Z][A-Za-z0-9_]+"' | head -1 | tr -d '"' || true)
    if [ -z "$CLS" ]; then
        CLS=$(grep -E '^[[:space:]]*class[[:space:]]*=' "$PKG_CACHE/amalgame.toml" \
              | grep -oE '"[A-Za-z_][A-Za-z0-9_]*"' | head -1 | tr -d '"' || true)
    fi
    [ -z "$CLS" ] && { echo "warn: no class in $PKG_CACHE/amalgame.toml — skipping" >&2; continue; }
    ARCHIVE="$PKG_CACHE/build/linux-x86_64/libamalgame-pkg-${CLS}.a"
    if [ ! -f "$ARCHIVE" ]; then
        echo "→ precompiling facade for $name ($CLS)"
        mkdir -p "$PKG_CACHE/build/linux-x86_64"
        (cd "$PKG_CACHE" && \
         "$AMC" --lib --quiet -o "build/linux-x86_64/${CLS}-facade" facade.am >/dev/null && \
         gcc -O2 -Iruntime -I"$AMC_RUNTIME" "${PKG_INCLUDES[@]}" \
             -c "build/linux-x86_64/${CLS}-facade.c" \
             -o "build/linux-x86_64/${CLS}-facade.o" && \
         ar rcs "build/linux-x86_64/libamalgame-pkg-${CLS}.a" \
                "build/linux-x86_64/${CLS}-facade.o")
    fi
    PKG_ARCHIVES+=("$ARCHIVE")
    while IFS= read -r lib; do
        [ -n "$lib" ] && SYS_LIBS+=("-l$lib")
    done < <(awk '/^libs[[:space:]]*=/,/]/' "$PKG_CACHE/amalgame.toml" \
             | grep -oE '"[a-z0-9_+-]+"' | tr -d '"' || true)
done < <(awk '
    BEGIN { name=""; git=""; tag=""; rev=""; in_pkg=0 }
    /^\[\[package\]\]/ { if (in_pkg && name!="") print name "|" git "|" tag "|" rev; in_pkg=1; name=""; git=""; tag=""; rev=""; next }
    /^\[\[/ { if (in_pkg && name!="") print name "|" git "|" tag "|" rev; in_pkg=0; next }
    in_pkg && /^[[:space:]]*name[[:space:]]*=/ { match($0, /"[^"]*"/); name=substr($0,RSTART+1,RLENGTH-2) }
    in_pkg && /^[[:space:]]*git[[:space:]]*=/  { match($0, /"[^"]*"/); git=substr($0,RSTART+1,RLENGTH-2) }
    in_pkg && /^[[:space:]]*tag[[:space:]]*=/  { match($0, /"[^"]*"/); tag=substr($0,RSTART+1,RLENGTH-2) }
    in_pkg && /^[[:space:]]*rev[[:space:]]*=/  { match($0, /"[^"]*"/); rev=substr($0,RSTART+1,RLENGTH-2) }
    END { if (in_pkg && name!="") print name "|" git "|" tag "|" rev }
' amalgame.lock)

# ── Step 4: gcc link ─────────────────────────────────────────────
GCC_CMD=(gcc -O2 -I"$AMC_RUNTIME" "${PKG_INCLUDES[@]}"
         -Wno-int-conversion -Wno-incompatible-pointer-types
         "$NAME.c"
         -Wl,--start-group
         "${PKG_ARCHIVES[@]}" "$LIBAMALGAME"
         -Wl,--end-group
         -lgc -lm -lz "${SYS_LIBS[@]}"
         -o "$OUT")
"${GCC_CMD[@]}"
echo "✓ built $OUT"
