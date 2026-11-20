// Only the main process owns update sources, installer paths and the quit decision.
function createUpdateController({updater, version, reason = null, notify = () => {}, beforeInstall = async () => {}}) {
  let state = {status: reason ? 'unsupported' : 'idle', currentVersion: version, reason, version: null, progress: null, error: null};
  let checking, downloading, preparing, installing;
  const getState = () => ({...state, progress: state.progress && {...state.progress}});
  const set = patch => {state = {...state, ...patch}; notify(getState()); return getState();};
  function errorKind(error, phase) {
    if (/CHECKSUM|SIGNATURE/.test(error?.code || '')) return 'verification';
    return ({FOLIO_BUSY: 'busy', FOLIO_EDITING: 'editing', FOLIO_SAVE: 'save', FOLIO_AUTH: 'authorization', FOLIO_CANCELLED: 'cancelled'})[error?.code] || phase;
  }
  const fail = (error, phase) => set({status: 'error', progress: null, error: errorKind(error, phase)});
  if (!reason) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.disableWebInstaller = true;
    updater.on('error', error => fail(error, installing ? 'install' : downloading ? 'download' : 'check'));
    updater.on('update-available', info => set({status: 'available', version: info.version, progress: null, error: null}));
    updater.on('update-not-available', () => set({status: 'current', version: null, progress: null, error: null}));
    updater.on('download-progress', p => {
      if (state.status === 'downloading') set({progress: {percent: Math.max(0, Math.min(100, Number(p.percent) || 0)), transferred: Number(p.transferred) || 0, total: Number(p.total) || 0}});
    });
    updater.on('update-downloaded', info => set({status: 'downloaded', version: info.version, progress: null, error: null}));
  }

  function check() {
    if (reason || downloading || installing || ['downloaded', 'installing'].includes(state.status)) return Promise.resolve(getState());
    if (!checking) {
      set({status: 'checking', version: null, error: null, progress: null});
      checking = Promise.resolve().then(() => updater.checkForUpdates()).catch(e => fail(e, 'check')).then(getState).finally(() => {checking = null;});
    }
    return checking;
  }
  async function download() {
    if (checking) await checking;
    if (downloading) return downloading;
    if (reason || installing || state.status !== 'available' && !(state.status === 'error' && state.version)) return getState();
    set({status: 'downloading', error: null, progress: null});
    downloading = Promise.resolve().then(() => updater.downloadUpdate()).catch(e => fail(e, 'download')).then(getState).finally(() => {downloading = null;});
    return downloading;
  }
  function prepare() {
    if (reason || installing || ['downloaded', 'installing'].includes(state.status)) return Promise.resolve(getState());
    if (!preparing) {
      preparing = (async () => {
        if (checking) await checking;
        else if (!downloading && state.status !== 'available' && !(state.status === 'error' && state.version)) await check();
        if (state.status === 'available' || downloading || state.status === 'error' && state.version) await download();
        return getState();
      })().finally(() => {preparing = null;});
    }
    return preparing;
  }
  async function install(restart = true) {
    if (preparing) await preparing;
    if (installing) return installing;
    if (reason || state.status !== 'downloaded') return getState();
    installing = Promise.resolve().then(async () => {
      await beforeInstall();
      set({status: 'installing', error: null});
      await updater.quitAndInstall(true, restart);
    }).catch(error => {
      const kind = errorKind(error, 'install');
      set({status: kind === 'verification' ? 'error' : 'downloaded', error: kind});
    }).then(getState).finally(() => {installing = null;});
    return installing;
  }
  return {getState, check, download, prepare, install,
    shouldWaitOnQuit: () => Boolean(preparing || downloading || installing || ['downloaded', 'installing'].includes(state.status)),
    waitForPreparation: () => preparing || downloading || Promise.resolve(getState())};
}

function installUpdates({app, ipcMain, window, authorized, busy = () => false}) {
  const fs = require('node:fs'), path = require('node:path');
  const {platform, arch, execPath} = process;
  let reason = null, updater, passingQuit = false, closing = false;
  if (!app.isPackaged) reason = 'development';
  else if (platform === 'win32' && arch === 'x64') {
    if (fs.existsSync(path.join(path.dirname(execPath), 'Uninstall Folio.exe'))) updater = require('electron-updater').autoUpdater;
    else reason = 'uninstalled';
  } else if (platform === 'darwin' && ['x64', 'arm64'].includes(arch) || platform === 'linux' && arch === 'x64') {
    const {unixInstallLocation, UnixUpdater} = require('./unix-updater.cjs');
    const location = unixInstallLocation(platform, execPath);
    if (!location) reason = 'uninstalled';
    else updater = new UnixUpdater({platform, arch, location, version: app.getVersion(), fetch: require('electron').net.fetch,
      temp: app.getPath('temp'), quit: () => {passingQuit = true; app.quit();}});
  } else reason = 'platform';
  const controller = createUpdateController({updater, version: app.getVersion(), reason,
    notify: state => {
      if (!window.isDestroyed()) window.webContents.send('folio:update-state', state);
      if (state.error) passingQuit = false;
    },
    beforeInstall: async () => {
      const guard = code => {throw Object.assign(Error(code), {code});};
      if (busy()) guard('FOLIO_BUSY');
      const saved = await window.webContents.executeJavaScript('window.folioPrepareForUpdate?.()').catch(() => 'save');
      if (saved !== 'saved') guard(saved === 'editing' ? 'FOLIO_EDITING' : 'FOLIO_SAVE');
      await window.webContents.session.cookies.flushStore();
      window.webContents.session.flushStorageData();
      if (busy()) guard('FOLIO_BUSY');
      if (platform === 'win32') passingQuit = true;
    },
  });
  // Both the window close button and the application Quit command get here.
  function onQuit(event) {
    if (passingQuit || !controller.shouldWaitOnQuit()) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    (async () => {
      const ready = await controller.waitForPreparation();
      if (ready.status === 'downloaded' || ready.status === 'installing') await controller.install(false);
      else if (ready.status === 'current') {passingQuit = true; app.quit();}
    })().catch(error => console.warn('Could not finish updating:', error.code || error.name)).finally(() => {closing = false;});
  }
  const actions = {state: controller.getState, prepare: controller.prepare, check: controller.check, download: controller.download, install: () => controller.install(false)};
  for (const [name, handler] of Object.entries(actions)) {
    ipcMain.handle('folio:update-' + name, event => {
      if (!authorized(event)) throw Error('Invalid update request origin.');
      return handler();
    });
  }
  if (!reason) {
    window.on('close', onQuit);
    app.on('before-quit', onQuit);
    const first = setTimeout(() => void controller.check(), 15000);
    const periodic = setInterval(() => void controller.check(), 6 * 60 * 60 * 1000);
    first.unref(); periodic.unref();
    app.once('will-quit', () => {clearTimeout(first); clearInterval(periodic); updater.dispose?.();});
  }
  return controller;
}
module.exports = {createUpdateController, installUpdates};
