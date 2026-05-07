# =====================================================
# FF-TAROT — Installeur Windows clé en main (PowerShell)
# =====================================================
#
# Installe automatiquement :
#   - Node.js LTS (via winget) si absent
#   - MariaDB serveur (via winget) si absent
#   - Crée la base `fft` + un utilisateur dédié avec mot de passe aléatoire
#   - Construit le front Angular si pas déjà pré-buildé
#   - Crée start.bat / stop.bat à la racine
#   - Crée un raccourci "FF-TAROT" sur le Bureau (sauf si -NoShortcut)
#   - Lance le serveur et ouvre le navigateur (sauf si -NoStart)
#
# Usage (clic droit -> Exécuter avec PowerShell, OU dans une console admin) :
#   PS> .\install.ps1
#
# Paramètres :
#   -NoShortcut   Pas de raccourci Bureau (utilisé par Inno Setup qui crée
#                 ses propres raccourcis via [Icons]).
#   -NoStart      Ne pas lancer le serveur ni ouvrir le navigateur à la fin
#                 (utilisé par Inno Setup qui gère sa propre étape postinstall).
#
# Si la politique d'exécution refuse, lancer une fois en admin :
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#
# Prérequis : Windows 10/11 + winget (déjà inclus sur W10 1809+ via App Installer).

param(
    [switch]$NoShortcut,
    [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Step([string]$msg) { Write-Host "[FFT] $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Write-Warn2([string]$msg){ Write-Host "[!!]  $msg" -ForegroundColor Yellow }
function Write-Err2([string]$msg) { Write-Host "[KO]  $msg" -ForegroundColor Red }

function Require-Admin {
    $cur = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $cur.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Err2 "Cet installeur doit être lancé en administrateur (winget service)."
        Write-Host  "Ouvrir PowerShell en admin (clic droit -> Exécuter en tant qu'administrateur) puis relancer .\install.ps1"
        exit 1
    }
}

function New-RandomPassword([int]$len = 24) {
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.ToCharArray()
    $rnd   = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $len
    $rnd.GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Refresh-Env {
    # Recharge le PATH après installation winget (sinon node/mysql introuvables)
    $machine = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $user    = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
    $env:PATH = "$machine;$user"
}

function Wait-Service([string]$name, [int]$timeoutSec = 60) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq 'Running') { return $true }
        Start-Sleep -Seconds 2
        try { Start-Service -Name $name -ErrorAction SilentlyContinue } catch {}
    }
    return $false
}

# ----------------------------------------------------------
Require-Admin

$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Step "Installation dans : $InstallDir"

# ---------------------------- winget ----------------------------

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err2 "winget introuvable. Installer d'abord 'App Installer' depuis le Microsoft Store."
    Write-Host "Lien : https://apps.microsoft.com/store/detail/app-installer/9NBLGGH4NNS1"
    exit 1
}

# ---------------------------- Install Node.js LTS ----------------------------

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Step "Installation Node.js LTS via winget..."
    winget install --id OpenJS.NodeJS.LTS --silent `
        --accept-package-agreements --accept-source-agreements
    Refresh-Env
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err2 "Node introuvable après install. Réessayer après reboot."
        exit 1
    }
} else {
    $cur = (& node -v).TrimStart('v').Split('.')[0]
    if ([int]$cur -lt 20) {
        Write-Warn2 "Node $cur trop ancien (>= 20 requis). Upgrade via winget..."
        winget upgrade --id OpenJS.NodeJS.LTS --silent `
            --accept-package-agreements --accept-source-agreements
        Refresh-Env
    }
}
Write-Ok "Node $(node -v) OK"

# ---------------------------- Install MariaDB ----------------------------

if (-not (Get-Service -Name 'MariaDB' -ErrorAction SilentlyContinue)) {
    Write-Step "Installation MariaDB serveur via winget..."
    winget install --id MariaDB.Server --silent `
        --accept-package-agreements --accept-source-agreements
    Refresh-Env
}
if (-not (Wait-Service -name 'MariaDB' -timeoutSec 90)) {
    Write-Err2 "Le service MariaDB ne démarre pas. Vérifier l'install manuellement."
    exit 1
}
Write-Ok "Service MariaDB en cours"

# Localiser le client mysql.exe
$MysqlBin = (Get-Command mysql -ErrorAction SilentlyContinue)?.Source
if (-not $MysqlBin) {
    $candidate = Get-ChildItem 'C:\Program Files\MariaDB*\bin\mysql.exe' -ErrorAction SilentlyContinue |
                 Select-Object -First 1
    if ($candidate) { $MysqlBin = $candidate.FullName }
}
if (-not $MysqlBin) {
    Write-Err2 "mysql.exe introuvable. Vérifier l'install MariaDB."
    exit 1
}
Write-Ok "Client mysql : $MysqlBin"

# ---------------------------- Configuration DB ----------------------------

$DB_NAME = 'fft'
$DB_USER = 'fft_user'
$EnvFile = Join-Path $InstallDir '.env'

if (Test-Path $EnvFile) {
    $existing = Get-Content $EnvFile
    $DB_PASSWORD = ($existing | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace '^DB_PASSWORD=', ''
    $JWT_SECRET  = ($existing | Where-Object { $_ -match '^JWT_SECRET=' })  -replace '^JWT_SECRET=', ''
}
if (-not $DB_PASSWORD) { $DB_PASSWORD = New-RandomPassword -len 24 }
if (-not $JWT_SECRET)  { $JWT_SECRET  = (New-RandomPassword -len 24) + (New-RandomPassword -len 24) }

Write-Step "Création de la base $DB_NAME et de l'utilisateur $DB_USER..."

# MariaDB sur Windows : par défaut, root@localhost utilise auth Windows
# (unix_socket n'est pas dispo, c'est l'auth nommée). On essaie sans password.
$sqlInit = @"
CREATE DATABASE IF NOT EXISTS ``$DB_NAME`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON ``$DB_NAME``.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
"@

$sqlInit | & $MysqlBin --user=root
if ($LASTEXITCODE -ne 0) {
    Write-Err2 "Échec connexion mysql -u root sans password."
    Write-Host  "Si root MariaDB a un mot de passe, exporte-le dans la session puis relance :"
    Write-Host  '   $env:MYSQL_PWD = "ton_pwd_root"'
    exit 1
}
Write-Ok "Base $DB_NAME prête"

Write-Step "Application du schéma db.sql + seed.sql..."
Get-Content (Join-Path $InstallDir 'db.sql')   | & $MysqlBin --user=root
Get-Content (Join-Path $InstallDir 'seed.sql') | & $MysqlBin --user=root $DB_NAME
Write-Ok "Schéma + seed appliqués"

# ---------------------------- .env ----------------------------

@"
PORT=3000

DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=12h
"@ | Out-File -FilePath $EnvFile -Encoding ASCII -Force
Write-Ok ".env généré"

# ---------------------------- npm install + build ----------------------------

Write-Step "Installation dépendances back (npm install)..."
Push-Location $InstallDir
& npm install --omit=dev --no-fund --no-audit
Pop-Location

$FrontIndex = Join-Path $InstallDir 'frontend\dist\frontend\browser\index.html'
if (Test-Path $FrontIndex) {
    Write-Ok "Front déjà pré-buildé (release package), skip de l'install/build front"
} else {
    Write-Step "Installation dépendances front + build (peut prendre 1-2 min)..."
    Push-Location (Join-Path $InstallDir 'frontend')
    & npm install --no-fund --no-audit
    & npm run build
    Pop-Location
    Write-Ok "Front buildé dans frontend\dist\frontend\browser"
}

# ---------------------------- Service Windows via NSSM ----------------------------

# NSSM transforme node.exe en vrai service Windows :
#   - démarre au boot (auto)
#   - redémarre tout seul en cas de crash
#   - logs dans logs\server.log

$ServiceName = 'FF-TAROT'
$LogsDir     = Join-Path $InstallDir 'logs'
New-Item -Path $LogsDir -ItemType Directory -Force | Out-Null

# Localiser NSSM (priorité : bundle dans installer/, puis dans bin/, puis téléchargement)
$NssmExe = $null
$NssmCandidates = @(
    (Join-Path $InstallDir 'bin\nssm.exe'),
    (Join-Path $InstallDir 'installer\bin\nssm.exe')
)
foreach ($c in $NssmCandidates) {
    if (Test-Path $c) { $NssmExe = $c; break }
}

if (-not $NssmExe) {
    $NssmDir = Join-Path $InstallDir 'bin'
    New-Item -Path $NssmDir -ItemType Directory -Force | Out-Null
    $TargetNssm = Join-Path $NssmDir 'nssm.exe'

    # Source 1 : Chocolatey s'il est installé sur la machine
    $Choco = Get-Command choco.exe -ErrorAction SilentlyContinue
    if ($Choco) {
        Write-Step "Installation de NSSM via Chocolatey..."
        try {
            & choco install nssm -y --no-progress --no-color | Out-Null
            $candidates = @(
                'C:\ProgramData\chocolatey\lib\nssm\tools\nssm.exe',
                'C:\ProgramData\chocolatey\bin\nssm.exe'
            )
            foreach ($c in $candidates) {
                if (Test-Path $c) {
                    Copy-Item $c $TargetNssm -Force
                    $NssmExe = $TargetNssm
                    Write-Ok "NSSM récupéré via Chocolatey ($c)"
                    break
                }
            }
        } catch {
            Write-Warn2 "Chocolatey KO : $_"
        }
    }

    # Source 2 : nssm.cc avec retry (3 essais espacés de 5s)
    if (-not $NssmExe) {
        Write-Step "Téléchargement de NSSM depuis nssm.cc (retry up to 3x)..."
        $NssmZip = Join-Path $env:TEMP 'nssm.zip'
        $arch = if ([Environment]::Is64BitOperatingSystem) { 'win64' } else { 'win32' }
        $ok = $false
        for ($i = 1; $i -le 3 -and -not $ok; $i++) {
            try {
                Invoke-WebRequest -UseBasicParsing `
                    -Uri 'https://nssm.cc/release/nssm-2.24.zip' `
                    -OutFile $NssmZip -TimeoutSec 30
                $ok = $true
            } catch {
                Write-Warn2 "Tentative $i KO : $($_.Exception.Message)"
                Start-Sleep -Seconds 5
            }
        }
        if ($ok) {
            $extractDir = Join-Path $env:TEMP 'nssm-extract'
            if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
            Expand-Archive -Path $NssmZip -DestinationPath $extractDir -Force
            Copy-Item -Path (Join-Path $extractDir "nssm-2.24\$arch\nssm.exe") `
                      -Destination $TargetNssm -Force
            $NssmExe = $TargetNssm
            Write-Ok "NSSM téléchargé depuis nssm.cc"
        }
    }

    if (-not $NssmExe) {
        Write-Warn2 "Impossible d'obtenir NSSM (Chocolatey + nssm.cc échoués)"
        Write-Warn2 "Le service Windows ne sera pas créé."
        Write-Warn2 "Le serveur démarrera quand même via start.bat (mode standalone)."
    }
}

if ($NssmExe) {
    $NodeExe   = (Get-Command node).Source
    $ServerJs  = Join-Path $InstallDir 'src\server.js'

    # Si le service existe déjà, on l'arrête et le supprime avant réinstall
    & $NssmExe stop $ServiceName 2>$null | Out-Null
    & sc.exe query $ServiceName 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        & $NssmExe remove $ServiceName confirm | Out-Null
    }

    Write-Step "Création du service Windows '$ServiceName'..."
    & $NssmExe install $ServiceName $NodeExe $ServerJs | Out-Null
    & $NssmExe set $ServiceName AppDirectory $InstallDir | Out-Null
    & $NssmExe set $ServiceName AppStdout (Join-Path $LogsDir 'server.log') | Out-Null
    & $NssmExe set $ServiceName AppStderr (Join-Path $LogsDir 'server.log') | Out-Null
    & $NssmExe set $ServiceName AppRotateFiles 1 | Out-Null
    & $NssmExe set $ServiceName AppRotateBytes 10485760 | Out-Null  # 10 Mo
    & $NssmExe set $ServiceName Start SERVICE_AUTO_START | Out-Null
    & $NssmExe set $ServiceName Description "FF-TAROT - Gestion de tournois FFT (Libre par 4)" | Out-Null
    & $NssmExe set $ServiceName DisplayName "FF-TAROT" | Out-Null

    # Restart automatique en cas de crash
    & sc.exe failure $ServiceName reset= 60 actions= restart/5000/restart/5000/restart/15000 | Out-Null

    Write-Step "Démarrage du service..."
    & $NssmExe start $ServiceName | Out-Null
    Start-Sleep -Seconds 2
    Write-Ok "Service '$ServiceName' installé et démarré (auto-start au boot)"
}

# ---------------------------- Scripts start/stop pilotant le service ----------------------------

$StartBat = Join-Path $InstallDir 'start.bat'
$StopBat  = Join-Path $InstallDir 'stop.bat'

@'
@echo off
REM Démarre le service FF-TAROT puis ouvre le navigateur
sc query "FF-TAROT" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    net start "FF-TAROT" >nul 2>&1
    timeout /t 1 /nobreak >nul
    start http://localhost:3000
    echo [FFT] Service demarre. http://localhost:3000  (admin / admin123)
) else (
    echo [FFT] Service introuvable, demarrage en mode standalone...
    cd /d "%~dp0"
    if not exist logs mkdir logs
    start /b "" cmd /c "node src\server.js > logs\server.log 2>&1"
    timeout /t 3 /nobreak >nul
    start http://localhost:3000
)
'@ | Out-File -FilePath $StartBat -Encoding ASCII -Force

@'
@echo off
REM Arrête le service FF-TAROT (ou les processus standalone en fallback)
sc query "FF-TAROT" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    net stop "FF-TAROT" >nul 2>&1
    echo [FFT] Service arrete
) else (
    for /f "tokens=2" %%P in ('tasklist /fi "imagename eq node.exe" /fo table /nh ^| findstr /v "INFO"') do (
        taskkill /pid %%P /f >nul 2>&1
    )
    echo [FFT] Processus standalone arretes
)
'@ | Out-File -FilePath $StopBat -Encoding ASCII -Force

Write-Ok "Scripts start.bat / stop.bat créés (pilotent le service)"

# ---------------------------- Raccourci Bureau ----------------------------

if (-not $NoShortcut) {
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $Desktop  = [Environment]::GetFolderPath('Desktop')
        $Lnk      = $WshShell.CreateShortcut((Join-Path $Desktop 'FF-TAROT.lnk'))
        $Lnk.TargetPath        = $StartBat
        $Lnk.WorkingDirectory  = $InstallDir
        $Lnk.WindowStyle       = 7  # minimisé
        $Lnk.Description       = 'Démarrer FF-TAROT et ouvrir l''interface'
        $IconPath = Join-Path $InstallDir 'frontend\public\favicon.ico'
        if (Test-Path $IconPath) { $Lnk.IconLocation = $IconPath }
        $Lnk.Save()
        Write-Ok "Raccourci 'FF-TAROT' créé sur le Bureau"
    } catch {
        Write-Warn2 "Impossible de créer le raccourci Bureau : $_"
    }
} else {
    Write-Step "Raccourci Bureau ignoré (-NoShortcut, géré par l'installeur appelant)"
}

# ---------------------------- Récap ----------------------------

Write-Host ''
Write-Host '================================================================' -ForegroundColor Green
Write-Host '  FF-TAROT installé avec succès' -ForegroundColor Green
Write-Host '================================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  URL          : http://localhost:3000'
Write-Host '  Identifiant  : admin'
Write-Host '  Mot de passe : admin123  (à changer immédiatement via /admin)' -ForegroundColor Yellow
Write-Host ''
Write-Host "  Démarrer  : double-clic sur 'FF-TAROT' (Bureau) ou .\start.bat"
Write-Host '  Arrêter   : .\stop.bat'
Write-Host '  Logs      : Get-Content logs\server.log -Wait'
Write-Host ''

# Démarrage immédiat (sauf si -NoStart, auquel cas l'appelant gère)
if (-not $NoStart) {
    Write-Step 'Démarrage du serveur...'
    Start-Process -FilePath $StartBat -WorkingDirectory $InstallDir
    Write-Ok 'Serveur lancé. Le navigateur va s''ouvrir sur http://localhost:3000'
} else {
    Write-Step "Lancement automatique ignoré (-NoStart, géré par l'installeur appelant)"
}
