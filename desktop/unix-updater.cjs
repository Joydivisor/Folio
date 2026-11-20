const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {EventEmitter} = require('node:events');
const {spawn} = require('node:child_process');
const {Readable, Transform} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const releaseRoot = 'https://github.com/Joydivisor/Folio/releases/download/';
const manifestUrl = 'https://getfolio.pages.dev/release.json';
const rawPublicKey = require('./update-public-key.json');

function publicKey(raw = rawPublicKey) {
  return crypto.createPublicKey({key: {kty: 'OKP', crv: 'Ed25519', x: Buffer.from(raw, 'base64').toString('base64url')}, format: 'jwk'});
}
function debStatement(version, size, sha256) {
  return Buffer.from(['Folio Debian amd64', version, String(size), sha256, ''].join('\n'));
}
function unixInstallLocation(platform, executable) {
  if (platform === 'linux') return executable === '/opt/Folio/Folio' ? '/opt/Folio' : null;
  if (platform !== 'darwin' || !executable.endsWith('.app/Contents/MacOS/Folio') || executable.startsWith('/Volumes/') || executable.includes('/AppTranslocation/')) return null;
  return path.posix.resolve(executable, '../../..');
}
function nativeRun(file, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe']});
    let stderr = '';
    child.stderr.on('data', s => {stderr = (stderr + s).slice(-2500);});
    if (input) {
      // The privilege prompt may be cancelled before it starts reading the package.
      pipeline(fs.createReadStream(input), child.stdin).catch(() => {});
    }
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(Object.assign(Error(stderr || 'Installer exited ' + code), {code})));
  });
}
class UnixUpdater extends EventEmitter {
  constructor({platform, arch, version, location, temp, fetch, quit, run = nativeRun}) {
    super();
    Object.assign(this, {platform, arch, version, location, temp, fetch, quit, run});
  }
  async checkForUpdates() {
    const {compareVersions, validateRelease} = await import('../public/release-info.js');
    const response = await this.fetch(manifestUrl, {cache: 'no-store', signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw Error('Cannot read release');
    const release = validateRelease(await response.json());
    if (!/^\d+\.\d+\.\d+$/.test(release.version) || compareVersions(release.version, this.version) <= 0) {
      this.latest = null; this.emit('update-not-available'); return;
    }
    const id = this.platform === 'darwin' ? 'mac-' + this.arch : 'linux-x64';
    const base = releaseRoot + 'v' + release.version + '/';
    const suffix = id + (this.platform === 'darwin' ? '.dmg' : '.deb');
    const file = release.downloads.find(d => d.id === id);
    if (!file || file.url !== base + 'Folio-' + release.version + '-' + suffix || file.sizeBytes > 1024 ** 3) throw Error('Invalid platform download');
    this.latest = {...file, version: release.version, base};
    this.emit('update-available', this.latest);
  }
  async downloadUpdate() {
    const target = this.latest;
    if (!target) throw Error('No selected update');
    if (this.platform === 'darwin') {
      const cli = path.join(this.location, 'Contents/Helpers/Folio Update.app/Contents/MacOS/sparkle');
      try {
        await this.run(cli, [this.location, '--check-immediately', '--defer-install', '--interactive', '--feed-url', target.base + 'appcast-mac-' + this.arch + '.xml', '--user-agent-name', 'Folio']);
      } catch (error) {
        if (error.code === 5) error.code = 'FOLIO_CANCELLED';
        else if ([3, 8].includes(error.code)) error.code = 'FOLIO_AUTH';
        throw error;
      }
    } else {
      this.dispose();
      const sigResponse = await this.fetch(target.url + '.sig', {signal: AbortSignal.timeout(20000)});
      if (!sigResponse.ok) throw Error('Cannot read update signature');
      const signature = (await sigResponse.text()).trim();
      if (!/^[A-Za-z0-9+/]{86}==$/.test(signature) || !crypto.verify(null, debStatement(target.version, target.sizeBytes, target.sha256), publicKey(), Buffer.from(signature, 'base64'))) {
        throw Object.assign(Error('Invalid update signature'), {code: 'SIGNATURE'});
      }
      this.directory = fs.mkdtempSync(path.join(this.temp, 'folio-update-'));
      this.file = path.join(this.directory, 'folio.deb');
      try {
        const response = await this.fetch(target.url, {signal: AbortSignal.timeout(15 * 60000)});
        if (!response.ok || !response.body) throw Error('Cannot download update');
        let transferred = 0, last = 0;
        const hash = crypto.createHash('sha256');
        const meter = new Transform({transform: (chunk, _, done) => {
          transferred += chunk.length;
          if (transferred > target.sizeBytes) return done(Object.assign(Error('Excess update bytes'), {code: 'CHECKSUM'}));
          hash.update(chunk);
          if (Date.now() - last > 150 || transferred === target.sizeBytes) {
            this.emit('download-progress', {transferred, total: target.sizeBytes, percent: 100 * transferred / target.sizeBytes}); last = Date.now();
          }
          done(null, chunk);
        }});
        await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(this.file, {flags: 'wx', mode: 0o600}));
        if (transferred !== target.sizeBytes || hash.digest('hex') !== target.sha256) throw Object.assign(Error('Invalid update file'), {code: 'CHECKSUM'});
        this.signature = signature;
      } catch (error) {this.dispose(); throw error;}
    }
    this.emit('update-downloaded', target);
  }
  async quitAndInstall() {
    if (this.platform === 'linux') {
      const t = this.latest;
      try {
        await this.run('/usr/bin/pkexec', ['--disable-internal-agent', '/usr/lib/folio/install-update', t.version, String(t.sizeBytes), t.sha256, this.signature], this.file);
      } catch (error) {
        if (error.code === 126) error.code = 'FOLIO_CANCELLED';
        else if (error.code === 127) error.code = 'FOLIO_AUTH';
        else if (error.code === 65) error.code = 'SIGNATURE';
        throw error;
      }
    }
    this.quit();
  }
  dispose() {
    if (this.directory) fs.rmSync(this.directory, {recursive: true, force: true});
    this.directory = this.file = this.signature = null;
  }
}
module.exports = {UnixUpdater, unixInstallLocation, debStatement, publicKey};
