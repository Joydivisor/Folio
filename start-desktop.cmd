@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
start "Folio" "node_modules\electron\dist\electron.exe" .
