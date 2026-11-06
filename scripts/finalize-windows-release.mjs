import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {zipSync, unzipSync, strToU8} from 'fflate';
const {load} = createRequire(import.meta.url)('js-yaml');
const {version} = JSON.parse(fs.readFileSync('package.json'));
const folder = path.resolve('releases', 'v' + version), installer = `Folio-Setup-${version}-win-x64.exe`;
const info = load(fs.readFileSync(path.join(folder, 'latest.yml'), 'utf8'));
if (info.version !== version || info.files?.length !== 1 || info.files[0].url !== installer) throw Error('Release metadata does not match this installer.');
const hash = async (file, algorithm, encoding = 'hex') => {const value = crypto.createHash(algorithm); for await (const chunk of fs.createReadStream(file)) value.update(chunk); return value.digest(encoding);};
const exe = path.join(folder, installer);
if (info.files[0].size !== fs.statSync(exe).size || info.files[0].sha512 !== await hash(exe, 'sha512', 'base64')) throw Error('Installer differs from its updater checksum.');
// The optional ZIP wraps the exact same installer, without recompressing an
// already-compressed EXE. CI uploads it once alongside the normal download.
const zipName = installer.replace(/\.exe$/, '.zip');
const zipPath = path.join(folder, zipName);
fs.writeFileSync(zipPath, zipSync({[installer]: fs.readFileSync(exe), 'README.txt': strToU8('Folio ' + version + '\nExtract this folder and run ' + installer + '. Existing documents, notes and settings are retained.\n解压后运行安装程序；已有文献、笔记和设置保留。\n')}, {level: 0}));
const zipped = unzipSync(fs.readFileSync(zipPath), {filter: file => file.name === installer})[installer];
if (!zipped || crypto.createHash('sha256').update(zipped).digest('hex') !== await hash(exe, 'sha256')) throw Error('ZIP installer differs from EXE.');
const files = [installer, zipName, installer + '.blockmap', 'latest.yml'];
const sums = [];
for (const file of files) sums.push(`${await hash(path.join(folder, file), 'sha256')}  ${file}`);
fs.writeFileSync(path.join(folder, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
const notes = path.join('docs', `release-${version}.md`);
if (fs.existsSync(notes)) fs.copyFileSync(notes, path.join(folder, 'RELEASE-NOTES.md'));
console.log('Verified update metadata and wrote SHA256SUMS.txt: ' + folder);
