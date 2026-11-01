import { packager } from '@electron/packager';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.electron-cache');
const version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8')).version;
const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const cachedFolder = fs.existsSync(cache) ? fs.readdirSync(cache).find(name => fs.existsSync(path.join(cache, name, `electron-v${version}-win32-x64.zip`))) : undefined;
const paths = await packager({
  ...(cachedFolder ? {electronZipDir:path.join(cache,cachedFolder)} : {}),
  dir: root, out: process.env.FOLIO_PACKAGE_OUT || path.join(root, 'dist', `v${appVersion}`), name: 'Folio',
  executableName: 'Folio', platform: 'win32', arch: 'x64',
  icon: path.join(root, 'build', 'folio.ico'),
  overwrite: true, prune: true, asar: true,
  // Only runtime sources and dependencies enter a public download.
  ignore: [/^\/(?!(?:public|desktop|node_modules|build)(?:\/|$)|(?:package\.json|server\.mjs)$).+/],
  win32metadata: { CompanyName: 'Folio', FileDescription: 'Folio reading workspace', ProductName: 'Folio' },
});
console.log(paths.join('\n'));

