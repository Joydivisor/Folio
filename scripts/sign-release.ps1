# Run from the source checkout on the Windows release-signing account after CI.
# Only public update metadata is uploaded. The signing key stays on this machine.
$ErrorActionPreference = 'Stop'
$releaseVersion = (Get-Content -Raw package.json | ConvertFrom-Json).version
$releaseDir = Join-Path 'releases' ('v' + $releaseVersion)
$metadata = Join-Path $releaseDir 'draft-metadata.json'
node scripts/fetch-signing-assets.mjs
if ($LASTEXITCODE -ne 0) { throw 'Could not verify CI downloads' }
Add-Type -AssemblyName System.Security
$protected = [IO.File]::ReadAllBytes((Resolve-Path '.installer-cache/signing/folio-update.dpapi'))
$der = [Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
try {
  [Convert]::ToBase64String($der) | node scripts/sign-update-feeds.mjs $releaseDir $metadata
  if ($LASTEXITCODE -ne 0) { throw 'Update metadata signing failed' }
} finally { [Array]::Clear($der,0,$der.Length) }
$names = 'appcast-mac-arm64.xml','appcast-mac-x64.xml',('Folio-' + $releaseVersion + '-linux-x64.deb.sig')
$feeds = @($names | ForEach-Object { Join-Path $releaseDir $_ })
node scripts/upload-release.mjs --repo Joydivisor/Folio --tag ('v'+$releaseVersion) @feeds
exit $LASTEXITCODE
