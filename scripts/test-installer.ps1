$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$setup = Join-Path $root "releases\Folio-Setup-$version-win-x64.exe"
$reportDir = Join-Path $root 'tests\reports'
$target = Join-Path $reportDir 'installer test target'
$invalid = Join-Path $reportDir 'installer occupied target'
$reg = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Folio'
$installReg = 'HKCU:\Software\Folio\Installer'
$desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Folio.lnk'
$menu = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\Folio'
function Assert($condition, $message) { if (-not $condition) { throw $message } }
Assert ([Environment]::Is64BitProcess) 'Run the installer test in 64-bit PowerShell.'
Assert (Test-Path -LiteralPath $setup) 'Build the installer first.'
Assert (-not (Test-Path $reg)) 'An existing Folio installation must not be modified by this test.'
Assert (-not (Test-Path -LiteralPath $desktop)) 'An existing desktop shortcut must not be modified.'
Assert (-not (Test-Path -LiteralPath $menu)) 'An existing Start menu folder must not be modified.'
Assert (-not (Test-Path -LiteralPath $target)) 'The test destination must not already exist.'
Assert (-not (Test-Path -LiteralPath $invalid)) 'The occupied-folder fixture must not already exist.'
New-Item -ItemType Directory -Path $invalid -Force | Out-Null
Set-Content -LiteralPath (Join-Path $invalid 'keep.txt') -Value 'Do not overwrite'
function Run-Setup($arguments) {
    $process = Start-Process -FilePath $setup -ArgumentList $arguments -WindowStyle Hidden -PassThru
    Assert ($process.WaitForExit(120000)) 'Setup timed out.'
    $process.Refresh()
    return $process.ExitCode
}
$checks = [ordered]@{}
$checks.nonemptyFolderRejected = (Run-Setup "/S /D=$invalid") -ne 0
Assert $checks.nonemptyFolderRejected 'Setup accepted a folder containing unrelated files.'
Assert ((Get-Content (Join-Path $invalid 'keep.txt') -Raw).Trim() -eq 'Do not overwrite') 'Existing file changed.'
Assert (-not (Test-Path $reg)) 'Rejected installation registered itself.'
Assert ((Run-Setup "/S /DESKTOP=0 /D=$target") -eq 0) 'Installation failed.'
$checks.customDirectory = (Get-ItemProperty $reg).InstallLocation -eq $target
$checks.desktopOptOut = -not (Test-Path -LiteralPath $desktop)
$checks.startMenu = Test-Path -LiteralPath (Join-Path $menu 'Folio.lnk')
$checks.uninstallCommand = (Get-ItemProperty $reg).UninstallString -eq ('"' + (Join-Path $target 'Uninstall.exe') + '"')
$checks.payloadMatches = (Get-FileHash (Join-Path $target 'resources\app.asar')).Hash -eq (Get-FileHash (Join-Path $root "dist\v$version\Folio-win32-x64\resources\app.asar")).Hash
foreach ($entry in $checks.GetEnumerator()) { Assert $entry.Value $entry.Key }
Set-Content -LiteralPath (Join-Path $target 'user-document.txt') -Value 'Preserve this user file'
# No /D on update: the stored custom installation path must be reused.
Assert ((Run-Setup '/S /DESKTOP=1') -eq 0) 'Update failed.'
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($desktop)
$checks.desktopOptIn = $shortcut.TargetPath -eq (Join-Path $target 'Folio.exe')
$checks.updateRetainsDirectory = (Get-ItemProperty $reg).InstallLocation -eq $target
$checks.updateRetainsUserFile = Test-Path -LiteralPath (Join-Path $target 'user-document.txt')
foreach ($entry in $checks.GetEnumerator()) { Assert $entry.Value $entry.Key }
# Use an external copy so the process can remove its installed executable and be waited on.
$uninstaller = Join-Path $reportDir 'Folio-test-uninstall.exe'
Copy-Item -LiteralPath (Join-Path $target 'Uninstall.exe') -Destination $uninstaller
$process = Start-Process -FilePath $uninstaller -ArgumentList "/S _?=$target" -WindowStyle Hidden -PassThru
Assert ($process.WaitForExit(120000)) 'Uninstall timed out.'
$process.Refresh()
Assert ($process.ExitCode -eq 0) 'Uninstall failed.'
$checks.unregistered = -not (Test-Path $reg)
$checks.shortcutsRemoved = (-not (Test-Path -LiteralPath $desktop)) -and (-not (Test-Path -LiteralPath $menu))
$remaining = @(Get-ChildItem -LiteralPath $target -Force)
$checks.onlyUserFileRemains = $remaining.Count -eq 1 -and $remaining[0].Name -eq 'user-document.txt'
foreach ($entry in $checks.GetEnumerator()) { Assert $entry.Value $entry.Key }
$checks | ConvertTo-Json | Set-Content (Join-Path $reportDir 'installer-integration.json')
$checks | ConvertTo-Json
# Delete only known test files and now-empty directories, never recursively.
Remove-Item -LiteralPath $uninstaller
Remove-Item -LiteralPath (Join-Path $target 'user-document.txt')
Remove-Item -LiteralPath $target
Remove-Item -LiteralPath (Join-Path $invalid 'keep.txt')
Remove-Item -LiteralPath $invalid
