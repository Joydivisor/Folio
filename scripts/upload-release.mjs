import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';

import {assertDraft, assetState, syncDraftAssets} from './release-assets.mjs';
export {syncDraftAssets} from './release-assets.mjs';
import {checkDraftUpload, uploadTimeoutMs} from './release-preflight.mjs';
import {releaseNetworkEnv} from './release-network.mjs';

async function main() {
  const {values, positionals} = parseArgs({options: {tag: {type: 'string'}, repo: {type: 'string'}, check: {type: 'boolean'}}, allowPositionals: true});
  const {version} = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const tag = values.tag || process.env.FOLIO_RELEASE_TAG;
  const repo = values.repo || process.env.GITHUB_REPOSITORY;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || tag !== 'v' + version) throw Error('Set --repo owner/repo and --tag matching package.json.');
  const run = promisify(execFile);
  const network = await releaseNetworkEnv();
  const log = text => console.log(new Date().toISOString() + ' ' + text);
  log('Release network route: ' + network.source);
  const gh = async (args, {timeout = 25000, retryRead = false, label} = {}) => {
    for (let attempt = 1; attempt <= (retryRead ? 3 : 1); attempt++) {
      const started = Date.now();
      const heartbeat = label ? setInterval(() => log(label + ': still transferring (' + Math.round((Date.now() - started) / 1000) + 's elapsed; limit ' + Math.round(timeout / 1000) + 's)'), 10000) : null;
      try { return (await run('gh', args, {env: network.env, windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024})).stdout; }
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
    fs.writeFileSync(preflightPath, JSON.stringify({checkedAt: new Date().toISOString(), repo, tag, networkSource: network.source, ...preflight}, null, 2));
  } catch (error) {
    fs.writeFileSync(preflightPath, JSON.stringify({checkedAt: new Date().toISOString(), repo, tag, passed: false, error: error.message, cause: error.cause?.message}, null, 2));
    throw error;
  } finally {fs.unlinkSync(probePath);}
  log('Upload check passed: ' + preflight.probeSeconds + 's for 1 MiB, ' + preflight.pendingBytes + ' bytes pending; probe removed.');
  if (preflight.recommendedRoute === 'ci') log('Slow channel: use the release workflows to build and upload on GitHub runners.');
  if (values.check) return;
  if (preflight.recommendedRoute === 'ci') throw Error('Upload preflight detected a slow channel; no installer was sent. Use windows-release.yml / unix-release.yml with this release_tag, or resolve the connection and rerun the check.');
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
