; One Tap Professional Setup Script
; Script generated for BS Framework

#ifndef AppVersion
#define AppVersion "26.11.12"
#endif
#ifndef OutputBaseFilename
#define OutputBaseFilename "OneTap-Setup-V-" + AppVersion
#endif

[Setup]
AppId={{com.bsframework.onetap}}
AppName=One Tap
AppVersion={#AppVersion}
AppPublisher=BS Framework
AppPublisherURL=https://bsframework.com/
DefaultDirName={autopf}\One Tap
DefaultGroupName=One Tap
AllowNoIcons=yes
; Professional Installer Assets
SetupIconFile=..\resources\icon.ico
LicenseFile=..\resources\LICENSE.txt
WizardImageFile=..\resources\installer_banner.png
WizardSmallImageFile=..\resources\installer_small.png
Compression=lzma
SolidCompression=yes
WizardStyle=modern
OutputDir=..\release
OutputBaseFilename={#OutputBaseFilename}
PrivilegesRequired=lowest
SetupMutex=OneTap_Setup_Mutex
AppMutex=OneTap_App_Mutex

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "fileassoc"; Description: "Register One Tap as default viewer for images, videos, PDFs and documents"; GroupDescription: "File Associations:"; Flags: unchecked

[Files]
; This points to the folder created by 'npm run build:win'
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\packages\file-manager\dist-installer\win-unpacked\*"; DestDir: "{app}\FileManager"; Flags: recursesubdirs ignoreversion skipifsourcedoesntexist; Check: DirExists(ExpandConstant('{src}\..\packages\file-manager\dist-installer\win-unpacked'))

[Icons]
Name: "{group}\One Tap"; Filename: "{app}\One Tap.exe"; AppUserModelID: "com.bsframework.onetap"
Name: "{group}\Uni File Manager"; Filename: "{app}\FileManager\UniFileManager.exe"; IconFilename: "{app}\FileManager\UniFileManager.exe"
Name: "{autodesktop}\One Tap"; Filename: "{app}\One Tap.exe"; Tasks: desktopicon; AppUserModelID: "com.bsframework.onetap"

[Registry]
; ── Windows Taskbar Grouping & AppUserModelID Registration ───────────────────
Root: HKCU; Subkey: "Software\Classes\Applications\One Tap.exe"; ValueType: string; ValueName: "AppUserModelID"; ValueData: "com.bsframework.onetap"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Applications\One Tap.exe"; ValueType: string; ValueName: "FriendlyAppName"; ValueData: "One Tap"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Applications\One Tap.exe\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\One Tap.exe,0"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Applications\One Tap.exe\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\One Tap.exe"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\AppUserModelId\com.bsframework.onetap"; ValueType: string; ValueName: "DisplayName"; ValueData: "One Tap"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\AppUserModelId\com.bsframework.onetap"; ValueType: string; ValueName: "IconUri"; ValueData: "{app}\One Tap.exe,0"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\AppUserModelId\com.bsframework.onetap"; ValueType: string; ValueName: "IconIndex"; ValueData: "0"; Flags: uninsdeletekey

; ── Image formats ──────────────────────────────────────────────────────
Root: HKCU; Subkey: "Software\Classes\.jpg\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.jpeg\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.png\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.gif\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.webp\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.bmp\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.tiff\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.heic\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
; RAW formats
Root: HKCU; Subkey: "Software\Classes\.cr2\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.cr3\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.nef\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.arw\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.dng\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.orf\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.rw2\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.raf\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.raw\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
; ── Video formats ──────────────────────────────────────────────────────
Root: HKCU; Subkey: "Software\Classes\.mp4\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.mkv\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.avi\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.mov\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.webm\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.wmv\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.flv\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.m4v\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
; ── Document formats ───────────────────────────────────────────────────
Root: HKCU; Subkey: "Software\Classes\.pdf\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.docx\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.xlsx\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.md\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.markdown\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc

; ── ProgId definition ──────────────────────────────────────────────────
Root: HKCU; Subkey: "Software\Classes\OneTap.Viewer"; ValueType: string; ValueName: ""; ValueData: "One Tap Viewer"; Flags: uninsdeletekey; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\OneTap.Viewer"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\OneTap.Viewer\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\One Tap.exe,0"; Flags: uninsdeletekey; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\OneTap.Viewer\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\One Tap.exe"" ""%1"""; Flags: uninsdeletekey; Tasks: fileassoc

; ── PerceivedType hints per extension ──
Root: HKCU; Subkey: "Software\Classes\.jpg"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.jpeg"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.png"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.gif"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.webp"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.bmp"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.tiff"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.heic"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.cr2"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.cr3"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.nef"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.arw"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.dng"; ValueType: string; ValueName: "PerceivedType"; ValueData: "image"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.mp4"; ValueType: string; ValueName: "PerceivedType"; ValueData: "video"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.mkv"; ValueType: string; ValueName: "PerceivedType"; ValueData: "video"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.avi"; ValueType: string; ValueName: "PerceivedType"; ValueData: "video"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.mov"; ValueType: string; ValueName: "PerceivedType"; ValueData: "video"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\.webm"; ValueType: string; ValueName: "PerceivedType"; ValueData: "video"; Flags: uninsdeletevalue; Tasks: fileassoc

; ── Notify Windows shell to refresh icon/thumbnail cache ─────────────
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.jpg\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.png\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.mp4\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.pdf\OpenWithProgids"; ValueType: string; ValueName: "OneTap.Viewer"; ValueData: ""; Flags: uninsdeletevalue; Tasks: fileassoc

[Ini]
Filename: "{app}\desktop.ini"; Section: ".ShellClassInfo"; Key: "IconResource"; String: "{app}\resources\icon.ico,0"
Filename: "{app}\desktop.ini"; Section: ".ShellClassInfo"; Key: "IconFile"; String: "{app}\resources\icon.ico"
Filename: "{app}\desktop.ini"; Section: ".ShellClassInfo"; Key: "IconIndex"; String: "0"

[Run]
Filename: "cmd.exe"; Parameters: "/c attrib +h +s ""{app}\desktop.ini"" & attrib +r ""{app}"""; Flags: runhidden
Filename: "{app}\One Tap.exe"; Description: "{cm:LaunchProgram,One Tap}"; Flags: nowait postinstall skipifsilent