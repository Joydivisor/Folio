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
