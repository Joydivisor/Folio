import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import unix from '../desktop/unix-updater.cjs';

export function signUpdate({version, id, bytes, key, base}) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !['mac-arm64','mac-x64','linux-x64'].includes(id)) throw Error('Invalid release target');
  const ext = id === 'linux-x64' ? 'deb' : 'dmg', filename = 'Folio-' + version + '-' + id + '.' + ext;
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const payload = id === 'linux-x64' ? unix.debStatement(version, bytes.length, sha256) : bytes;
  const signature = crypto.sign(null, payload, key).toString('base64');
  if (id === 'linux-x64') return {name: filename + '.sig', content: signature + '\n'};
  const url = new URL(filename, base).href.replaceAll('&','&amp;').replaceAll('"','&quot;');
  return {name: 'appcast-' + id + '.xml', content: [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>Folio</title><item>',
    '<title>Folio ' + version + '</title><sparkle:version>' + version + '</sparkle:version><sparkle:shortVersionString>' + version + '</sparkle:shortVersionString>',
    '<enclosure type="application/octet-stream" url="' + url + '" length="' + bytes.length + '" sparkle:edSignature="' + signature + '"/>',
    '</item></channel></rss>', ''].join('\n')};
}

// The official release signer takes the encrypted-at-rest publisher key via stdin.
// The input directory must contain the three CI-built assets and their GitHub metadata.
async function main() {
  const version = JSON.parse(fs.readFileSync('package.json')).version;
  const [directory, metadataPath] = process.argv.slice(2);
  const remote = JSON.parse(fs.readFileSync(metadataPath));
  const api = 'https://api.github.com/repos/Joydivisor/Folio/releases/';
  if (remote.tag_name !== 'v' + version || remote.draft !== true || remote.url !== api + remote.id) throw Error('Expected current Folio release draft');
  const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
  const key = crypto.createPrivateKey({key: Buffer.from(Buffer.concat(chunks).toString().trim(), 'base64'), type: 'pkcs8', format: 'der'});
  if (!crypto.createPublicKey(key).equals(unix.publicKey())) throw Error('Signing key does not match the installed public key');
  const base = 'https://github.com/Joydivisor/Folio/releases/download/v' + version + '/';
  // Before publication GitHub serves draft assets under its temporary untagged URL.
  const draftTag = new URL(remote.html_url).pathname.split('/').pop();
  const draftBase = /^untagged-[0-9a-f]+$/.test(draftTag) ? 'https://github.com/Joydivisor/Folio/releases/download/' + draftTag + '/' : base;
  for (const id of ['mac-arm64','mac-x64','linux-x64']) {
    const filename = 'Folio-' + version + '-' + id + (id === 'linux-x64' ? '.deb' : '.dmg');
    const bytes = fs.readFileSync(path.join(directory, filename));
    const asset = remote.assets.find(a => a.name === filename);
    if (!asset || asset.state !== 'uploaded' || asset.url !== api+'assets/'+asset.id || ![base+filename,draftBase+filename].includes(asset.browser_download_url) || asset.size !== bytes.length || asset.digest !== 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex')) throw Error('Draft bytes do not match: ' + filename);
    const signed = signUpdate({version, id, bytes, key, base});
    fs.writeFileSync(path.join(directory, signed.name), signed.content);
    console.log('Signed ' + filename);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
