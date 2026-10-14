; ====================================================================
; UNI DESK — PROFESSIONAL WINDOWS SETUP INSTALLER SCRIPT (NSIS)
; ====================================================================
; Compiles natively on Linux via 'makensis' or on Windows.
; Generates enterprise-grade, signed-ready installer executable.
; ====================================================================

Unicode true

!ifndef VERSION
  !define VERSION "26.10.10"
!endif

!ifndef OUTDIR
  !define OUTDIR "release"
!endif

!define PRODUCT_NAME "Uni Desk"
!define PRODUCT_VERSION "${VERSION}"
!define PRODUCT_PUBLISHER "BS Framework"
!define PRODUCT_WEB_SITE "https://bsframework.com/"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\Uni Desk.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKCU"

SetCompressor /SOLID lzma
RequestExecutionLevel user

; ── MODERN UI CONFIGURATION ───────────────────────────────────────────
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "../resources/icon.ico"
!define MUI_UNICON "../resources/icon.ico"

!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "../resources/installer_small.bmp"
!define MUI_HEADERIMAGE_RIGHT

!define MUI_WELCOMEFINISHPAGE_BITMAP "../resources/installer_banner.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "../resources/installer_banner.bmp"

; ── INSTALLER PAGES ───────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "../resources/LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\Uni Desk.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Uni Desk now"
!insertmacro MUI_PAGE_FINISH

; ── UNINSTALLER PAGES ─────────────────────────────────────────────────
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; ── GENERAL CONFIGURATION ─────────────────────────────────────────────
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "../${OUTDIR}/UniDesk_V${PRODUCT_VERSION}_Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Uni Desk"
InstallDirRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

; ── INSTALLATION SECTION ──────────────────────────────────────────────
Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Install unpacked application files
  DetailPrint "Extracting Uni Desk workstation files..."
  File /r "../release/win-unpacked/*.*"

  ; Optional File Manager component (if built)
  SetOutPath "$INSTDIR\FileManager"
  File /nonfatal /r "../packages/file-manager/dist-installer/win-unpacked/*.*"
  SetOutPath "$INSTDIR"

  ; Create Shortcuts
  DetailPrint "Creating application shortcuts..."
  CreateDirectory "$SMPROGRAMS\Uni Desk"
  CreateShortcut "$SMPROGRAMS\Uni Desk\Uni Desk.lnk" "$INSTDIR\Uni Desk.exe" "" "$INSTDIR\Uni Desk.exe" 0
  CreateShortcut "$SMPROGRAMS\Uni Desk\Uninstall Uni Desk.lnk" "$INSTDIR\Uninstall Uni Desk.exe" "" "$INSTDIR\Uninstall Uni Desk.exe" 0
  CreateShortcut "$DESKTOP\Uni Desk.lnk" "$INSTDIR\Uni Desk.exe" "" "$INSTDIR\Uni Desk.exe" 0
SectionEnd

Section -Post
  ; Write Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall Uni Desk.exe"

  ; Write Registry Keys for App Paths
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\Uni Desk.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}" "Path" "$INSTDIR"

  ; Write Windows Add/Remove Programs Information
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall Uni Desk.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\Uni Desk.exe"
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
  Delete "$DESKTOP\Uni Desk.lnk"
  Delete "$SMPROGRAMS\Uni Desk\Uni Desk.lnk"
  Delete "$SMPROGRAMS\Uni Desk\Uninstall Uni Desk.lnk"
  RMDir "$SMPROGRAMS\Uni Desk"

  DetailPrint "Removing files..."
  RMDir /r "$INSTDIR\FileManager"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  Delete "$INSTDIR\*.*"
  RMDir /r "$INSTDIR"

  ; Clean Registry
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_DIR_REGKEY}"
  SetAutoClose true
SectionEnd
