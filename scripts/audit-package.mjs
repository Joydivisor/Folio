import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {getRawHeader, extractFile} from '@electron/asar';

const allowedRoots = new Set(['public', 'desktop', 'node_modules', 'build', 'package.json', 'server.mjs', 'LICENSE', 'THIRD_PARTY_NOTICES.md']);
const buildOnly = ['@electron/packager', '@electron/asar', '@electron/universal', 'electron-builder', 'app-builder-lib', 'glob', 'minimatch', 'electron', 'fake-indexeddb', '@xmldom/xmldom'];

export async function auditPackage(archive, output) {
  const header = getRawHeader(archive).header;
  const unexpected = Object.keys(header.files).filter(name => !allowedRoots.has(name));
  if (unexpected.length) throw Error('Unexpected packaged roots: ' + unexpected.join(', '));
  const files = [];
  function walk(entries, prefix = '') {
    for (const [name, entry] of Object.entries(entries)) {
      const file = prefix + name;
      if (entry.files) walk(entry.files, file + '/');
      else files.push(file);
    }
  }
  walk(header.files);
  const bundledTools = buildOnly.filter(name => files.some(file => file.includes('node_modules/' + name + '/')));
  if (bundledTools.length) throw Error('Build-only dependencies in runtime: ' + bundledTools.join(', '));
  for (const file of files.filter(file => !file.startsWith('node_modules/'))) {
    const text = extractFile(archive, path.normalize(file)).toString();
    if (/(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(text)) {
      throw Error('Credential pattern in runtime: ' + file);
    }
  }
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(archive)) hash.update(chunk);
  const {version} = JSON.parse(extractFile(archive, 'package.json'));
  const report = {platform: process.platform, arch: process.arch, version, files: files.length, topLevel: Object.keys(header.files), sha256: hash.digest('hex'), buildOnlyDependencies: bundledTools, credentialPatterns: 0};
  if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2));
  return report;
}
