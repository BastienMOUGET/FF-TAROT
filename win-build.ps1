# win-build.ps1 — build local Windows de server.exe (boucle de test rapide).
#
# Reproduit le job CI (résolution packages + build.ps1) sur ton poste, pour
# itérer sans attendre GitHub Actions. Prérequis : amc 0.8.83 installé (MSI),
# MariaDB installé (pour libmariadb au link).
#
# Usage :  .\win-build.ps1
$ErrorActionPreference = 'Stop'

# Auto-alignement sur origin/main. `amc package add` réécrit amalgame.lock à
# chaque run, ce qui salit l'arbre et fait échouer (silencieusement) git pull
# en fast-forward — on restait coincé sur un vieux commit. On force donc l'état
# distant ici. (Le script en cours est déjà chargé en mémoire : une éventuelle
# MAJ de win-build.ps1 lui-même prend effet au run suivant.)
Write-Host "=== alignement sur origin/main (git reset --hard) ===" -ForegroundColor Cyan
git fetch origin 2>&1 | Out-Null
git reset --hard origin/main
git log --oneline -1

# amc résout HOME pour le cache index ; sur Windows HOME est vide → il tombe
# sur un chemin POSIX cassé (/tmp). On force HOME = USERPROFILE pour que le
# cache index, le cache packages et notre pré-fetch pointent au même endroit.
# (amc >= 0.8.84 gère ce fallback nativement.)
$env:HOME = $env:USERPROFILE

# Shim `uname` : amc s'en sert pour nommer le dossier de précompilation des
# façades (build/<plateforme>/). Sur Windows, uname n'existe pas → amc tombe
# sur "unknown-unknown" et build.ps1 (qui filtre sur "win") ne trouve pas les
# archives libamalgame-pkg-*.a → symboles non résolus au link. On fournit un
# uname.cmd minimal sur le PATH. (amc >= 0.8.85 détecte la plateforme nativement.)
$shimDir = "$env:TEMP\amc-shim"
New-Item -ItemType Directory -Force -Path $shimDir | Out-Null
@'
@echo off
if "%~1"=="-s" echo MINGW64_NT
if "%~1"=="-m" echo x86_64
'@ | Set-Content -Encoding ascii "$shimDir\uname.cmd"
$env:PATH = "$shimDir;$env:PATH"

Write-Host "=== amc version ===" -ForegroundColor Cyan
amc --version

# Cache propre. On utilise Remove-Item -Force (et PAS `amc package cache
# clear --all`) : le rm natif d'amc 0.8.83 laisse des dossiers partiels sur
# Windows quand un fichier est read-only/verrouillé (d'où des "missing
# amalgame.toml" sur un paquet "already cached"). -Force gère le read-only.
Write-Host "=== nettoyage cache packages (Remove-Item -Force) ===" -ForegroundColor Cyan
Remove-Item -Recurse -Force "$env:HOME\.amalgame\packages" -ErrorAction SilentlyContinue
Remove-Item -Force "$env:HOME\.amalgame\cache\packages-index.toml" -ErrorAction SilentlyContinue

# Pré-télécharge l'index avec --ssl-no-revoke (le curl Windows/schannel échoue
# sinon la vérif de révocation quand amc auto-résout une dép transitive).
# Chemin = celui qu'amc lit (HOME/.amalgame/cache), HOME forcé plus haut.
Write-Host "=== pré-fetch index packages (contourne schannel revocation) ===" -ForegroundColor Cyan
$idxDir = "$env:HOME\.amalgame\cache"
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
    'github.com/amalgame-lang/amalgame-tls@v0.3.5',
    'github.com/amalgame-lang/amalgame-database-nosql-redis@v0.2.0',
    'github.com/amalgame-lang/amalgame-net-http@v0.25.0',
    'github.com/amalgame-lang/amalgame-web@v0.36.1',
    'github.com/amalgame-lang/amalgame-service@v0.2.0',
    'github.com/amalgame-lang/amalgame-database-mysql@v0.3.0',
    'github.com/amalgame-lang/amalgame-net-http@v0.25.0',
    'github.com/amalgame-lang/amalgame-tls@v0.3.5',
    'github.com/amalgame-lang/amalgame-async@v0.4.0'
)
foreach ($p in $pkgs) {
    Write-Host "=== amc package add $p ===" -ForegroundColor DarkCyan
    amc package add $p
    if ($LASTEXITCODE -ne 0) { throw "amc package add $p a échoué" }
}

Write-Host "=== build.ps1 (amc -> server.c -> gcc link) ===" -ForegroundColor Cyan
.\build.ps1
