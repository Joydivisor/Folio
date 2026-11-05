import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export async function electronPackageOptions(root, platform, arch, cacheRoot = process.env.electron_config_cache || path.join(root, '.electron-cache')) {
  const electron = path.join(root, 'node_modules', 'electron');
  const {version} = JSON.parse(fs.readFileSync(path.join(electron, 'package.json'), 'utf8'));
  const checksums = JSON.parse(fs.readFileSync(path.join(electron, 'checksums.json'), 'utf8'));
  const filename = `electron-v${version}-${platform}-${arch}.zip`;
  const expected = checksums[filename];
  if (!/^[a-f0-9]{64}$/.test(expected || '')) throw Error('Missing official Electron checksum for ' + filename);
  // Different download URLs can leave the same official ZIP in different cache folders.
  const directories = fs.existsSync(cacheRoot) ? [cacheRoot, ...fs.readdirSync(cacheRoot, {withFileTypes: true}).filter(entry => entry.isDirectory()).map(entry => path.join(cacheRoot, entry.name))] : [];
  for (const directory of directories) {
    const file = path.join(directory, filename);
    if (!fs.existsSync(file)) continue;
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    if (hash.digest('hex') !== expected) throw Error('Electron cache failed SHA-256 verification: ' + file);
    return {electronVersion: version, electronZipDir: directory};
  }
  return {electronVersion: version, download: {cacheRoot, checksums}};
}
