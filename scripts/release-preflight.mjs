import {assertDraft, assetState, syncDraftAssets} from './upload-release.mjs';

// A bounded transfer on the same endpoint catches auth, connectivity and stalled
// upload failures before sending an installer. Every invocation owns one unique probe.
export async function checkDraftUpload({tag, version, files, probe, getRelease, upload, remove, now = () => performance.now(), wait}) {
  if (!/^_folio-upload-probe-[a-f0-9-]{36}\.bin$/.test(probe.name)) throw Error('Invalid upload probe name.');
  const release = await getRelease();
  assertDraft(release, tag);
  if (release.assets.some(a => a.name === probe.name)) throw Error('Probe already exists; refusing to modify it.');
  let pendingBytes = 0, skippedBytes = 0;
  for (const file of files) {
    if (assetState(release, file) === 'same') skippedBytes += file.size;
    else pendingBytes += file.size;
  }
  const started = now();
  let result, failure;
  try {
    await syncDraftAssets({tag, version, files: [probe], getRelease, upload, wait});
    const seconds = Math.max(.001, (now() - started) / 1000);
    result = {passed: true, pendingBytes, skippedBytes, probeBytes: probe.size, probeSeconds: Number(seconds.toFixed(2)), bytesPerSecond: Math.round(probe.size / seconds)};
  } catch (error) {failure = error;}
  // Even a failed transfer can leave a starter asset. Only this invocation's
  // unguessable probe is eligible for cleanup, never a release binary.
  try {
    const current = await getRelease();
    assertDraft(current, tag);
    const asset = current.assets.find(a => a.name === probe.name);
    if (asset) {
      if (!Number.isSafeInteger(asset.id)) throw Error('Invalid probe asset ID.');
      try {await remove(asset.id);} catch (error) {
        // A lost DELETE response may already have removed the probe.
        const verified = await getRelease();assertDraft(verified, tag);
        if (verified.assets.some(a => a.name === probe.name)) throw error;
      }
      const verified = await getRelease();assertDraft(verified, tag);
      if (verified.assets.some(a => a.name === probe.name)) throw Error('Probe still exists.');
    }
  } catch (error) {throw Error('Upload check cleanup failed for ' + probe.name + '; resolve this draft probe before publishing.', {cause: error});}
  if (failure) throw Error('Upload channel check failed before installer transfer.', {cause: failure});
  return result;
}

export function uploadTimeoutMs(bytes, bytesPerSecond) {
  // The small probe includes API overhead; allow twice that rate's duration plus
  // a minute, bounded to 2–15 minutes so a stuck process cannot hang a release.
  return Math.min(900000, Math.max(120000, Math.ceil(bytes / Math.max(1, bytesPerSecond) * 2000 + 60000)));
}
