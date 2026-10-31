Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
!include "nsDialogs.nsh"
!include "build-info.nsh"

Name "Folio"
OutFile "${INSTALLER_OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\Folio"
RequestExecutionLevel user
ManifestDPIAware true
ManifestSupportedOS all
SetCompressor /SOLID lzma
SetCompressorDictSize 32
BrandingText "Folio"
VIProductVersion "${NUMERIC_VERSION}"
VIAddVersionKey /LANG=1033 "ProductName" "Folio"
VIAddVersionKey /LANG=1033 "FileDescription" "Folio Setup"
VIAddVersionKey /LANG=1033 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Folio"

!define MUI_ICON "${APP_ICON}"
!define MUI_UNICON "${APP_ICON}"
!define MUI_ABORTWARNING
!define MUI_LANGDLL_REGISTRY_ROOT HKCU
!define MUI_LANGDLL_REGISTRY_KEY "Software\Folio\Installer"
!define MUI_LANGDLL_REGISTRY_VALUENAME "Language"
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ValidateDirectory
!insertmacro MUI_PAGE_DIRECTORY
Page custom ShortcutsPage ShortcutsLeave
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\Folio.exe"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!insertmacro MUI_PAGE_FINISH
!define MUI_UNCONFIRMPAGE_TEXT_TOP "$(UninstallHint)"
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"

LangString ShortcutsTitle ${LANG_ENGLISH} "Shortcuts"
LangString ShortcutsTitle ${LANG_SIMPCHINESE} "快捷方式"
LangString ShortcutsSubtitle ${LANG_ENGLISH} "Choose how you would like to open Folio."
LangString ShortcutsSubtitle ${LANG_SIMPCHINESE} "选择你希望如何打开 Folio。"
LangString DesktopText ${LANG_ENGLISH} "Create a desktop shortcut"
LangString DesktopText ${LANG_SIMPCHINESE} "创建桌面快捷方式"
LangString ShortcutHint ${LANG_ENGLISH} "Folio will also be available in the Start menu.$\r$\n$\r$\nOnly this Windows account will be changed."
LangString ShortcutHint ${LANG_SIMPCHINESE} "Folio 也会出现在开始菜单中。$\r$\n$\r$\n安装仅影响当前 Windows 账户。"
LangString InvalidDirectory ${LANG_ENGLISH} "Choose an empty folder dedicated to Folio, or your existing Folio installation folder."
LangString InvalidDirectory ${LANG_SIMPCHINESE} "请选择专用于 Folio 的空文件夹，或已有的 Folio 安装文件夹。"
LangString MoveInstallation ${LANG_ENGLISH} "Folio is already installed in another folder. Use that folder to update, or uninstall the previous installation first. Your library and notes will be kept."
LangString MoveInstallation ${LANG_SIMPCHINESE} "Folio 已安装在其他文件夹。请使用原位置更新，或先卸载旧安装。文献库和笔记会保留。"
LangString CloseFolio ${LANG_ENGLISH} "Close the Folio application running from this folder, then try again."
LangString CloseFolio ${LANG_SIMPCHINESE} "请先关闭从此文件夹运行的 Folio，然后重试。"
LangString InstallFailed ${LANG_ENGLISH} "Setup could not write all files. Check the selected folder and try again."
LangString InstallFailed ${LANG_SIMPCHINESE} "安装程序无法写入全部文件。请检查所选文件夹，然后重试。"
LangString UninstallHint ${LANG_ENGLISH} "Folio program files and its shortcuts will be removed. Your documents, notes and personal settings will be kept."
LangString UninstallHint ${LANG_SIMPCHINESE} "将移除 Folio 程序文件和快捷方式。你的文献、笔记和个人设置会保留。"
LangString UnsupportedOS ${LANG_ENGLISH} "Folio requires 64-bit Windows 10 or later."
LangString UnsupportedOS ${LANG_SIMPCHINESE} "Folio 需要 64 位 Windows 10 或更新版本。"
LangString SetupRunning ${LANG_ENGLISH} "Another Folio setup is running. Close it before continuing."
LangString SetupRunning ${LANG_SIMPCHINESE} "另一个 Folio 安装程序正在运行，请先关闭它。"

Var DesktopChoice
Var DesktopCheckbox
Var Dialog
Var OldInstallDir
Var SetupMutex

Function .onInit
  SetShellVarContext current
  SetRegView 64
  !insertmacro MUI_LANGDLL_DISPLAY
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "$(UnsupportedOS)" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "$(UnsupportedOS)" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\Folio.Setup") p .r0 ?e'
  Pop $1
  StrCpy $SetupMutex $0
  ${If} $1 == 183
    MessageBox MB_OK|MB_ICONSTOP "$(SetupRunning)" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  ReadRegStr $OldInstallDir HKCU "Software\Folio\Installer" "InstallDir"
  ${If} $OldInstallDir != ""
  ${AndIf} $INSTDIR == "$LOCALAPPDATA\Programs\Folio"
    StrCpy $INSTDIR $OldInstallDir
  ${EndIf}
  StrCpy $DesktopChoice 0
  ReadRegDWORD $DesktopChoice HKCU "Software\Folio\Installer" "DesktopShortcut"
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/DESKTOP=" $1
  ${IfNot} ${Errors}
    ${If} $1 == "1"
      StrCpy $DesktopChoice 1
    ${Else}
      StrCpy $DesktopChoice 0
    ${EndIf}
  ${EndIf}
FunctionEnd

Function ValidateDirectory
  ${GetRoot} "$INSTDIR" $0
  ${If} $INSTDIR == $0
    Goto invalid
  ${EndIf}
  ${If} $INSTDIR == "$0\"
    Goto invalid
  ${EndIf}
  ${If} $OldInstallDir != ""
  ${AndIf} $OldInstallDir != $INSTDIR
  ${AndIf} ${FileExists} "$OldInstallDir\.folio-install.ini"
    MessageBox MB_OK|MB_ICONSTOP "$(MoveInstallation)" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  ReadINIStr $0 "$INSTDIR\.folio-install.ini" "Folio" "Product"
  ${If} $0 == "local.folio.reading"
    Return
  ${EndIf}
  FindFirst $0 $1 "$INSTDIR\*"
  loop:
    ${If} $1 == ""
      FindClose $0
      Return
    ${EndIf}
    ${If} $1 != "."
    ${AndIf} $1 != ".."
      FindClose $0
      Goto invalid
    ${EndIf}
    FindNext $0 $1
    Goto loop
  invalid:
    MessageBox MB_OK|MB_ICONSTOP "$(InvalidDirectory)" /SD IDOK
    SetErrorLevel 2
    Abort
FunctionEnd

Function ShortcutsPage
  !insertmacro MUI_HEADER_TEXT "$(ShortcutsTitle)" "$(ShortcutsSubtitle)"
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}
  ${NSD_CreateCheckbox} 0 8u 100% 18u "$(DesktopText)"
  Pop $DesktopCheckbox
  ${NSD_SetState} $DesktopCheckbox $DesktopChoice
  ${NSD_CreateLabel} 0 42u 100% 65u "$(ShortcutHint)"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function ShortcutsLeave
  ${NSD_GetState} $DesktopCheckbox $DesktopChoice
FunctionEnd

!macro CheckExecutableUnlocked
  ${If} ${FileExists} "$INSTDIR\Folio.exe"
    ClearErrors
    FileOpen $0 "$INSTDIR\Folio.exe" a
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONSTOP "$(CloseFolio)" /SD IDOK
      SetErrorLevel 2
      Abort
    ${EndIf}
    FileClose $0
  ${EndIf}
!macroend

Section "Folio" InstallFolio
  Call ValidateDirectory
  !insertmacro CheckExecutableUnlocked
  SetOutPath "$INSTDIR"
  ; Mark even a partial install so it can be repaired in the same directory.
  WriteINIStr "$INSTDIR\.folio-install.ini" "Folio" "Product" "local.folio.reading"
  ClearErrors
  File /r "${PAYLOAD_DIR}\*"
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "$(InstallFailed)" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteINIStr "$INSTDIR\.folio-install.ini" "Folio" "Version" "${APP_VERSION}"
  CreateDirectory "$SMPROGRAMS\Folio"
  CreateShortcut "$SMPROGRAMS\Folio\Folio.lnk" "$INSTDIR\Folio.exe" "" "$INSTDIR\Folio.exe" 0
  CreateShortcut "$SMPROGRAMS\Folio\Uninstall Folio.lnk" "$INSTDIR\Uninstall.exe"
  ${If} $DesktopChoice == 1
    CreateShortcut "$DESKTOP\Folio.lnk" "$INSTDIR\Folio.exe" "" "$INSTDIR\Folio.exe" 0
  ${Else}
    ; Remove only a shortcut previously created by this installation.
    ReadRegDWORD $0 HKCU "Software\Folio\Installer" "DesktopShortcut"
    ${If} $0 == 1
      Delete "$DESKTOP\Folio.lnk"
    ${EndIf}
  ${EndIf}
  WriteRegStr HKCU "Software\Folio\Installer" "InstallDir" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Folio\Installer" "DesktopShortcut" $DesktopChoice
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "DisplayName" "Folio"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "Publisher" "Folio"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "DisplayIcon" "$INSTDIR\Folio.exe,0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "URLInfoAbout" "https://getfolio.pages.dev/"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "NoRepair" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio" "EstimatedSize" ${INSTALLED_KB}
SectionEnd

Function un.onInit
  SetShellVarContext current
  SetRegView 64
  !insertmacro MUI_UNGETLANGUAGE
  ReadINIStr $0 "$INSTDIR\.folio-install.ini" "Folio" "Product"
  ${If} $0 != "local.folio.reading"
    SetErrorLevel 2
    Abort
  ${EndIf}
FunctionEnd

Section "Uninstall"
  !insertmacro CheckExecutableUnlocked
  ; Exact build manifest only: never recursively delete the installation folder.
  !include "uninstall-files.nsh"
  ReadRegStr $0 HKCU "Software\Folio\Installer" "InstallDir"
  ${If} $0 == $INSTDIR
    ReadRegDWORD $1 HKCU "Software\Folio\Installer" "DesktopShortcut"
    ${If} $1 == 1
      Delete "$DESKTOP\Folio.lnk"
    ${EndIf}
    Delete "$SMPROGRAMS\Folio\Folio.lnk"
    Delete "$SMPROGRAMS\Folio\Uninstall Folio.lnk"
    RMDir "$SMPROGRAMS\Folio"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio"
    DeleteRegKey HKCU "Software\Folio\Installer"
  ${EndIf}
  Delete "$INSTDIR\.folio-install.ini"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
