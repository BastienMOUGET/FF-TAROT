# win-build.ps1 — build local Windows de server.exe (boucle de test rapide).
#
# Reproduit le job CI (résolution packages + build.ps1) sur ton poste, pour
# itérer sans attendre GitHub Actions. Prérequis : amc 0.8.83 installé (MSI),
# MariaDB installé (pour libmariadb au link).
#
# Usage :  .\win-build.ps1
$ErrorActionPreference = 'Stop'

Write-Host "=== amc version (attendu 0.8.83) ===" -ForegroundColor Cyan
amc --version

# Cache propre : évite que de vieilles versions POSIX-only (pré-port Windows)
# trainent en cache et soient incluses par amc.
Write-Host "=== nettoyage cache packages ===" -ForegroundColor Cyan
amc package cache clear --all

# Pré-télécharge l'index packages avec --ssl-no-revoke. Sur ton poste, le
# curl Windows (schannel) échoue la vérif de révocation du certif quand amc
# auto-résout une dép transitive (ex. tls -> crypto). On met l'index en cache
# AVANT, pour qu'amc le lise au lieu de re-fetcher. (amc >= 0.8.84 passe ce
# flag nativement ; ceci débloque avec 0.8.83.)
Write-Host "=== pré-fetch index packages (contourne schannel revocation) ===" -ForegroundColor Cyan
$idxDir = "$env:USERPROFILE\.amalgame\cache"
New-Item -ItemType Directory -Force -Path $idxDir | Out-Null
curl.exe -fsSL --ssl-no-revoke `
    "https://raw.githubusercontent.com/amalgame-lang/packages-index/main/packages.toml" `
    -o "$idxDir\packages-index.toml"
if ($LASTEXITCODE -ne 0) { Write-Host "  (pré-fetch index échoué — on tente quand même)" -ForegroundColor Yellow }

# Mêmes packages/ordre que le CI. Les versions portées Winsock2 (net-http
# 0.25.0, tls 0.3.4, async 0.4.0) sont ré-ajoutées EN DERNIER pour que le
# lock (clé par nom) les garde malgré le downgrade de web.
$pkgs = @(
    'github.com/amalgame-lang/amalgame-crypto@v0.7.0',
    'github.com/amalgame-lang/amalgame-async@v0.4.0',
    'github.com/amalgame-lang/amalgame-datetime@v0.2.2',
    'github.com/amalgame-lang/amalgame-random@v0.1.0',
    'github.com/amalgame-lang/amalgame-logging@v0.2.0',
    'github.com/amalgame-lang/amalgame-compress@v0.1.0',
    'github.com/amalgame-lang/amalgame-threading@v0.1.0',
    'github.com/amalgame-lang/amalgame-tls@v0.3.4',
    'github.com/amalgame-lang/amalgame-database-nosql-redis@v0.2.0',
    'github.com/amalgame-lang/amalgame-net-http@v0.25.0',
    'github.com/amalgame-lang/amalgame-web@v0.36.1',
    'github.com/amalgame-lang/amalgame-service@v0.2.0',
    'github.com/amalgame-lang/amalgame-database-mysql@v0.3.0',
    'github.com/amalgame-lang/amalgame-net-http@v0.25.0',
    'github.com/amalgame-lang/amalgame-tls@v0.3.4',
    'github.com/amalgame-lang/amalgame-async@v0.4.0'
)
foreach ($p in $pkgs) {
    Write-Host "=== amc package add $p ===" -ForegroundColor DarkCyan
    amc package add $p
    if ($LASTEXITCODE -ne 0) { throw "amc package add $p a échoué" }
}

Write-Host "=== build.ps1 (amc -> server.c -> gcc link) ===" -ForegroundColor Cyan
.\build.ps1
