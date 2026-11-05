import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';

function assertDraft(release, tag) {
  if (release.tag_name !== tag || release.draft !== true) throw Error('Uploads require an existing draft for ' + tag + '; published releases are never modified.');
}

function assetState(release, file) {
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
  const {values, positionals} = parseArgs({options: {tag: {type: 'string'}, repo: {type: 'string'}}, allowPositionals: true});
  const {version} = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const tag = values.tag || process.env.FOLIO_RELEASE_TAG;
  const repo = values.repo || process.env.GITHUB_REPOSITORY;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || tag !== 'v' + version) throw Error('Set --repo owner/repo and --tag matching package.json.');
  const run = promisify(execFile);
  const gh = async args => (await run('gh', args, {windowsHide: true, maxBuffer: 4 * 1024 * 1024})).stdout;
  const getRelease = async () => JSON.parse(await gh(['api', 'repos/' + repo + '/releases/tags/' + encodeURIComponent(tag)]));
  assertDraft(await getRelease(), tag);
  const permitted = new Set([`Folio-Setup-${version}-win-x64.exe`, `Folio-Setup-${version}-win-x64.zip`, `Folio-${version}-mac-arm64.dmg`, `Folio-${version}-mac-x64.dmg`, `Folio-${version}-linux-x64.deb`]);
  const paths = positionals.length ? positionals : fs.readdirSync('releases').filter(name => permitted.has(name)).map(name => path.join('releases', name));
  if (!paths.length) throw Error('No versioned installers found.');
  const files = [];
  for (const file of paths) {
    const name = path.basename(file);
    if (!permitted.has(name) || fs.lstatSync(file).isSymbolicLink()) throw Error('Unexpected release file: ' + name);
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    files.push({name, path: path.resolve(file), size: fs.statSync(file).size, sha256: hash.digest('hex')});
  }
  const started = performance.now();
  const result = await syncDraftAssets({tag, version, files, getRelease, upload: file => gh(['release', 'upload', tag, file.path, '--repo', repo])});
  result.seconds = Number(((performance.now() - started) / 1000).toFixed(2));
  const out = path.join('dist', 'v' + version);
  fs.mkdirSync(out, {recursive: true});
  fs.writeFileSync(path.join(out, 'release-upload.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
