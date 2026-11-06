import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createPackageWithOptions, extractFile} from '@electron/asar';
import {auditPackage} from '../scripts/audit-package.mjs';
import {syncDraftAssets} from '../scripts/upload-release.mjs';
import {checkDraftUpload, uploadTimeoutMs} from '../scripts/release-preflight.mjs';
import {windowsProxy, releaseNetworkEnv} from '../scripts/release-network.mjs';
import {electronPackageOptions} from '../scripts/electron-cache.mjs';

test('legacy Electron cache is reused only after official checksum validation', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-cache-'));
  t.after(() => {assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));assert.ok(path.basename(temp).startsWith('folio-cache-'));fs.rmSync(temp, {recursive: true, force: true});});
  const electron = path.join(temp, 'node_modules', 'electron'), cache = path.join(temp, 'cache'), folder = path.join(cache, 'legacy-url');
  fs.mkdirSync(electron, {recursive: true});
  const filename = 'electron-v45.1.0-win32-x64.zip', payload = Buffer.from('test-only archive');
  const checksums = {[filename]: crypto.createHash('sha256').update(payload).digest('hex')};
  fs.writeFileSync(path.join(electron, 'package.json'), JSON.stringify({version: '45.1.0'}));
  fs.writeFileSync(path.join(electron, 'checksums.json'), JSON.stringify(checksums));
  assert.deepEqual((await electronPackageOptions(temp, 'win32', 'x64', cache)).download, {cacheRoot: cache, checksums});
  fs.mkdirSync(folder, {recursive: true});
  fs.writeFileSync(path.join(folder, filename), payload);
  assert.equal((await electronPackageOptions(temp, 'win32', 'x64', cache)).electronZipDir, folder);
  fs.writeFileSync(path.join(folder, filename), 'modified bytes');
  await assert.rejects(electronPackageOptions(temp, 'win32', 'x64', cache), /failed SHA-256/);
});

test('patched glob and minimatch preserve Unicode, hidden files and nested ASAR content', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-toolchain-'));
  t.after(() => {
    assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(temp).startsWith('folio-toolchain-'));
    fs.rmSync(temp, {recursive: true, force: true});
  });
  const input = path.join(temp, 'input');
  fs.mkdirSync(path.join(input, 'public', 'nested'), {recursive: true});
  fs.writeFileSync(path.join(input, 'package.json'), JSON.stringify({name: 'fixture', version: '1.0.1'}));
  const expected = new Map([['public/阅读 笔记.txt', '原文 → 理解'], ['public/.hidden', 'hidden resource'], ['public/nested/code.js', 'export const value = 42;']]);
  for (const [file, text] of expected) fs.writeFileSync(path.join(input, file), text);
  const archive = path.join(temp, 'fixture.asar');
  await createPackageWithOptions(input, archive, {dot: true});
  for (const [file, text] of expected) assert.equal(extractFile(archive, path.normalize(file)).toString(), text);
  const audit = await auditPackage(archive);
  assert.equal(audit.files, expected.size + 1);
  assert.deepEqual(audit.buildOnlyDependencies, []);
  fs.mkdirSync(path.join(input, 'node_modules', 'glob'), {recursive: true});
  fs.writeFileSync(path.join(input, 'node_modules', 'glob', 'index.js'), 'build tool');
  const unsafe = path.join(temp, 'unsafe.asar');
  await createPackageWithOptions(input, unsafe, {dot: true});
  await assert.rejects(auditPackage(unsafe), /Build-only dependencies/);
});

const local = {name: 'Folio-1.0.1-mac-arm64.dmg', size: 100, sha256: 'a'.repeat(64)};
const remote = {...local, state: 'uploaded', digest: 'sha256:' + local.sha256};
const draft = assets => ({tag_name: 'v1.0.1', draft: true, assets});
const options = {tag: 'v1.0.1', version: '1.0.1', files: [local], wait: async () => {}};

test('uploader refuses published versions before any upload', async () => {
  let uploads = 0;
  await assert.rejects(syncDraftAssets({...options, getRelease: async () => ({...draft([]), draft: false}), upload: async () => uploads++}), /published releases/);
  assert.equal(uploads, 0);
});

test('uploader skips an identical asset and refuses conflicting bytes', async () => {
  let uploads = 0;
  const upload = async () => uploads++;
  const result = await syncDraftAssets({...options, getRelease: async () => draft([remote]), upload});
  assert.equal(result.skippedBytes, 100);
  assert.equal(result.uploadedBytes, 0);
  await assert.rejects(syncDraftAssets({...options, getRelease: async () => draft([{...remote, digest: 'sha256:' + 'b'.repeat(64)}]), upload}), /No asset was overwritten/);
  assert.equal(uploads, 0);
});

test('uploader verifies a server-completed upload after connection loss without sending it twice', async () => {
  let assets = [], uploads = 0;
  const result = await syncDraftAssets({...options, getRelease: async () => draft(assets), upload: async () => {uploads++; assets = [remote]; throw Error('connection lost after upload');}});
  assert.equal(uploads, 1);
  assert.equal(result.uploadedBytes, 100);
});

test('uploader retries only missing bytes and stops after bounded failures', async () => {
  let assets = [], uploads = 0;
  await syncDraftAssets({...options, getRelease: async () => draft(assets), upload: async () => {uploads++; if (uploads === 1) throw Error('network'); assets = [remote];}});
  assert.equal(uploads, 2);
  uploads = 0;
  await assert.rejects(syncDraftAssets({...options, getRelease: async () => draft([]), upload: async () => {uploads++; throw Error('network');}}), /could not be verified/);
  assert.equal(uploads, 3);
});

const probe = {name: '_folio-upload-probe-01234567-89ab-cdef-0123-456789abcdef.bin', size: 1024 * 1024, sha256: 'c'.repeat(64)};
const probeAsset = {...probe, id: 9, state: 'uploaded', digest: 'sha256:' + probe.sha256};
test('release preflight tests the upload endpoint and cleans only its own probe', async () => {
  let assets = [remote], elapsed = 0;
  const result = await checkDraftUpload({...options, probe, now: () => elapsed, getRelease: async () => draft(assets), upload: async f => {assert.equal(f.name, probe.name);assets.push(probeAsset);elapsed = 2000;}, remove: async id => {assert.equal(id, 9);assets = assets.filter(a => a.id !== id);}});
  assert.equal(result.passed, true);assert.equal(result.bytesPerSecond, 524288);
  assert.equal(result.skippedBytes, 100);assert.equal(result.pendingBytes, 0);assert.deepEqual(assets, [remote]);
});
test('release preflight refuses conflicting real assets before probing', async () => {
  let uploads = 0;
  await assert.rejects(checkDraftUpload({...options, probe, getRelease: async () => draft([{...remote, size: 1}]), upload: async () => uploads++}), /No asset was overwritten/);
  assert.equal(uploads, 0);
});
test('release preflight cleans an incomplete probe and stops before installer transfer', async () => {
  let assets = [remote];
  await assert.rejects(checkDraftUpload({...options, probe, getRelease: async () => draft(assets), upload: async () => {assets.push({...probeAsset, state: 'starter', size: 0});throw Error('timeout');}, remove: async id => {assets = assets.filter(a => a.id !== id);}}), /channel check failed/);
  assert.deepEqual(assets, [remote]);
});
test('release preflight verifies lost DELETE responses and refuses leftover probes', async () => {
  let assets = [];
  const base = {...options, probe, getRelease: async () => draft(assets), upload: async () => {assets = [probeAsset];}};
  await checkDraftUpload({...base, remove: async () => {assets = [];throw Error('connection lost');}});
  await assert.rejects(checkDraftUpload({...base, remove: async () => {throw Error('permission denied');}}), /cleanup failed/);
});
test('upload timeout accounts for probe speed with finite bounds', () => {
  assert.equal(uploadTimeoutMs(100, 1000), 120000);
  assert.equal(uploadTimeoutMs(100000000, 1000000), 260000);
  assert.equal(uploadTimeoutMs(1000000000, 1), 900000);
});
test('a slow local probe redirects a large transfer before sending an installer', async () => {
  let assets = [], elapsed = 0;
  const result = await checkDraftUpload({...options, files: [{...local, size: 190000000}], probe, now: () => elapsed, getRelease: async () => draft(assets), upload: async f => {assert.equal(f.name, probe.name);assets = [probeAsset];elapsed = 23000;}, remove: async () => {assets = [];}});
  assert.equal(result.recommendedRoute, 'ci');assert.deepEqual(assets, []);
});
test('release routing uses an enabled Windows HTTPS proxy and rejects malformed settings', () => {
  assert.equal(windowsProxy({ProxyEnable: 1, ProxyServer: '127.0.0.1:7897'}), 'http://127.0.0.1:7897');
  assert.equal(windowsProxy({ProxyEnable: 1, ProxyServer: 'http=localhost:1234;https=localhost:5678'}), 'http://localhost:5678');
  for (const settings of [{ProxyEnable: 0, ProxyServer: 'localhost:7897'}, {ProxyEnable: 1, ProxyServer: 'socks=localhost:7897'}, {ProxyEnable: 1, ProxyServer: 'host/path'}, {ProxyEnable: 1, ProxyServer: 'user:password@host'}]) assert.equal(windowsProxy(settings), null);
});
test('release routing preserves explicit proxy configuration and never mutates the parent environment', async () => {
  const base = {HTTPS_PROXY: 'http://example.invalid:1234'};
  const explicit = await releaseNetworkEnv(base, {platform: 'win32', readSettings: () => {throw Error('Must not read system settings');}});
  assert.deepEqual(explicit.env, base);assert.equal(explicit.source, 'environment');
  const empty = {}, system = await releaseNetworkEnv(empty, {platform: 'win32', readSettings: async () => ({ProxyEnable: 1, ProxyServer: 'localhost:7897'})});
  assert.deepEqual(empty, {});assert.equal(system.source, 'windows-system-proxy');assert.equal(system.env.HTTPS_PROXY, 'http://localhost:7897');
});
