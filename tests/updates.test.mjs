import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const {createUpdateController} = createRequire(import.meta.url)('../desktop/updates.cjs');

function fixture(options = {}) {
  const updater = new EventEmitter(), notifications = [];
  const counts = {checks: 0, downloads: 0, installs: 0};
  updater.checkForUpdates = async () => {counts.checks++; updater.emit('update-available', {version: '1.0.3'});};
  updater.downloadUpdate = async () => {counts.downloads++; updater.emit('download-progress', {percent: 65, transferred: 650, total: 1000}); updater.emit('update-downloaded', {version: '1.0.3'});};
  updater.quitAndInstall = (silent, restart) => {assert.equal(silent, true); assert.equal(restart, true); counts.installs++;};
  const controller = createUpdateController({updater, version: '1.0.2', notify: value => notifications.push(value), ...options});
  return {updater, controller, counts, notifications};
}

test('checks never download or install without an explicit action; newer update survives repeated checks', async () => {
  const {updater, controller, counts, notifications} = fixture();
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowDowngrade, false);
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.disableWebInstaller, true);
  await controller.install(); await controller.download();
  assert.deepEqual(counts, {checks: 0, downloads: 0, installs: 0});
  await Promise.all([controller.check(), controller.check()]);
  assert.equal(controller.getState().status, 'available');
  assert.deepEqual(counts, {checks: 1, downloads: 0, installs: 0});
  await Promise.all([controller.download(), controller.download()]);
  assert.equal(controller.getState().status, 'downloaded');
  assert.equal(notifications.find(row => row.progress?.percent === 65).progress.total, 1000);
  await controller.check();
  assert.deepEqual(counts, {checks: 1, downloads: 1, installs: 0});
  await controller.install();
  assert.equal(counts.installs, 1);
});

test('failed and corrupt downloads can retry and never enable installation', async () => {
  const {updater, controller, counts} = fixture();
  const download = updater.downloadUpdate;
  await controller.check();
  updater.downloadUpdate = async () => {const error = Object.assign(new Error('corrupt'), {code: 'ERR_UPDATER_CHECKSUM_MISMATCH'}); updater.emit('error', error); throw error;};
  await controller.download(); await controller.install();
  assert.equal(controller.getState().error, 'verification'); assert.equal(counts.installs, 0);
  updater.downloadUpdate = download;
  await controller.download();
  assert.equal(controller.getState().status, 'downloaded');
});

test('offline checks recover and current versions do not offer downloads', async () => {
  const {updater, controller, counts} = fixture();
  updater.checkForUpdates = async () => {throw Error('offline');};
  await controller.check();
  assert.equal(controller.getState().error, 'check');
  updater.checkForUpdates = async () => updater.emit('update-not-available', {version: '1.0.2'});
  await controller.check(); await controller.download();
  assert.equal(controller.getState().status, 'current'); assert.equal(counts.downloads, 0);
});

test('background checks cannot interrupt a download or discard its progress', async () => {
  const {updater, controller, counts} = fixture();
  await controller.check();
  let finish;
  updater.downloadUpdate = () => new Promise(resolve => {finish = resolve;});
  const downloading = controller.download();
  await new Promise(resolve => setImmediate(resolve));
  await controller.check();
  assert.equal(controller.getState().status, 'downloading'); assert.equal(counts.checks, 1);
  updater.emit('update-downloaded', {version: '1.0.3'}); finish(); await downloading;
});

test('busy or unflushed data prevents restart and a later retry installs only once', async () => {
  let blocked = true;
  const {controller, counts} = fixture({beforeInstall: async () => {if (blocked) throw Object.assign(Error('busy'), {code: 'FOLIO_BUSY'});}});
  await controller.check(); await controller.download(); await controller.install();
  assert.equal(controller.getState().status, 'downloaded'); assert.equal(controller.getState().error, 'busy'); assert.equal(counts.installs, 0);
  blocked = false;
  await Promise.all([controller.install(), controller.install()]);
  assert.equal(counts.installs, 1);
});

test('unsupported platforms and unpacked apps never contact the feed or launch an installer', async () => {
  for (const reason of ['platform', 'development', 'uninstalled']) {
    const {controller, counts} = fixture({reason});
    await controller.check(); await controller.download(); await controller.install();
    assert.equal(controller.getState().status, 'unsupported');
    assert.deepEqual(counts, {checks: 0, downloads: 0, installs: 0});
  }
});
