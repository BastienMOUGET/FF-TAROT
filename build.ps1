# Build FF-TAROT (Amalgame/Mosaic) → server.exe  (Windows, port de build.sh)
#
# Prérequis runner/poste :
#   - amc installé (irm https://.../install/windows/install.ps1 | iex) →
#     fournit amc.exe + MinGW gcc + runtime + libamalgame (Windows)
#   - MariaDB Connector/C (libmariadb) pour le link -lmariadb
#   - amc package add (web, net-http, crypto, mysql, threading, service) exécutés
#     AVANT, dans ce dossier, pour générer amalgame.lock + compiler les facades.
#
# NOTE : premier build Windows de l'app — à valider/itérer en CI.
$ErrorActionPreference = 'Stop'

$Out = if ($env:OUT) { $env:OUT } else { ".\server.exe" }

# ── Résolution amc + runtime + libamalgame ───────────────────────
$Amc = (Get-Command amc.exe -ErrorAction SilentlyContinue)?.Source
if (-not $Amc) {
    foreach ($c in @("$env:LOCALAPPDATA\Amalgame\bin\amc.exe", "$env:USERPROFILE\.amalgame\bin\amc.exe")) {
        if (Test-Path $c) { $Amc = $c; break }
    }
}
if (-not $Amc) { throw "amc.exe introuvable (installer la toolchain Amalgame Windows)." }

$Prefix = Split-Path (Split-Path $Amc)
$AmcRuntime = "$Prefix\share\amalgame\runtime"
$LibAmalgame = "$Prefix\share\amalgame\lib\libamalgame.a"
if (-not (Test-Path $AmcRuntime)) { throw "runtime introuvable : $AmcRuntime" }
if (-not (Test-Path $LibAmalgame)) { throw "libamalgame introuvable : $LibAmalgame" }

Write-Host "amc        : $Amc"
Write-Host "runtime    : $AmcRuntime"
Write-Host "libamalgame: $LibAmalgame"

if (-not (Test-Path amalgame.lock)) { throw "amalgame.lock absent — lancez 'amc package add ...' ici d'abord." }

# ── Step 1 : collecte des sources (lib/ → modules/ → routes.am → server.am) ──
$Sources = @()
$Sources += (Get-ChildItem -Recurse -Path lib, modules -Filter *.am | Sort-Object FullName | ForEach-Object FullName)
if (Test-Path routes.am) { $Sources += (Resolve-Path routes.am).Path }
$Sources += (Resolve-Path server.am).Path
Write-Host "sources    : $($Sources.Count) fichier(s)"

# ── Step 2 : amc → server.c ──────────────────────────────────────
& $Amc @Sources -o server
if ($LASTEXITCODE -ne 0 -or -not (Test-Path server.c)) { throw "amc a échoué (server.c non généré)." }

# ── Step 3 : -I des runtimes packages + archives depuis amalgame.lock ─────────
$PkgRoot = "$env:USERPROFILE\.amalgame\packages\github.com\amalgame-lang"
$Includes = @("-I$AmcRuntime")
if (Test-Path $PkgRoot) {
    Get-ChildItem -Directory $PkgRoot | ForEach-Object {
        $latest = (Get-ChildItem -Directory $_.FullName | Sort-Object Name | Select-Object -Last 1)
        $rt = Join-Path $latest.FullName 'runtime'
        if (Test-Path $rt) { $Includes += "-I$rt" }
    }
}

# Archives de facades (libamalgame-pkg-*.a) générées par amc package add.
$Archives = @()
$SysLibs  = @()
Get-ChildItem -Recurse -Path $PkgRoot -Filter 'libamalgame-pkg-*.a' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match 'win' } | ForEach-Object { $Archives += $_.FullName }

# Libs système : libmariadb (driver mysql) + bdwgc + openssl + zlib + threads.
$SysLibs = @('-lmariadb', '-lgc', '-lssl', '-lcrypto', '-lz', '-lws2_32', '-lbcrypt')

# ── Step 4 : gcc (MinGW) link ────────────────────────────────────
$gcc = (Get-Command gcc.exe -ErrorAction SilentlyContinue)?.Source
if (-not $gcc) { $gcc = "$Prefix\gcc-bundle\bin\gcc.exe" }
if (-not (Test-Path $gcc)) { throw "gcc (MinGW) introuvable." }

$cmd = @($Includes) + @('-O2', '-Wno-int-conversion', '-Wno-incompatible-pointer-types',
        'server.c', '-Wl,--start-group') + $Archives + @($LibAmalgame, '-Wl,--end-group') +
        $SysLibs + @('-o', $Out)
Write-Host "link: gcc $($cmd -join ' ')"
& $gcc @cmd
if ($LASTEXITCODE -ne 0) { throw "gcc link a échoué." }
Write-Host "OK built $Out"
