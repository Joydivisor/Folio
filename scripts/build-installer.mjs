import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build, Platform, Arch} from 'electron-builder';
import {windowsInstallerConfig, writeUpdateConfig} from './installer-config.mjs';
import {extractFile} from '@electron/asar';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {version} = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const payload = path.resolve(process.env.FOLIO_INSTALLER_PAYLOAD || path.join(root, 'dist', `v${version}`, 'Folio-win32-x64'));
if (!payload.startsWith(root + path.sep)) throw Error('Installer payload must stay inside this checkout.');
if (!fs.existsSync(path.join(payload, 'Folio.exe'))) throw Error('Run npm run package:win first.');
const packaged = JSON.parse(extractFile(path.join(payload, 'resources', 'app.asar'), 'package.json'));
if (packaged.version !== version) throw Error('Packaged application version differs from package.json; rebuild the application.');
// Prepackaged builds skip electron-builder's afterPack hook. Use the fixed public feed.
writeUpdateConfig(payload);
process.env.ELECTRON_BUILDER_CACHE ||= path.join(root, '.installer-cache', 'electron-builder');
const started = performance.now();
const artifacts = await build({projectDir: root, prepackaged: payload, targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64), publish: 'never', config: windowsInstallerConfig(root, version)});
const out = path.join(root, 'dist', 'v' + version);
const timingFile = path.join(out, 'build-timing.json');
const timing = fs.existsSync(timingFile) ? JSON.parse(fs.readFileSync(timingFile)) : {};
fs.writeFileSync(timingFile, JSON.stringify({...timing, installerSeconds: Number(((performance.now() - started) / 1000).toFixed(2))}, null, 2));
console.log(artifacts.join('\n'));
