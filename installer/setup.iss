; =====================================================
; FF-TAROT — Inno Setup script (100% natif, pas de PowerShell)
; =====================================================
; Compile via :
;   iscc /DAppVersion=2.0.4 setup.iss
; (la CI passe la version via /DAppVersion=...)
;
; Le .exe résultant fait tout :
;   - extrait les fichiers dans C:\FF-TAROT (modifiable au wizard)
;   - installe Node.js LTS (MSI officiel téléchargé) si absent
;   - installe MariaDB Server (MSI officiel téléchargé) si absent
;   - génère un mot de passe DB et un secret JWT aléatoires
;   - crée la base + utilisateur fft_user
;   - sert le binaire back AM + le front Angular pré-buildé (plus de Node back)
;   - enregistre server.exe comme service Windows NATIF (sc create, sans NSSM)
;   - démarre le service immédiatement
;   - crée les raccourcis Menu Démarrer + Bureau
;   - propose d'ouvrir le navigateur à la fin

; --- VERSIONING ---
; Source unique de vérité : le tag git (ex : v2.0.4).
; Flow :
;   1. La CI (release.yml) extrait : version=${GITHUB_REF_NAME#v}
;   2. Elle compile en passant : iscc /DAppVersion=2.0.4 setup.iss
;   3. /D définit AppVersion AVANT lecture du script -> #ifndef est skip
;   4. Le .exe résultant s'appelle ff-tarot-2.0.4-setup.exe et toutes
;      les références {#AppVersion} dans [Setup]/[Files]/etc. portent 2.0.4
;
; En compilation locale (test du script sans la CI), on retombe sur le
; placeholder "0.0.0-dev" pour que ça fonctionne quand même. Pour
; tester avec une vraie version : iscc /DAppVersion=2.0.4 setup.iss
#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif

[Setup]
AppId={{B5F7F1B4-4F77-4F2C-A9F0-FFTAROTV1}}
AppName=FF-TAROT
AppVersion={#AppVersion}
AppPublisher=FF-TAROT
DefaultDirName={sd}\FF-TAROT
DefaultGroupName=FF-TAROT
DisableProgramGroupPage=yes
LicenseFile=..\LICENSE
PrivilegesRequired=admin
OutputBaseFilename=ff-tarot-{#AppVersion}-setup
OutputDir=output
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=FF-TAROT {#AppVersion}
ChangesEnvironment=no
MinVersion=10.0

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; \
  GroupDescription: "Raccourcis :"; Flags: checkedonce

[Files]
; Binaire back Amalgame (la CI le build sur Windows — server.exe — et le place
; à la racine du repo AVANT `iscc`). C'est un vrai service Windows grâce au
; dispatcher SCM d'amalgame-service : plus besoin de NSSM ni de Node back.
Source: "..\server.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\db.sql"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\seed.sql"; DestDir: "{app}"; Flags: ignoreversion

; Front : bundle Angular pré-buildé (servi par le binaire ; plus de npm build)
Source: "..\frontend\public\*"; DestDir: "{app}\frontend\public"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\frontend\dist\*"; DestDir: "{app}\frontend\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; Doc
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\INSTALL.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\ROADMAP.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\FF-TAROT"; Filename: "http://localhost:3000"; \
  IconFilename: "{app}\frontend\public\favicon.ico"; \
  Comment: "Ouvrir l'interface FF-TAROT (le service tourne en arrière-plan en permanence)"
Name: "{group}\Démarrer le service FF-TAROT"; Filename: "{sys}\net.exe"; \
  Parameters: "start FF-TAROT"; Flags: runminimized
Name: "{group}\Arrêter le service FF-TAROT"; Filename: "{sys}\net.exe"; \
  Parameters: "stop FF-TAROT"; Flags: runminimized
Name: "{group}\Désinstaller FF-TAROT"; Filename: "{uninstallexe}"
Name: "{commondesktop}\FF-TAROT"; Filename: "http://localhost:3000"; \
  IconFilename: "{app}\frontend\public\favicon.ico"; \
  Comment: "Ouvrir l'interface FF-TAROT"; Tasks: desktopicon

[Run]
; Lancer le navigateur après install (case cochée par défaut, masquable en mode silencieux)
Filename: "http://localhost:3000"; \
  Description: "Ouvrir FF-TAROT dans le navigateur"; \
  Flags: shellexec postinstall skipifsilent

[UninstallRun]
; Stopper et supprimer le service natif avant désinstallation des fichiers
Filename: "{sys}\sc.exe"; Parameters: "stop FF-TAROT"; \
  Flags: runhidden; RunOnceId: "StopFftService"
Filename: "{sys}\sc.exe"; Parameters: "delete FF-TAROT"; \
  Flags: runhidden; RunOnceId: "RemoveFftService"

[UninstallDelete]
Type: files; Name: "{app}\.env"

; ====================================================================
; CODE PASCAL — toute la logique d'install runtime
; ====================================================================

[Code]
const
  CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  // --- Packages externes : téléchargement direct des MSI officiels ---
  // On NE passe PLUS par winget : l'alias winget.exe (WindowsApps) est un
  // reparse-point par-utilisateur qui échoue quand l'installeur tourne élevé
  // en admin (PrivilegesRequired=admin). On télécharge donc les MSI officiels
  // et on les installe via msiexec en silencieux. Versions épinglées =
  // installs déterministes et empreintes SHA256 vérifiables.
  //
  // Pour bumper une version : récupérer l'URL + le sha256 officiel
  //   Node    : https://nodejs.org/dist/vX.Y.Z/SHASUMS256.txt (ligne x64.msi)
  //   MariaDB : https://downloads.mariadb.org/rest-api/mariadb/X.Y.Z/
  NODE_MSI_URL    = 'https://nodejs.org/dist/v20.20.2/node-v20.20.2-x64.msi';
  NODE_MSI_SHA256 = '9a283dcdb771793d6492235e81f3fc80048db8a37497a0af87b0a9f450d10fa6';

  MARIADB_VERSION    = '11.8';  // doit matcher un cas de FindMysqlExe()
  MARIADB_MSI_URL    = 'https://archive.mariadb.org/mariadb-11.8.8/winx64-packages/mariadb-11.8.8-winx64.msi';
  MARIADB_MSI_SHA256 = '42ee5ab1609031bed58bf19876000fd6c13aca4878126faabc1da490d1fe9ce2';

var
  ProgressPage: TOutputProgressWizardPage;
  DbPassword: String;
  JwtSecret: String;
  MariaRootPassword: String;  { mot de passe root fixé quand NOUS installons MariaDB }
  MariaWeInstalled: Boolean;  { True si l'installeur a installé MariaDB (sinon préexistant) }

{ ----- Helpers ----- }

function GenerateRandomPassword(Len: Integer): String;
var
  i: Integer;
begin
  Result := '';
  for i := 1 to Len do
    Result := Result + CHARS[Random(Length(CHARS)) + 1];
end;

function FindNodeExe(): String;
var
  Path: String;
begin
  Path := ExpandConstant('{commonpf64}\nodejs\node.exe');
  if FileExists(Path) then begin Result := Path; Exit; end;
  Path := ExpandConstant('{commonpf32}\nodejs\node.exe');
  if FileExists(Path) then begin Result := Path; Exit; end;
  Path := 'C:\Program Files\nodejs\node.exe';
  if FileExists(Path) then begin Result := Path; Exit; end;
  Path := 'C:\Program Files (x86)\nodejs\node.exe';
  if FileExists(Path) then begin Result := Path; Exit; end;
  Result := '';
end;

function CheckMariaDBVersion(const Version: String): String;
var
  Base: String;
begin
  // MariaDB 11.x livre 'mariadb.exe' (et garde 'mysql.exe' en compat). On
  // teste les deux pour ne dépendre d'aucune des deux conventions.
  Base := 'C:\Program Files\MariaDB ' + Version + '\bin\';
  if FileExists(Base + 'mariadb.exe') then Result := Base + 'mariadb.exe'
  else if FileExists(Base + 'mysql.exe') then Result := Base + 'mysql.exe'
  else Result := '';
end;

function FindMysqlExe(): String;
begin
  // Scan des versions MariaDB Windows installées (du plus récent au plus ancien)
  Result := CheckMariaDBVersion('12.0'); if Result <> '' then Exit;
  Result := CheckMariaDBVersion('11.8'); if Result <> '' then Exit;
  Result := CheckMariaDBVersion('11.7'); if Result <> '' then Exit;
  Result := CheckMariaDBVersion('11.6'); if Result <> '' then Exit;
  Result := CheckMariaDBVersion('11.5'); if Result <> '' then Exit;
  Result := CheckMariaDBVersion('11.4'); if Result <> '' then Exit;
  Result := CheckMariaDBVersion('11.3'); if Result <> '' then Exit;
  Result := CheckMariaDBVersion('11.2'); if Result <> '' then Exit;
  Result := CheckMariaDBVersion('10.11'); if Result <> '' then Exit;
  Result := '';
end;

function ExecAndWait(const Cmd, Params, WorkDir: String;
                    var ExitCode: Integer): Boolean;
begin
  Result := Exec(Cmd, Params, WorkDir, SW_HIDE, ewWaitUntilTerminated, ExitCode);
end;

function ExecCmdShell(const CmdLine, WorkDir: String;
                     var ExitCode: Integer): Boolean;
begin
  // IMPORTANT : on entoure toute la commande d'une paire de guillemets externe.
  // Quand CmdLine commence par un chemin d'exe entre guillemets (avec espaces,
  // ex. "C:\Program Files\MariaDB 11.8\bin\mariadb.exe") ET contient des
  // redirections (< > 2>&1), cmd.exe retire le 1er et le dernier guillemet de
  // la ligne, ce qui casse le chemin de l'exe. Le wrap externe absorbe ce
  // retrait et préserve les guillemets internes (cf. `cmd /?`).
  Result := Exec(ExpandConstant('{cmd}'), '/c "' + CmdLine + '"', WorkDir,
                 SW_HIDE, ewWaitUntilTerminated, ExitCode);
end;

procedure SetProgress(const Msg: String);
begin
  if ProgressPage <> nil then
  begin
    ProgressPage.SetText(Msg, '');
    ProgressPage.Show;
  end;
  Log('[FFT] ' + Msg);
end;

// Télécharge un MSI (vérif SHA256) dans le dossier temp et l'installe en
// silencieux. Renvoie True seulement si msiexec sort avec un code de succès
// (0 ou 3010 = succès + reboot requis). ExtraProps = propriétés MSI publiques
// (ex : "PASSWORD=xxx PORT=3306"). Toute exception réseau/hash est attrapée.
function DownloadAndRunMsi(const Url, FileName, Sha256, ExtraProps: String): Boolean;
var
  MsiPath: String;
  ExitCode: Integer;
begin
  Result := False;
  MsiPath := ExpandConstant('{tmp}\') + FileName;
  try
    SetProgress('Téléchargement de ' + FileName + ' (peut prendre 1-3 min)...');
    DownloadTemporaryFile(Url, FileName, Sha256, nil);
  except
    Log('[FFT] Échec téléchargement ' + Url + ' : ' + GetExceptionMessage);
    Exit;
  end;

  SetProgress('Installation de ' + FileName + '...');
  if not ExecAndWait('msiexec.exe',
       '/i "' + MsiPath + '" /qn /norestart ' + ExtraProps, '', ExitCode) then
  begin
    Log('[FFT] msiexec n''a pas pu démarrer pour ' + FileName);
    Exit;
  end;
  Log('[FFT] msiexec ' + FileName + ' exit code = ' + IntToStr(ExitCode));
  // 0 = OK, 3010 = OK mais reboot requis (on ignore le reboot, services déjà up)
  Result := (ExitCode = 0) or (ExitCode = 3010);
end;

procedure WaitForServiceRunning(const Name: String; TimeoutSec: Integer);
var
  Elapsed, ExitCode: Integer;
begin
  Elapsed := 0;
  while Elapsed < TimeoutSec do
  begin
    if ExecAndWait('sc.exe', 'query "' + Name + '"', '', ExitCode) and (ExitCode = 0) then
    begin
      // Tenter un démarrage idempotent
      Exec('sc.exe', 'start "' + Name + '"', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
      Sleep(2000);
      Exit;
    end;
    Sleep(2000);
    Elapsed := Elapsed + 2;
  end;
end;

{ ----- Étapes d'install ----- }

function InstallNodejs(): Boolean;
begin
  if FindNodeExe() <> '' then
  begin
    SetProgress('Node.js déjà présent');
    Result := True;
    Exit;
  end;
  if not DownloadAndRunMsi(NODE_MSI_URL, 'node.msi', NODE_MSI_SHA256, '') then
  begin
    Result := False;
    Exit;
  end;
  Result := FindNodeExe() <> '';
end;

function InstallMariaDB(): Boolean;
begin
  if FindMysqlExe() <> '' then
  begin
    SetProgress('MariaDB déjà présent');
    MariaWeInstalled := False;  { préexistant : on ne connaît pas son mot de passe root }
    Result := True;
    Exit;
  end;
  // Le MSI MariaDB installe le serveur comme service Windows et fixe le mot de
  // passe root qu'on lui passe (PASSWORD=...). On évite ainsi l'hypothèse
  // fragile "root accessible sans mot de passe" de l'ancienne version winget.
  if not DownloadAndRunMsi(MARIADB_MSI_URL, 'mariadb.msi', MARIADB_MSI_SHA256,
       'SERVICENAME=MariaDB PORT=3306 UTF8=1 PASSWORD="' + MariaRootPassword + '"') then
  begin
    Result := False;
    Exit;
  end;
  MariaWeInstalled := True;
  WaitForServiceRunning('MariaDB', 60);
  Result := FindMysqlExe() <> '';
end;

// Teste une connexion root (auth donnée) via 'SELECT 1'. Pas de redirection
// cmd ici : on appelle mariadb.exe directement, on ne veut que le code retour.
function ProbeRoot(const MysqlExe, Auth: String): Boolean;
var
  ExitCode: Integer;
begin
  Result := ExecAndWait(MysqlExe, Auth + ' --connect-timeout=3 -e "SELECT 1"', '', ExitCode)
            and (ExitCode = 0);
end;

// Attend que MariaDB accepte les connexions (mysqld met plusieurs secondes à
// démarrer après l'install du service) ET résout l'auth root qui marche :
// d'abord avec le mot de passe qu'on a fixé via le MSI, sinon en passwordless
// (install MariaDB préexistante). Renvoie '' si rien ne marche après ~60s.
function ResolveRootAuth(const MysqlExe: String): String;
var
  i: Integer;
  WithPw: String;
begin
  WithPw := '--user=root --password=' + MariaRootPassword;
  Result := '';
  for i := 1 to 30 do
  begin
    if (MariaRootPassword <> '') and ProbeRoot(MysqlExe, WithPw) then
    begin Result := WithPw; Exit; end;
    if ProbeRoot(MysqlExe, '--user=root') then
    begin Result := '--user=root'; Exit; end;
    Sleep(2000);
  end;
end;

function ConfigureDatabase(const MysqlExe: String): Boolean;
var
  ExitCode: Integer;
  SqlInit, EnvFile, EnvContent, RootAuth, DbLog: String;
begin
  SetProgress('Attente du démarrage de MariaDB...');

  // mysqld n'accepte pas les connexions immédiatement après l'install du
  // service : on attend activement et on récupère l'auth root opérante.
  RootAuth := ResolveRootAuth(MysqlExe);
  if RootAuth = '' then
  begin
    SuppressibleMsgBox('Impossible de se connecter à MariaDB en root après 60s.'#13#10 +
           'Le service MariaDB n''a peut-être pas démarré. Voir db-setup.log.',
           mbCriticalError, MB_OK, IDOK);
    Result := False;
    Exit;
  end;

  SetProgress('Configuration de la base de données...');
  DbLog := ExpandConstant('{app}\db-setup.log');  // dumpé par la CI en cas d'échec

  SqlInit := ExpandConstant('{tmp}\fft-init.sql');
  SaveStringToFile(SqlInit,
    'CREATE DATABASE IF NOT EXISTS `fft` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;' + #13#10 +
    'CREATE USER IF NOT EXISTS ''fft_user''@''localhost'' IDENTIFIED BY ''' + DbPassword + ''';' + #13#10 +
    'ALTER USER ''fft_user''@''localhost'' IDENTIFIED BY ''' + DbPassword + ''';' + #13#10 +
    'GRANT ALL PRIVILEGES ON `fft`.* TO ''fft_user''@''localhost'';' + #13#10 +
    'FLUSH PRIVILEGES;' + #13#10, False);

  if not ExecCmdShell('"' + MysqlExe + '" ' + RootAuth + ' < "' + SqlInit + '" >> "' + DbLog + '" 2>&1', '', ExitCode)
     or (ExitCode <> 0) then
  begin
    SuppressibleMsgBox('Échec de la création de la base de données (code ' + IntToStr(ExitCode) + ').'#13#10 +
           'Voir db-setup.log pour le détail de l''erreur MariaDB.',
           mbCriticalError, MB_OK, IDOK);
    Result := False;
    Exit;
  end;

  ExecCmdShell('"' + MysqlExe + '" ' + RootAuth + ' < "' + ExpandConstant('{app}\db.sql') + '" >> "' + DbLog + '" 2>&1',
               '', ExitCode);
  ExecCmdShell('"' + MysqlExe + '" ' + RootAuth + ' fft < "' + ExpandConstant('{app}\seed.sql') + '" >> "' + DbLog + '" 2>&1',
               '', ExitCode);

  EnvFile := ExpandConstant('{app}\.env');
  EnvContent :=
    'PORT=3000' + #13#10 + #13#10 +
    'DB_HOST=localhost' + #13#10 +
    'DB_USER=fft_user' + #13#10 +
    'DB_PASSWORD=' + DbPassword + #13#10 +
    'DB_NAME=fft' + #13#10 + #13#10 +
    'JWT_SECRET=' + JwtSecret + #13#10 +
    'JWT_EXPIRES_IN=12h' + #13#10;
  SaveStringToFile(EnvFile, EnvContent, False);

  Result := True;
end;

function InstallNpmDeps(const NodeExe: String): Boolean;
var
  ExitCode: Integer;
  NpmCmd, AppDir: String;
begin
  SetProgress('Installation des dépendances Node (npm install)...');
  AppDir := ExpandConstant('{app}');
  NpmCmd := ExtractFilePath(NodeExe) + 'npm.cmd';
  if not FileExists(NpmCmd) then
  begin
    SuppressibleMsgBox('npm.cmd introuvable à côté de node.exe : ' + NpmCmd,
           mbCriticalError, MB_OK, IDOK);
    Result := False;
    Exit;
  end;
  ExecAndWait(NpmCmd, 'install --omit=dev --no-fund --no-audit', AppDir, ExitCode);

  if not FileExists(ExpandConstant('{app}\frontend\dist\frontend\browser\index.html')) then
  begin
    SetProgress('Installation et build du front Angular (peut prendre 2-3 min)...');
    ExecAndWait(NpmCmd, 'install --no-fund --no-audit',
                ExpandConstant('{app}\frontend'), ExitCode);
    ExecAndWait(NpmCmd, 'run build', ExpandConstant('{app}\frontend'), ExitCode);
  end;
  Result := True;
end;

// Service Windows NATIF (plus de NSSM) : server.exe embarque le dispatcher
// SCM via amalgame-service, donc sc.exe suffit. La config passe par la clé
// registre Environment du service (un service tourne avec CWD=system32, pas
// {app}) — le binaire la lit via Config.Get qui priorise l'env process.
function InstallService(): Boolean;
var
  ExitCode: Integer;
  AppDir, ExePath, Sc: String;
  EnvLines: TArrayOfString;
begin
  SetProgress('Installation du service Windows natif FF-TAROT (auto-start)...');
  AppDir  := ExpandConstant('{app}');
  ExePath := ExpandConstant('{app}\server.exe');
  Sc      := ExpandConstant('{sys}\sc.exe');

  Exec(Sc, 'stop FF-TAROT',   '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(Sc, 'delete FF-TAROT', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Sleep(1000);

  Exec(Sc, 'create FF-TAROT binPath= "' + ExePath + '" start= auto DisplayName= "FF-TAROT"',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(Sc, 'description FF-TAROT "FF-TAROT - Gestion de tournois FFT"',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  // Restart automatique en cas de crash (3 essais : 5s, 5s, 15s)
  Exec(Sc, 'failure FF-TAROT reset= 60 actions= restart/5000/restart/5000/restart/15000',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);

  // Environnement du service (REG_MULTI_SZ). FRONT_DIR en absolu pour servir
  // le bundle Angular malgré le CWD=system32.
  SetArrayLength(EnvLines, 8);
  EnvLines[0] := 'PORT=3000';
  EnvLines[1] := 'SOCKET_PORT=3001';
  EnvLines[2] := 'DB_HOST=localhost';
  EnvLines[3] := 'DB_USER=fft_user';
  EnvLines[4] := 'DB_PASSWORD=' + DbPassword;
  EnvLines[5] := 'DB_NAME=fft';
  EnvLines[6] := 'JWT_SECRET=' + JwtSecret;
  EnvLines[7] := 'FRONT_DIR=' + AppDir + '\frontend\dist\frontend\browser';
  RegWriteMultiStringValue(HKLM, 'SYSTEM\CurrentControlSet\Services\FF-TAROT', 'Environment', EnvLines);

  Exec(Sc, 'start FF-TAROT', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Sleep(2000);
  Result := True;
end;

{ ----- Hook principal ----- }

procedure InitializeWizard;
begin
  // NB : pas de Randomize() en Inno Pascal Script (la fonction n'existe
  // pas, le générateur Random() est auto-seedé au démarrage du script).
  DbPassword := GenerateRandomPassword(24);
  JwtSecret  := GenerateRandomPassword(48);
  MariaRootPassword := GenerateRandomPassword(24);
  MariaWeInstalled := False;
  ProgressPage := CreateOutputProgressPage(
    'Configuration runtime',
    'Installation et démarrage de FF-TAROT en cours.');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  MysqlExe: String;
begin
  if CurStep <> ssPostInstall then Exit;

  ProgressPage.SetText('Préparation...', '');
  ProgressPage.Show;
  try
    // Plus de Node : le back est un binaire AM (server.exe) et le front est
    // pré-buildé/bundlé. On installe juste MariaDB + le service natif.
    if not InstallMariaDB() then
    begin
      SuppressibleMsgBox('Impossible d''installer MariaDB (téléchargement ou MSI en échec). Annulation.'#13#10 +
             'Voir le log d''installation pour le détail.', mbCriticalError, MB_OK, IDOK);
      Abort;
    end;

    MysqlExe := FindMysqlExe();
    if MysqlExe = '' then
    begin
      SuppressibleMsgBox('MariaDB introuvable après install. Redémarrer la machine et relancer.',
             mbCriticalError, MB_OK, IDOK);
      Abort;
    end;

    if not ConfigureDatabase(MysqlExe) then Abort;
    if not InstallService() then Abort;

    SetProgress('Installation terminée avec succès !');
    Sleep(1500);
  finally
    ProgressPage.Hide;
  end;
end;
