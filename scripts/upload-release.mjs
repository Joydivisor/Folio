import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';

export function assertDraft(release, tag) {
  if (release.tag_name !== tag || release.draft !== true) throw Error('Uploads require an existing draft for ' + tag + '; published releases are never modified.');
}

export function assetState(release, file) {
  const asset = release.assets.find(asset => asset.name === file.name);
  if (!asset) return 'missing';
  if (asset.state === 'uploaded' && asset.size === file.size && asset.digest === 'sha256:' + file.sha256) return 'same';
  throw Error('Existing draft asset differs or is incomplete: ' + file.name + '. No asset was overwritten.');
}

// Re-read metadata after an interrupted upload: the server may already have the file.
export async function syncDraftAssets({tag, version, files, getRelease, upload, wait = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  if (tag !== 'v' + version) throw Error('Release tag must match package.json version.');
  assertDraft(await getRelease(), tag);
  const results = [];
  for (const file of files) {
    if (!file.name || !Number.isSafeInteger(file.size) || file.size < 1 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error('Invalid local release asset.');
    let attempted = false, lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      const release = await getRelease();
      assertDraft(release, tag);
      if (assetState(release, file) === 'same') {
        results.push({name: file.name, bytes: file.size, sha256: file.sha256, status: attempted ? 'uploaded' : 'skipped'});
        break;
      }
      attempted = true;
      try { await upload(file); } catch (error) { lastError = error; }
      const verified = await getRelease();
      assertDraft(verified, tag);
      if (assetState(verified, file) === 'same') {
        results.push({name: file.name, bytes: file.size, sha256: file.sha256, status: 'uploaded'});
        break;
      }
      if (attempt === 2) throw Error('Upload could not be verified: ' + file.name, {cause: lastError});
      await wait(1000 * 2 ** attempt);
    }
  }
  return {files: results, uploadedBytes: results.filter(f => f.status === 'uploaded').reduce((sum, f) => sum + f.bytes, 0), skippedBytes: results.filter(f => f.status === 'skipped').reduce((sum, f) => sum + f.bytes, 0)};
}

async function main() {
  const {values, positionals} = parseArgs({options: {tag: {type: 'string'}, repo: {type: 'string'}, check: {type: 'boolean'}}, allowPositionals: true});
  const {version} = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const tag = values.tag || process.env.FOLIO_RELEASE_TAG;
  const repo = values.repo || process.env.GITHUB_REPOSITORY;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || tag !== 'v' + version) throw Error('Set --repo owner/repo and --tag matching package.json.');
  const run = promisify(execFile);
  const {checkDraftUpload, uploadTimeoutMs} = await import('./release-preflight.mjs');
  const log = text => console.log(new Date().toISOString() + ' ' + text);
  const gh = async (args, {timeout = 25000, retryRead = false, label} = {}) => {
    for (let attempt = 1; attempt <= (retryRead ? 3 : 1); attempt++) {
      const started = Date.now();
      const heartbeat = label ? setInterval(() => log(label + ': still transferring (' + Math.round((Date.now() - started) / 1000) + 's elapsed; limit ' + Math.round(timeout / 1000) + 's)'), 10000) : null;
      try { return (await run('gh', args, {windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024})).stdout; }
      catch (error) {
        const transient = error.killed || /connection|timed? ?out|timeout|TLS|EOF|HTTP 50[234]|HTTP 429|temporary|network/i.test(error.stderr || error.message);
        if (!retryRead || attempt === 3 || !transient) throw error;
        log('Metadata connection interrupted; retry ' + (attempt + 1) + '/3.');
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      } finally {clearInterval(heartbeat);}
    }
  };
  // An unpublished draft can exist before its Git tag. Resolve its ID through
  // gh's draft-aware lookup instead of the public releases/tags endpoint.
  const releaseId = (await gh(['release', 'view', tag, '--repo', repo, '--json', 'databaseId', '--jq', '.databaseId'], {retryRead: true})).trim();
  if (!/^\d+$/.test(releaseId)) throw Error('Could not resolve the release draft.');
  const getRelease = async () => JSON.parse(await gh(['api', 'repos/' + repo + '/releases/' + releaseId], {retryRead: true}));
  assertDraft(await getRelease(), tag);
  const installers = new Set([`Folio-Setup-${version}-win-x64.exe`, `Folio-Setup-${version}-win-x64.zip`, `Folio-${version}-mac-arm64.dmg`, `Folio-${version}-mac-x64.dmg`, `Folio-${version}-linux-x64.deb`]);
  const permitted = new Set([...installers, `Folio-Setup-${version}-win-x64.exe.blockmap`, 'latest.yml', 'SHA256SUMS.txt']);
  const versioned = path.join('releases', 'v' + version);
  const paths = positionals.length ? positionals : [
    ...(fs.existsSync(versioned) ? fs.readdirSync(versioned).filter(name => permitted.has(name) && name !== 'SHA256SUMS.txt').map(name => path.join(versioned, name)) : []),
    ...fs.readdirSync('releases').filter(name => installers.has(name)).map(name => path.join('releases', name)),
  ];
  if (!paths.length) throw Error('No versioned installers found.');
  const files = [];
  for (const file of paths) {
    const name = path.basename(file);
    if (!permitted.has(name) || !fs.lstatSync(file).isFile()) throw Error('Unexpected release file: ' + name);
    if (files.some(f => f.name === name)) throw Error('Duplicate release filename: ' + name);
    if (name === 'latest.yml' && !fs.readFileSync(file, 'utf8').split(/\r?\n/).includes('version: ' + version)) throw Error('Update manifest version does not match this release.');
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    files.push({name, path: path.resolve(file), size: fs.statSync(file).size, sha256: hash.digest('hex')});
  }
  const out = path.join('dist', 'v' + version);
  fs.mkdirSync(out, {recursive: true});
  const probePath = path.resolve(out, '_folio-upload-probe-' + crypto.randomUUID() + '.bin');
  fs.writeFileSync(probePath, crypto.randomBytes(1024 * 1024), {flag: 'wx'});
  const probe = {name: path.basename(probePath), path: probePath, size: fs.statSync(probePath).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(probePath)).digest('hex')};
  const preflightPath = path.join(out, 'release-preflight.json');
  let preflight;
  try {
    log('Checking draft, local hashes and the actual upload endpoint (1 MiB temporary probe).');
    preflight = await checkDraftUpload({tag, version, files, probe, getRelease,
      upload: file => gh(['release', 'upload', tag, file.path, '--repo', repo], {timeout: 60000, label: 'Channel probe'}),
      remove: id => gh(['api', '--method', 'DELETE', 'repos/' + repo + '/releases/assets/' + id])});
    fs.writeFileSync(preflightPath, JSON.stringify({checkedAt: new Date().toISOString(), repo, tag, ...preflight}, null, 2));
  } catch (error) {
    fs.writeFileSync(preflightPath, JSON.stringify({checkedAt: new Date().toISOString(), repo, tag, passed: false, error: error.message, cause: error.cause?.message}, null, 2));
    throw error;
  } finally {fs.unlinkSync(probePath);}
  log('Upload check passed: ' + preflight.probeSeconds + 's for 1 MiB, ' + preflight.pendingBytes + ' bytes pending; probe removed.');
  if (values.check) return;
  const started = performance.now();
  const result = await syncDraftAssets({tag, version, files, getRelease, upload: async file => {
    log('Uploading ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MiB).');
    await gh(['release', 'upload', tag, file.path, '--repo', repo], {timeout: uploadTimeoutMs(file.size, preflight.bytesPerSecond), label: file.name});
    log('Transfer finished; verifying ' + file.name + '.');
  }});
  result.seconds = Number(((performance.now() - started) / 1000).toFixed(2));
  result.preflight = preflight;
  fs.writeFileSync(path.join(out, 'release-upload.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
