import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const version = '2.10.1', commit = 'ab7d71291238df6e0492143b120c9b696a35f603';
const frameworkHash = '1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27';
const cliSources = {
  'main.m': '1c1452bf0db5a4194fac41e0dc753a357d24e0f6',
  'SPUCommandLineDriver.h': 'efdaac5f062062a16def44a3aba5bc2f2eb43521',
  'SPUCommandLineDriver.m': '940f5bba87243cfc4d9e07166c8d373829889414',
  'SPUCommandLineUserDriver.h': '8131fe4d798073482bec15c61bfc8f1964bf0ff5',
  'SPUCommandLineUserDriver.m': '3cf85fdaf27a10f3faa338a7cc33c4947b7f7560',
};
const run = (file, args) => execFileSync(file, args, {stdio: 'inherit'});
function download(url, file) {
  if (!fs.existsSync(file)) run('/usr/bin/curl', ['-fLsS', '--retry', '3', '--max-time', '180', url, '-o', file]);
}
export function addSparkle(app, arch) {
  const cache = path.resolve('.installer-cache', 'sparkle-' + version);
  fs.mkdirSync(cache, {recursive: true});
  const archive = path.join(cache, 'framework.tar.xz');
  download('https://github.com/sparkle-project/Sparkle/releases/download/' + version + '/Sparkle-' + version + '.tar.xz', archive);
  if (crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== frameworkHash) throw Error('Sparkle archive checksum mismatch');
  run('/usr/bin/tar', ['-xf', archive, '-C', cache, './Sparkle.framework', './LICENSE']);
  for (const [name, hash] of Object.entries(cliSources)) {
    const source = path.join(cache, name);
    download('https://raw.githubusercontent.com/sparkle-project/Sparkle/' + commit + '/sparkle-cli/' + name, source);
    const data = fs.readFileSync(source);
    if (crypto.createHash('sha1').update('blob ' + data.length + '\0').update(data).digest('hex') !== hash) throw Error('Sparkle source checksum mismatch: ' + name);
  }
  const contents = path.join(app, 'Contents');
  const helper = path.join(contents, 'Helpers/Folio Update.app/Contents');
  fs.mkdirSync(path.join(helper, 'MacOS'), {recursive: true});
  run('/usr/bin/ditto', [path.join(cache, 'Sparkle.framework'), path.join(contents, 'Frameworks/Sparkle.framework')]);
  fs.copyFileSync(path.join(cache, 'LICENSE'), path.join(contents, 'Resources/Sparkle-LICENSE.txt'));
  fs.writeFileSync(path.join(helper, 'Info.plist'), '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>sparkle</string><key>CFBundleIdentifier</key><string>app.getfolio.desktop.update</string><key>CFBundleName</key><string>Folio Update</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>LSUIElement</key><true/></dict></plist>');
  const binary = path.join(helper, 'MacOS/sparkle');
  run('/usr/bin/xcrun', ['clang', '-mmacosx-version-min=13.0', '-fobjc-arc', '-fblocks', '-DSPU_OBJC_DIRECT=__attribute__((objc_direct))',
    '-DSPU_OBJC_DIRECT_MEMBERS=__attribute__((objc_direct_members))', '-F' + cache, '-framework', 'Sparkle', '-framework', 'AppKit', '-framework', 'Foundation',
    '-Wl,-rpath,@executable_path/../../../../Frameworks', ...Object.keys(cliSources).filter(s => s.endsWith('.m')).map(s => path.join(cache, s)), '-o', binary]);
  const plist = path.join(contents, 'Info.plist');
  run('/usr/bin/plutil', ['-insert', 'SUPublicEDKey', '-string', require('../desktop/update-public-key.json'), plist]);
  run('/usr/bin/plutil', ['-insert', 'SUVerifyUpdateBeforeExtraction', '-bool', 'YES', plist]);
  run('/usr/bin/plutil', ['-insert', 'SUFeedURL', '-string', 'https://github.com/Joydivisor/Folio/releases/latest/download/appcast-mac-' + arch + '.xml', plist]);
}
