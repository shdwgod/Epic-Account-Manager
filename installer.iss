#ifndef MyAppVersion
  #define MyAppVersion "2.1.0"
#endif

#define MyAppName "Epic Account Manager"
#define MyAppExeName "Epic Account Manager.exe"
#define WebView2ClientId "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

[Setup]
AppId={{A8C8E7D2-5C7A-4A9C-9A51-4D2C6A7F31B8}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=shdwgod
DefaultDirName={autopf}\Epic Account Manager
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=Epic Account Manager Setup
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
Uninstallable=yes
VersionInfoProductName={#MyAppName}
VersionInfoDescription={#MyAppName} Setup
VersionInfoCompany=shdwgod

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "dist\Epic Account Manager.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\MicrosoftEdgeWebView2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: not IsWebView2Installed

[Icons]
Name: "{group}\Epic Account Manager"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Epic Account Manager"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebView2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing Microsoft Edge WebView2 Runtime..."; Flags: waituntilterminated; Check: not IsWebView2Installed
Filename: "{app}\{#MyAppExeName}"; Description: "Launch Epic Account Manager"; Flags: nowait postinstall skipifsilent

[Code]
function HasValidRuntimeVersion(RootKey: Integer; const SubKeyName: String): Boolean;
var
  Version: String;
begin
  Result :=
    RegQueryStringValue(RootKey, SubKeyName, 'pv', Version) and
    (Version <> '') and
    (Version <> '0.0.0.0');
end;

function IsWebView2Installed: Boolean;
var
  RuntimeKey: String;
begin
  RuntimeKey := 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{#WebView2ClientId}';

  Result :=
    HasValidRuntimeVersion(HKLM32, RuntimeKey) or
    HasValidRuntimeVersion(HKLM64, RuntimeKey) or
    HasValidRuntimeVersion(HKCU32, RuntimeKey) or
    HasValidRuntimeVersion(HKCU64, RuntimeKey);
end;
