import { packager } from '@electron/packager';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {auditPackage} from './audit-package.mjs';
import {electronPackageOptions} from './electron-cache.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8')).version;
const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const out = path.resolve(process.env.FOLIO_PACKAGE_OUT || path.join(root, 'dist', `v${appVersion}`));
if (!out.startsWith(root + path.sep)) throw Error('Package output must stay inside this checkout.');
const started = performance.now();
const paths = await packager({
  ...await electronPackageOptions(root, 'win32', 'x64'), tmpdir: path.join(root, 'dist', '.packager-tmp'),
  dir: root, out, name: 'Folio',
  executableName: 'Folio', platform: 'win32', arch: 'x64',
  icon: path.join(root, 'build', 'folio.ico'),
  overwrite: true, prune: true, asar: true,
  // Only runtime sources and dependencies enter a public download.
  ignore: [/^\/(?!(?:public|desktop|node_modules|build)(?:\/|$)|(?:package\.json|server\.mjs|LICENSE|THIRD_PARTY_NOTICES\.md)$).+/],
  win32metadata: { CompanyName: 'Folio', FileDescription: 'Folio reading workspace', ProductName: 'Folio' },
});
await auditPackage(path.join(paths[0], 'resources', 'app.asar'), path.join(out, 'package-audit.json'));
fs.writeFileSync(path.join(out, 'runtime-path.txt'), path.join(paths[0], 'Folio.exe'));
fs.writeFileSync(path.join(out, 'build-timing.json'), JSON.stringify({platform: 'win32', arch: 'x64', electron: version, packageSeconds: Number(((performance.now() - started) / 1000).toFixed(2))}, null, 2));
console.log(paths.join('\n'));

