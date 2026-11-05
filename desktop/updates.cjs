// Only the main process owns the feed, downloaded files and installer invocation.
function createUpdateController({updater, version, reason = null, notify = () => {}, beforeInstall = async () => {}}) {
  let state = {status: reason ? 'unsupported' : 'idle', currentVersion: version, reason, version: null, progress: null, error: null};
  let checking, downloading, installing;
  const getState = () => structuredClone(state);
  const set = patch => {state = {...state, ...patch}; notify(getState()); return getState();};
  const fail = (error, phase) => set({status: 'error', progress: null, error: /CHECKSUM|SIGNATURE/.test(error?.code || '') ? 'verification' : phase});
  if (!reason) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.disableWebInstaller = true;
    updater.on('error', error => fail(error, state.status === 'installing' ? 'install' : downloading ? 'download' : 'check'));
    updater.on('update-available', info => set({status: 'available', version: info.version, progress: null, error: null}));
    updater.on('update-not-available', () => set({status: 'current', version: null, progress: null, error: null}));
    updater.on('download-progress', progress => {
      if (state.status !== 'downloading') return;
      set({progress: {percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)), transferred: Math.max(0, Number(progress.transferred) || 0), total: Math.max(0, Number(progress.total) || 0)}});
    });
    updater.on('update-downloaded', info => set({status: 'downloaded', version: info.version, progress: null, error: null}));
  }
  return {
    getState,
    async check() {
      if (reason || downloading || installing || state.status === 'downloaded') return getState();
      if (checking) return checking;
      set({status: 'checking', version: null, error: null, progress: null});
      checking = Promise.resolve().then(() => updater.checkForUpdates()).catch(error => fail(error, 'check')).then(getState).finally(() => {checking = null;});
      return checking;
    },
    async download() {
      if (downloading) return downloading;
      if (reason || installing || checking || !(state.status === 'available' || (state.status === 'error' && ['download', 'verification'].includes(state.error) && state.version))) return getState();
      set({status: 'downloading', error: null, progress: {percent: 0, transferred: 0, total: 0}});
      downloading = Promise.resolve().then(() => updater.downloadUpdate()).catch(error => fail(error, 'download')).then(getState).finally(() => {downloading = null;});
      return downloading;
    },
    async install() {
      if (reason || installing || state.status !== 'downloaded') return getState();
      installing = true;
      try {
        // A failed flush leaves the downloaded update available for a later retry.
        await beforeInstall();
        set({status: 'installing', error: null});
        updater.quitAndInstall(true, true);
      } catch (error) {
        set({status: 'downloaded', error: error?.code === 'FOLIO_BUSY' ? 'busy' : 'install'});
      } finally { installing = false; }
      return getState();
    },
  };
}

function installUpdates({app, ipcMain, window, authorized, busy = () => false}) {
  const fs = require('node:fs'), path = require('node:path');
  const reason = process.platform !== 'win32' ? 'platform' : !app.isPackaged ? 'development'
    : !fs.existsSync(path.join(path.dirname(process.execPath), 'Uninstall Folio.exe')) ? 'uninstalled' : null;
  const updater = reason ? null : require('electron-updater').autoUpdater;
  const controller = createUpdateController({updater, version: app.getVersion(), reason,
    notify: state => {if (!window.isDestroyed()) window.webContents.send('folio:update-state', state);},
    beforeInstall: async () => {
      if (busy()) {const error = new Error('Wait for the current request to finish.'); error.code = 'FOLIO_BUSY'; throw error;}
      await window.webContents.session.cookies.flushStore();
      window.webContents.session.flushStorageData();
    },
  });
  for (const [action, handler] of Object.entries({state: controller.getState, check: controller.check, download: controller.download, install: controller.install})) {
    ipcMain.handle('folio:update-' + action, event => {
      if (!authorized(event)) throw new Error('Invalid update request origin.');
      return handler();
    });
  }
  if (!reason) {
    const first = setTimeout(() => void controller.check(), 15000);
    const periodic = setInterval(() => void controller.check(), 6 * 60 * 60 * 1000);
    first.unref(); periodic.unref();
    app.once('before-quit', () => {clearTimeout(first); clearInterval(periodic);});
  }
  return controller;
}

module.exports = {createUpdateController, installUpdates};
