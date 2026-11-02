from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
release_dir = root / 'releases'
installer = release_dir / f'Folio-Setup-{version}-win-x64.exe'
archive = installer.with_suffix('.zip')
manifest = release_dir / 'SHA256SUMS.txt'
known_hashes = {name: digest for digest, name in
                (line.split(maxsplit=1) for line in manifest.read_text(encoding='utf-8-sig').splitlines() if line.strip())}
expected = known_hashes[installer.name]
if archive.exists():
    raise SystemExit(f'ZIP already exists and was left unchanged: {archive}')

def sha256_file(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

if sha256_file(installer) != expected:
    raise RuntimeError('Installer differs from the release checksum manifest.')

readme = '''Folio beta.9 | Windows 内测安装说明
适用：Windows 10 / 11，x64（64 位 Intel / AMD）

1. 右键 ZIP，选择“全部解压缩”。
2. 打开解压后的文件夹，双击 Folio-Setup-1.0.0-beta.9-win-x64.exe。
3. 选择安装语言和安装位置，再选择是否创建桌面快捷方式。
4. 安装完成后，从开始菜单或桌面打开 Folio。

首次使用：连接自己的文献文件夹，或导入文件。需要 AI 时，在设置中
选择服务商，填写自己的 API Key 并选择模型；阅读本地文献不需要 Key。

已有版本：先退出 Folio，再安装到原位置。已有本地文献库、笔记和设置
会保留；重新安装不会清空之前的使用记录。

这是未签名的内测版本，Windows 可能显示发布者或信誉提示。
请确认文件来自 Folio 开发者；无需关闭系统安全防护。

包内不含开发者的 API Key、私人文献或测试账户数据。
发现问题时，请记录操作步骤并附截图；反馈前遮住密钥和私人内容。

文件校验：SHA256SUMS.txt 列出了安装程序和本说明的 SHA-256。
官网：https://getfolio.pages.dev/

------------------------------------------------------------
Folio beta.9 | Windows installation
For Windows 10 / 11, x64 (64-bit Intel / AMD).

1. Right-click this ZIP and choose Extract All.
2. Run Folio-Setup-1.0.0-beta.9-win-x64.exe from the extracted folder.
3. Choose a language, installation folder and optional desktop shortcut.
4. Open Folio from the Start menu or your desktop.

Connect your document folder or import files. To use AI, choose a provider
in Settings, enter your own API key and select a model. Local reading does
not require a key. Close Folio before updating at its existing location;
your library, notes and settings are retained.

This beta is unsigned, so Windows may display a publisher or reputation
warning. Verify that the package came from the Folio developer. You do not
need to turn off security protection. No developer API keys, private
documents or test profiles are included.

When reporting an issue, include steps and screenshots, with keys and
private content removed. SHA256SUMS.txt contains file checksums.
Website: https://getfolio.pages.dev/
'''.replace('1.0.0-beta.9', version).replace('Folio beta.9', f'Folio {version}').replace('\n', '\r\n').encode('utf-8-sig')
readme_hash = hashlib.sha256(readme).hexdigest()
checksums = (f'{expected}  {installer.name}\r\n'
             f'{readme_hash}  README.txt\r\n').encode('ascii')

# Explicit allowlist: never zip the workspace or a user profile.
# Setup is already LZMA-compressed; storing it avoids redundant compression.
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as output:
    output.write(installer, installer.name)
    output.writestr('README.txt', readme)
    output.writestr('SHA256SUMS.txt', checksums)

with zipfile.ZipFile(archive) as result:
    assert result.namelist() == [installer.name, 'README.txt', 'SHA256SUMS.txt']
    assert result.testzip() is None, 'ZIP CRC verification failed.'
    with result.open(installer.name) as stream:
        assert hashlib.file_digest(stream, 'sha256').hexdigest() == expected
    assert result.read('README.txt') == readme
    assert result.read('SHA256SUMS.txt') == checksums
    contents = [{'name': item.filename, 'sizeBytes': item.file_size} for item in result.infolist()]

zip_hash = sha256_file(archive)
archive.with_suffix('.zip.sha256').write_text(
    f'{zip_hash}  {archive.name}\n', encoding='ascii')
report = {
    'version': version,
    'archive': str(archive),
    'sizeBytes': archive.stat().st_size,
    'sha256': zip_hash,
    'installerSha256': expected,
    'installerMatchesReleaseManifest': True,
    'crcVerification': 'passed',
    'installerReadbackSha256': 'passed',
    'contents': contents,
}
verification_dir = release_dir / 'verification'
verification_dir.mkdir(exist_ok=True)
(verification_dir / (archive.name + '-verification.json')).write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
known_hashes[archive.name] = zip_hash
manifest.write_text(''.join(f'{digest}  {name}\n' for name, digest in known_hashes.items()), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
