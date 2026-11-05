// Real NSIS -> electron-updater -> NSIS upgrade, using a disposable app ID,
// executable, local feed and profile. Never installs over the user's Folio.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {extractAll, createPackageWithOptions} from '@electron/asar';
import {build, Platform, Arch} from 'electron-builder';
import {windowsInstallerConfig} from './installer-config.mjs';

if (process.platform !== 'win32') throw Error('Run this integration test on Windows.');
const root = process.cwd(), {version} = JSON.parse(fs.readFileSync('package.json'));
const nextVersion = version.replace(/(\d+)$/, value => String(Number(value) + 1));
const reports = path.join(root, 'tests', 'reports'); fs.mkdirSync(reports, {recursive: true});
const temp = fs.mkdtempSync(path.join(reports, 'update-install-'));
const profile = path.join(temp, 'profile'), payload = path.join(temp, 'payload'), source = path.join(temp, 'source'), target = path.join(temp, 'installed');
const feedFolder = path.join(temp, 'feed'), resultFile = path.join(temp, 'result.json');
const name = 'FolioUpdateCheck', guid = crypto.randomUUID(), appId = 'local.folio.updatecheck.' + guid;
const cache = path.join(temp, 'cache'); fs.mkdirSync(cache);
const env = {...process.env, LOCALAPPDATA: cache}; delete env.ELECTRON_RUN_AS_NODE;
process.env.ELECTRON_BUILDER_CACHE ||= path.join(root, '.installer-cache', 'electron-builder');
function run(file, args = [], timeout = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    let output = ''; child.stdout.on('data', value => output += value); child.stderr.on('data', value => output += value);
    const timer = setTimeout(() => {child.kill(); reject(Error('Timed out: ' + file));}, timeout);
    child.on('error', error => {clearTimeout(timer); reject(error);});
    child.on('exit', code => {clearTimeout(timer); code === 0 ? resolve(output) : reject(Error('Exit ' + code + ': ' + output));});
  });
}
const server = http.createServer((req, res) => {
  const file = path.join(feedFolder, path.basename(new URL(req.url, 'http://localhost').pathname));
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404); res.end(); return;}
  const size = fs.statSync(file).size;
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  const start = range ? Number(range[1]) : 0, end = range?.[2] ? Number(range[2]) : size - 1;
  res.writeHead(range ? 206 : 200, {'Content-Length': end - start + 1, 'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes', ...(range ? {'Content-Range': `bytes ${start}-${end}/${size}`} : {})});
  fs.createReadStream(file, {start, end}).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const feed = `http://127.0.0.1:${server.address().port}/`;
let installed = false;
try {
  fs.cpSync(path.join(root, 'dist', 'v' + version, 'Folio-win32-x64'), payload, {recursive: true});
  fs.renameSync(path.join(payload, 'Folio.exe'), path.join(payload, name + '.exe'));
  extractAll(path.join(payload, 'resources', 'app.asar'), source);
  const mainPath = path.join(source, 'desktop', 'main.cjs');
  fs.writeFileSync(mainPath, fs.readFileSync(mainPath, 'utf8').replace('const PORT = 4174;', 'const PORT = 4196;').replace("app.setAppUserModelId('local.folio.reading')", `app.setAppUserModelId(${JSON.stringify(appId)})`));
  // This entry exists only in test installers; the shipped main process has no
  // feed override or test-mode environment variable.
  fs.copyFileSync(path.join(root, 'scripts', 'update-fixture.cjs'), path.join(source, 'desktop', 'update-fixture.cjs'));
  fs.writeFileSync(path.join(source, 'desktop', 'update-test-config.json'), JSON.stringify({profile, resultFile, initial: version, cache, name}));
  for (const releaseVersion of [version, nextVersion]) {
    const pkgPath = path.join(source, 'package.json'), pkg = JSON.parse(fs.readFileSync(pkgPath));
    Object.assign(pkg, {name: 'folio-update-check', productName: name, version: releaseVersion, main: 'desktop/update-fixture.cjs'});
    fs.writeFileSync(pkgPath, JSON.stringify(pkg));
    await createPackageWithOptions(source, path.join(payload, 'resources', 'app.asar'), {dot: true});
    fs.writeFileSync(path.join(payload, 'resources', 'app-update.yml'), `provider: generic\nurl: ${feed}\nupdaterCacheDirName: folio-update-check-${guid}\n`);
    const config = windowsInstallerConfig(root, releaseVersion);
    Object.assign(config, {appId, productName: name, extraMetadata: {name: pkg.name, version: releaseVersion, productName: name}, artifactName: `${name}-${releaseVersion}.exe`, publish: [{provider: 'generic', url: feed}], directories: {...config.directories, output: feedFolder}});
    Object.assign(config.nsis, {guid, createDesktopShortcut: false, createStartMenuShortcut: false, displayLanguageSelector: false});
    config.win.executableName = name;
    await build({projectDir: root, prepackaged: payload, targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64), publish: 'never', config});
  }
  console.log('Installing isolated V' + version + ' fixture...');
  await run(path.join(feedFolder, `${name}-${version}.exe`), ['/S', '/currentuser', '/D=' + target]); installed = true;
  console.log('Running real download, restart and V' + nextVersion + ' upgrade...');
  await run(path.join(target, name + '.exe'));
  const deadline = Date.now() + 180000;
  while (!fs.existsSync(resultFile)) {if (Date.now() > deadline) throw Error('Updated app did not report a result.'); await new Promise(resolve => setTimeout(resolve, 500));}
  const result = JSON.parse(fs.readFileSync(resultFile));
  if (!result.passed) throw Error(result.error);
  fs.writeFileSync(path.join(reports, 'update-install.json'), JSON.stringify({...result, evidence: temp}, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  server.close(); server.closeAllConnections();
  if (installed) {
    if (!path.resolve(target).startsWith(path.resolve(temp) + path.sep)) throw Error('Unsafe test uninstall path.');
    const original = path.join(target, `Uninstall ${name}.exe`), external = path.join(temp, 'uninstall-test.exe');
    if (fs.existsSync(original)) {fs.copyFileSync(original, external); await run(external, ['/S', '_?=' + target]);}
  }
}
