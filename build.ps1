# Build PABB90 (Amalgame/Mosaic) → server.exe  (Windows, port de build.sh)
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

# MariaDB (serveur OU Connector/C) : headers (mysql.h) + lib (libmariadb).
$ConnRoots = Get-ChildItem 'C:\Program Files' -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'MariaDB*' }
foreach ($r in $ConnRoots) {
    $inc = Join-Path $r.FullName 'include'
    $lib = Join-Path $r.FullName 'lib'
    if (Test-Path $inc) {
        $Includes += "-I$inc"
        if (Test-Path (Join-Path $inc 'mysql'))   { $Includes += "-I$(Join-Path $inc 'mysql')" }
        if (Test-Path (Join-Path $inc 'mariadb')) { $Includes += "-I$(Join-Path $inc 'mariadb')" }
    }
    if (Test-Path $lib) {
        $Includes += "-L$lib"
        # libmariadb.lib (import) parfois sous lib\mariadb\
        if (Test-Path (Join-Path $lib 'mariadb')) { $Includes += "-L$(Join-Path $lib 'mariadb')" }
    }
}

# Libs système : libmariadb (driver mysql) + bdwgc + openssl + zlib + threads.
$SysLibs = @('-lmariadb', '-lgc', '-lssl', '-lcrypto', '-lz', '-lws2_32', '-lbcrypt')

# ── Step 4 : gcc (MinGW) link ────────────────────────────────────
# PRÉFÉRER le gcc bundlé par amc ($Prefix\gcc\bin) : c'est lui qui a compilé
# le libgc.a embarqué (gc.h + libgc.a sont dans son include/lib). Linker avec
# un autre gcc (ex. C:\mingw64 du runner) provoque un mismatch d'ABI
# (__imp__setjmp) ou un gc.h introuvable. Fallback PATH si le bundle est absent.
$gcc = "$Prefix\gcc\bin\gcc.exe"
if (-not (Test-Path $gcc)) { $gcc = (Get-Command gcc.exe -ErrorAction SilentlyContinue)?.Source }
if (-not $gcc -or -not (Test-Path $gcc)) { throw "gcc (MinGW) introuvable." }
Write-Host "gcc        : $gcc"

# -static-libgcc : embarque le runtime gcc dans l'exe (moins de DLL à bundler).
$cmd = @($Includes) + @('-O2', '-static-libgcc', '-Wno-int-conversion', '-Wno-incompatible-pointer-types',
        'server.c', '-Wl,--start-group') + $Archives + @($LibAmalgame, '-Wl,--end-group') +
        $SysLibs + @('-o', $Out)
Write-Host "link: gcc $($cmd -join ' ')"
& $gcc @cmd
if ($LASTEXITCODE -ne 0) { throw "gcc link a échoué." }
Write-Host "OK built $Out"

# ── Step 5 : bundle des DLL réellement requises (uniquement) ──────
# objdump -p liste les DLL dont dépend l'exe. On copie celles qui ne sont
# PAS des DLL système Windows (depuis le PATH : MinGW, libmariadb, openssl…).
$objdump = Join-Path (Split-Path $gcc) 'objdump.exe'
$DllDir = if ($env:DLL_DIR) { $env:DLL_DIR } else { '.\windows-dll' }
New-Item -ItemType Directory -Force -Path $DllDir | Out-Null
$systemDlls = @('kernel32','user32','advapi32','ws2_32','msvcrt','ucrtbase','bcrypt',
    'crypt32','ole32','shell32','secur32','gdi32','ntdll','rpcrt4','shlwapi',
    'api-ms-','ext-ms-','vcruntime','kernelbase','setupapi','iphlpapi','dnsapi','version','psapi')
$pathDirs = $env:PATH.Split(';') | Where-Object { $_ -and (Test-Path $_) }
$seen = @{}
function Copy-Deps($exe) {
    if (-not (Test-Path $objdump)) { return }
    $deps = & $objdump -p $exe | Select-String 'DLL Name:' | ForEach-Object { ($_ -split ':')[1].Trim() }
    foreach ($d in $deps) {
        $low = $d.ToLower()
        if ($seen.ContainsKey($low)) { continue }
        $seen[$low] = $true
        if ($systemDlls | Where-Object { $low.StartsWith($_) -or $low -eq "$_.dll" }) { continue }
        $found = $pathDirs | ForEach-Object { Join-Path $_ $d } | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($found) {
            Copy-Item $found $DllDir -Force
            Write-Host "  bundle DLL: $d  ($found)"
            Copy-Deps $found   # récursif (deps des deps)
        } else {
            Write-Host "  (DLL non trouvée sur PATH, à vérifier): $d"
        }
    }
}
Copy-Deps (Resolve-Path $Out).Path
Write-Host "DLL bundlées dans $DllDir :"
Get-ChildItem $DllDir -Filter *.dll | ForEach-Object { Write-Host "  $($_.Name)" }
