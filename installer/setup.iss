; =====================================================
; FF-TAROT — Inno Setup script (100% natif, pas de PowerShell)
; =====================================================
; Compile via :
;   iscc /DAppVersion=2.0.4 setup.iss
; (la CI passe la version via /DAppVersion=...)
;
; Le .exe résultant fait tout :
;   - extrait les fichiers dans C:\FF-TAROT (modifiable au wizard)
;   - installe Node.js LTS via winget si absent
;   - installe MariaDB Server via winget si absent
;   - génère un mot de passe DB et un secret JWT aléatoires
;   - crée la base + utilisateur fft_user
;   - npm install (back) + ng build (front si pas pré-buildé)
;   - installe NSSM comme service Windows "FF-TAROT" (auto-start au boot)
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
#pragma message "FF-TAROT setup.iss compilé avec AppVersion = " + AppVersion

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
MinVersion=10.0.17763

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; \
  GroupDescription: "Raccourcis :"; Flags: checkedonce

[Files]
; Source code back
Source: "..\src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\db.sql"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\seed.sql"; DestDir: "{app}"; Flags: ignoreversion

; Front : sources + bundle pré-buildé
Source: "..\frontend\src\*"; DestDir: "{app}\frontend\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\frontend\public\*"; DestDir: "{app}\frontend\public"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\frontend\dist\*"; DestDir: "{app}\frontend\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\frontend\package.json"; DestDir: "{app}\frontend"; Flags: ignoreversion
Source: "..\frontend\package-lock.json"; DestDir: "{app}\frontend"; Flags: ignoreversion
Source: "..\frontend\angular.json"; DestDir: "{app}\frontend"; Flags: ignoreversion
Source: "..\frontend\proxy.conf.json"; DestDir: "{app}\frontend"; Flags: ignoreversion
Source: "..\frontend\tsconfig*.json"; DestDir: "{app}\frontend"; Flags: ignoreversion

; NSSM (la CI place le binaire ici avant de compiler le .iss)
Source: "bin\nssm.exe"; DestDir: "{app}\bin"; Flags: ignoreversion

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
; Stopper et supprimer le service avant désinstallation des fichiers
Filename: "{app}\bin\nssm.exe"; Parameters: "stop FF-TAROT"; \
  Flags: runhidden; RunOnceId: "StopFftService"
Filename: "{app}\bin\nssm.exe"; Parameters: "remove FF-TAROT confirm"; \
  Flags: runhidden; RunOnceId: "RemoveFftService"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
Type: files; Name: "{app}\.env"
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\frontend\node_modules"

; ====================================================================
; CODE PASCAL — toute la logique d'install runtime
; ====================================================================

[Code]
const
  CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

var
  ProgressPage: TOutputProgressWizardPage;
  DbPassword: String;
  JwtSecret: String;

{ ----- Helpers ----- }

function GenerateRandomPassword(Len: Integer): String;
var
  i: Integer;
begin
  Result := '';
  for i := 1 to Len do
    Result := Result + CHARS[Random(Length(CHARS)) + 1];
end;

function FindFile(const Paths: array of String): String;
var
  i: Integer;
begin
  for i := 0 to High(Paths) do
    if FileExists(Paths[i]) then
    begin
      Result := Paths[i];
      Exit;
    end;
  Result := '';
end;

function FindNodeExe(): String;
begin
  Result := FindFile([
    ExpandConstant('{pf}\nodejs\node.exe'),
    ExpandConstant('{pf32}\nodejs\node.exe')
  ]);
end;

function FindMysqlExe(): String;
var
  Versions: array of String;
  Path: String;
  i: Integer;
begin
  // MariaDB s'installe dans C:\Program Files\MariaDB X.Y\bin\mysql.exe
  // On scanne les versions probables (du plus récent au plus ancien)
  SetArrayLength(Versions, 8);
  Versions[0] := '12.0';
  Versions[1] := '11.7';
  Versions[2] := '11.6';
  Versions[3] := '11.5';
  Versions[4] := '11.4';
  Versions[5] := '11.3';
  Versions[6] := '11.2';
  Versions[7] := '10.11';
  for i := 0 to High(Versions) do
  begin
    Path := ExpandConstant('{pf}\MariaDB ') + Versions[i] + '\bin\mysql.exe';
    if FileExists(Path) then
    begin
      Result := Path;
      Exit;
    end;
  end;
  Result := '';
end;

function FindWingetExe(): String;
var
  WingetPath: String;
begin
  WingetPath := ExpandConstant('{userappdata}\..\Local\Microsoft\WindowsApps\winget.exe');
  if FileExists(WingetPath) then
    Result := WingetPath
  else
    Result := 'winget.exe'; { fallback : on espère que c'est dans le PATH }
end;

function ExecAndWait(const Cmd, Params, WorkDir: String;
                    out ExitCode: Integer): Boolean;
begin
  Result := Exec(Cmd, Params, WorkDir, SW_HIDE, ewWaitUntilTerminated, ExitCode);
end;

function ExecCmdShell(const CmdLine, WorkDir: String;
                     out ExitCode: Integer): Boolean;
begin
  Result := Exec(ExpandConstant('{cmd}'), '/c ' + CmdLine, WorkDir,
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
var
  ExitCode: Integer;
  Winget: String;
begin
  if FindNodeExe() <> '' then
  begin
    SetProgress('Node.js déjà présent');
    Result := True;
    Exit;
  end;
  Winget := FindWingetExe();
  if Winget = '' then
  begin
    MsgBox('winget introuvable. Installer "App Installer" depuis le Microsoft Store puis relancer l''install.',
           mbCriticalError, MB_OK);
    Result := False;
    Exit;
  end;
  SetProgress('Installation de Node.js LTS via winget (peut prendre 1-2 min)...');
  ExecAndWait(Winget,
    'install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements',
    '', ExitCode);
  Result := FindNodeExe() <> '';
end;

function InstallMariaDB(): Boolean;
var
  ExitCode: Integer;
  Winget: String;
begin
  if FindMysqlExe() <> '' then
  begin
    SetProgress('MariaDB déjà présent');
    Result := True;
    Exit;
  end;
  Winget := FindWingetExe();
  SetProgress('Installation de MariaDB Server via winget (peut prendre 2-5 min)...');
  ExecAndWait(Winget,
    'install --id MariaDB.Server --silent --accept-package-agreements --accept-source-agreements',
    '', ExitCode);
  WaitForServiceRunning('MariaDB', 60);
  Result := FindMysqlExe() <> '';
end;

function ConfigureDatabase(const MysqlExe: String): Boolean;
var
  ExitCode: Integer;
  SqlInit, EnvFile, EnvContent: String;
begin
  SetProgress('Configuration de la base de données...');
  SqlInit := ExpandConstant('{tmp}\fft-init.sql');
  SaveStringToFile(SqlInit,
    'CREATE DATABASE IF NOT EXISTS `fft` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;' + #13#10 +
    'CREATE USER IF NOT EXISTS ''fft_user''@''localhost'' IDENTIFIED BY ''' + DbPassword + ''';' + #13#10 +
    'ALTER USER ''fft_user''@''localhost'' IDENTIFIED BY ''' + DbPassword + ''';' + #13#10 +
    'GRANT ALL PRIVILEGES ON `fft`.* TO ''fft_user''@''localhost'';' + #13#10 +
    'FLUSH PRIVILEGES;' + #13#10, False);

  if not ExecCmdShell('"' + MysqlExe + '" --user=root < "' + SqlInit + '"', '', ExitCode)
     or (ExitCode <> 0) then
  begin
    MsgBox('Échec de la création de la base. Le compte root MariaDB doit être accessible localement sans mot de passe (config par défaut de MariaDB Windows).',
           mbCriticalError, MB_OK);
    Result := False;
    Exit;
  end;

  ExecCmdShell('"' + MysqlExe + '" --user=root < "' + ExpandConstant('{app}\db.sql') + '"',
               '', ExitCode);
  ExecCmdShell('"' + MysqlExe + '" --user=root fft < "' + ExpandConstant('{app}\seed.sql') + '"',
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
    MsgBox('npm.cmd introuvable à côté de node.exe : ' + NpmCmd,
           mbCriticalError, MB_OK);
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

function InstallService(const NodeExe: String): Boolean;
var
  ExitCode: Integer;
  NssmExe, AppDir, ServerJs, LogsDir: String;
begin
  SetProgress('Installation du service Windows FF-TAROT (auto-start au boot)...');
  NssmExe  := ExpandConstant('{app}\bin\nssm.exe');
  AppDir   := ExpandConstant('{app}');
  ServerJs := ExpandConstant('{app}\src\server.js');
  LogsDir  := ExpandConstant('{app}\logs');

  if not DirExists(LogsDir) then CreateDir(LogsDir);

  Exec(NssmExe, 'stop FF-TAROT',           '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(NssmExe, 'remove FF-TAROT confirm', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);

  Exec(NssmExe, 'install FF-TAROT "' + NodeExe + '" "' + ServerJs + '"',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(NssmExe, 'set FF-TAROT AppDirectory "' + AppDir + '"',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(NssmExe, 'set FF-TAROT AppStdout "' + LogsDir + '\server.log"',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(NssmExe, 'set FF-TAROT AppStderr "' + LogsDir + '\server.log"',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(NssmExe, 'set FF-TAROT AppRotateFiles 1',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(NssmExe, 'set FF-TAROT AppRotateBytes 10485760',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(NssmExe, 'set FF-TAROT Start SERVICE_AUTO_START',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(NssmExe, 'set FF-TAROT Description "FF-TAROT - Gestion de tournois FFT"',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(NssmExe, 'set FF-TAROT DisplayName "FF-TAROT"',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);

  // Restart automatique en cas de crash (3 essais : 5s, 5s, 15s)
  Exec('sc.exe',
       'failure FF-TAROT reset= 60 actions= restart/5000/restart/5000/restart/15000',
       '', SW_HIDE, ewWaitUntilTerminated, ExitCode);

  Exec(NssmExe, 'start FF-TAROT', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Sleep(2000);

  Result := True;
end;

{ ----- Hook principal ----- }

procedure InitializeWizard;
begin
  Randomize;
  DbPassword := GenerateRandomPassword(24);
  JwtSecret  := GenerateRandomPassword(48);
  ProgressPage := CreateOutputProgressPage(
    'Configuration runtime',
    'Installation et démarrage de FF-TAROT en cours.');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  NodeExe, MysqlExe: String;
begin
  if CurStep <> ssPostInstall then Exit;

  ProgressPage.SetText('Préparation...', '');
  ProgressPage.Show;
  try
    if not InstallNodejs() then
    begin
      MsgBox('Impossible d''installer Node.js. Annulation.', mbCriticalError, MB_OK);
      Abort;
    end;

    if not InstallMariaDB() then
    begin
      MsgBox('Impossible d''installer MariaDB. Annulation.', mbCriticalError, MB_OK);
      Abort;
    end;

    NodeExe  := FindNodeExe();
    MysqlExe := FindMysqlExe();
    if (NodeExe = '') or (MysqlExe = '') then
    begin
      MsgBox('Node ou MariaDB introuvables après install. Redémarrer la machine et relancer.',
             mbCriticalError, MB_OK);
      Abort;
    end;

    if not ConfigureDatabase(MysqlExe) then Abort;
    if not InstallNpmDeps(NodeExe) then Abort;
    if not InstallService(NodeExe) then Abort;

    SetProgress('Installation terminée avec succès !');
    Sleep(1500);
  finally
    ProgressPage.Hide;
  end;
end;
