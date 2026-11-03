; ====================================================================
; ONE TAP — PROFESSIONAL WINDOWS SETUP INSTALLER SCRIPT (NSIS)
; ====================================================================
; Compiles natively on Linux via 'makensis' or on Windows.
; Generates enterprise-grade, signed-ready installer executable.
; ====================================================================

Unicode true

!ifndef VERSION
  !define VERSION "26.11.6"
!endif

!ifndef OUTDIR
  !define OUTDIR "release"
!endif

!define PRODUCT_NAME "One Tap"
!define PRODUCT_VERSION "${VERSION}"
!define PRODUCT_PUBLISHER "BS Framework"
!define PRODUCT_WEB_SITE "https://bsframework.com/"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\One Tap.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKCU"

SetCompressor /SOLID lzma
RequestExecutionLevel user

; ── MODERN UI CONFIGURATION ───────────────────────────────────────────
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "..\resources\icon.ico"
!define MUI_UNICON "..\resources\icon.ico"

!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "..\resources\installer_small.bmp"
!define MUI_HEADERIMAGE_RIGHT

!define MUI_WELCOMEFINISHPAGE_BITMAP "..\resources\installer_banner.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "..\resources\installer_banner.bmp"

; ── INSTALLER PAGES ───────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\resources\LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\One Tap.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch One Tap now"
!insertmacro MUI_PAGE_FINISH

; ── UNINSTALLER PAGES ─────────────────────────────────────────────────
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; ── GENERAL CONFIGURATION ─────────────────────────────────────────────
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\${OUTDIR}\OneTap-Setup-V-${PRODUCT_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\One Tap"
InstallDirRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

; ── INSTALLATION SECTION ──────────────────────────────────────────────
Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Install unpacked application files
  DetailPrint "Extracting One Tap workstation files..."
  File /r "..\release\win-unpacked\*.*"

  ; Optional File Manager component (if built)
  SetOutPath "$INSTDIR\FileManager"
  File /nonfatal /r "..\packages\file-manager\dist-installer\win-unpacked\*.*"
  SetOutPath "$INSTDIR"

  ; Create Shortcuts
  DetailPrint "Creating application shortcuts..."
  CreateDirectory "$SMPROGRAMS\One Tap"
  CreateShortcut "$SMPROGRAMS\One Tap\One Tap.lnk" "$INSTDIR\One Tap.exe" "" "$INSTDIR\One Tap.exe" 0
  CreateShortcut "$SMPROGRAMS\One Tap\Uninstall One Tap.lnk" "$INSTDIR\Uninstall One Tap.exe" "" "$INSTDIR\Uninstall One Tap.exe" 0
  CreateShortcut "$DESKTOP\One Tap.lnk" "$INSTDIR\One Tap.exe" "" "$INSTDIR\One Tap.exe" 0
SectionEnd

Section -Post
  ; Write Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall One Tap.exe"

  ; Write Registry Keys for App Paths
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\One Tap.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}" "Path" "$INSTDIR"

  ; Register AppUserModelID for Taskbar Grouping and Pin Unification
  WriteRegStr HKCU "Software\Classes\Applications\One Tap.exe" "AppUserModelID" "com.bsframework.onetap"
  WriteRegStr HKCU "Software\Classes\Applications\One Tap.exe" "FriendlyAppName" "One Tap"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.bsframework.onetap" "DisplayName" "One Tap"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.bsframework.onetap" "IconUri" "$INSTDIR\One Tap.exe,0"

  ; Write Windows Add/Remove Programs Information
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall One Tap.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\One Tap.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

; ── UNINSTALLATION SECTION ────────────────────────────────────────────
Function un.onUninstSuccess
  HideWindow
  MessageBox MB_ICONINFORMATION|MB_OK "$(^Name) was successfully removed from your computer."
FunctionEnd

Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove $(^Name) and all of its components?" IDYES +2
  Abort
FunctionEnd

Section Uninstall
  DetailPrint "Removing shortcuts..."
  Delete "$DESKTOP\One Tap.lnk"
  Delete "$SMPROGRAMS\One Tap\One Tap.lnk"
  Delete "$SMPROGRAMS\One Tap\Uninstall One Tap.lnk"
  RMDir "$SMPROGRAMS\One Tap"

  DetailPrint "Removing files..."
  RMDir /r "$INSTDIR\FileManager"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  Delete "$INSTDIR\*.*"
  RMDir /r "$INSTDIR"

  ; Clean Registry
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}"
  DeleteRegKey HKCU "Software\Classes\Applications\One Tap.exe"
  DeleteRegKey HKCU "Software\Classes\AppUserModelId\com.bsframework.onetap"
  SetAutoClose true
SectionEnd
