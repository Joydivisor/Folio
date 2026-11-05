import {ui, node, button, modal} from './workspace-ui.js';
import {isNewerRelease, validateRelease} from './release-info.js';

export function setupUpdates({beforeRestart = async () => {}} = {}) {
  const desktop = window.folioDesktop;
  let state, view, dismissed, dialogRoot;
  const banner = node('aside', undefined, {className: 'update-banner', hidden: true});
  banner.setAttribute('aria-label', ui('软件更新', 'Software update'));
  document.body.append(banner);
  const errors = {
    check: ['暂时无法检查更新，请检查网络后重试。', 'Could not check for updates. Check your connection and try again.'],
    download: ['下载未完成，可以重试。', 'The download did not finish. You can retry.'],
    verification: ['更新文件校验失败，请重新下载。', 'The update could not be verified. Download it again.'],
    install: ['暂时无法开始安装，请重试。', 'Could not start the installation. Please retry.'],
    busy: ['请等待当前 AI 请求完成，或停止生成后再更新。', 'Wait for the current AI request to finish, or stop it before updating.'],
  };
  function receive(next) {
    state = next;
    if (view) render();
    const key = state.version + ':' + state.status;
    const visible = ['available', 'downloaded'].includes(state.status) && dismissed !== key && !view;
    banner.hidden = !visible;
    if (visible) {
      const label = node('span', state.status === 'downloaded' ? ui('更新已下载，重启即可安装。', 'Update downloaded. Restart to install.') : ui('发现新版本 ', 'New version available: ') + state.version);
      const later = button(ui('稍后', 'Later'), () => {dismissed = key; banner.hidden = true;});
      banner.replaceChildren(label, button(ui('查看更新', 'View update'), open), later);
    }
  }
  function render() {
    if (!view || !state) return;
    const {current, status, progress, detail, error, actions} = view;
    current.textContent = ui('当前版本：', 'Current version: ') + state.currentVersion;
    const labels = {
      idle: ['检查可用更新。', 'Check for available updates.'], checking: ['正在检查更新…', 'Checking for updates…'],
      current: ['当前已是最新版本。', 'You have the latest version.'],
      available: ['发现新版本：', 'New version: '], downloading: ['正在下载：', 'Downloading: '],
      downloaded: ['更新已就绪：', 'Update ready: '], installing: ['正在重启并安装更新…', 'Restarting to install the update…'],
      error: ['更新未完成。', 'Update could not finish.'],
    };
    status.textContent = ui(...(labels[state.status] || labels.idle)) + (['available', 'downloading', 'downloaded'].includes(state.status) ? state.version : '');
    error.textContent = state.error ? ui(...(errors[state.error] || errors.check)) : '';
    progress.hidden = detail.hidden = state.status !== 'downloading';
    progress.value = state.progress?.percent || 0;
    detail.textContent = `${Math.floor(progress.value)}%` + (state.progress?.total ? ` · ${(state.progress.transferred / 1048576).toFixed(1)} / ${(state.progress.total / 1048576).toFixed(1)} MB` : '');
    const key = state.status + ':' + state.error;
    if (view.actionKey === key) return;
    view.actionKey = key;
    actions.replaceChildren();
    if (['idle', 'current', 'error'].includes(state.status)) actions.append(button(ui('重新检查', 'Check again'), async () => receive(await desktop.checkUpdate())));
    if (state.status === 'available' || (state.status === 'error' && ['download', 'verification'].includes(state.error))) {
      actions.append(button(ui('下载更新', 'Download update'), async () => receive(await desktop.downloadUpdate())));
    }
    if (state.status === 'downloaded') actions.append(button(ui('重启并更新', 'Restart and update'), async () => {
      await beforeRestart();
      receive(await desktop.installUpdate());
    }));
    if (state.status !== 'installing') actions.append(button(ui('稍后', 'Later'), () => view.root.close()));
  }
  async function manual(body) {
    const current = await (await fetch('/api/version')).json();
    body.append(node('p', ui('当前版本：', 'Current version: ') + current.version));
    body.append(node('p', current.platform === 'win32'
      ? ui('安装版支持应用内更新。请先安装 Folio，然后在帮助菜单中检查更新。', 'In-app updates are available in the installed app. Install Folio, then check for updates in Help.')
      : ui('此平台暂时通过安装包更新。', 'This platform currently updates through a downloaded installer.')));
    const status = node('p', ui('正在检查更新…', 'Checking for updates…'));
    body.append(status);
    try {
      const response = await fetch('/api/release', {signal: AbortSignal.timeout(20000)});
      if (!response.ok) throw Error('Release unavailable');
      const release = validateRelease(await response.json());
      status.textContent = isNewerRelease(release, current) ? ui('发现新版本：', 'New version: ') + release.version : ui('当前已是最新可用版本。', 'You have the latest available version.');
      const id = current.platform === 'win32' ? 'win-x64' : current.platform === 'darwin' ? 'mac-' + current.arch : 'linux-' + current.arch;
      for (const file of release.downloads.filter(file => !desktop || file.id === id)) body.append(button(file.platform + ' · ' + file.format, async () => {
        if (desktop) await desktop.openDownload(file.url); else window.open(file.url, '_blank', 'noopener');
      }));
      body.append(node('p', ui('下载后退出 Folio，再运行安装程序。文献、笔记和设置会保留。', 'Quit Folio before installing. Documents, notes and settings are retained.')));
    } catch {status.textContent = ui(...errors.check); body.append(button(ui('重试', 'Retry'), () => {body.closest('dialog').close(); return open();}));}
  }
  async function open() {
    if (dialogRoot?.open) {dialogRoot.focus(); return;}
    const {root, body} = modal(ui('软件更新', 'Software updates'));
    dialogRoot = root;
    root.addEventListener('close', () => {if (dialogRoot === root) dialogRoot = null;}, {once: true});
    root.classList.add('update-dialog');
    banner.hidden = true;
    if (desktop?.updateState) {
      try {state = await desktop.updateState();} catch {state = null;}
    }
    if (!root.open) return;
    if (!state || state.status === 'unsupported') {await manual(body); return;}
    const current = node('p'), status = node('p'), progress = node('progress', undefined, {max: 100}), detail = node('p'), error = node('p'), actions = node('div', undefined, {className: 'update-actions'});
    status.setAttribute('role', 'status'); error.setAttribute('role', 'alert');
    progress.setAttribute('aria-label', ui('更新下载进度', 'Update download progress'));
    view = {root, current, status, progress, detail, error, actions};
    body.append(current, status, progress, detail, error, node('p', ui('下载期间可继续阅读。重启更新会保留文献、笔记和设置。', 'Keep reading during the download. Restarting to update retains documents, notes and settings.')), actions);
    root.addEventListener('close', () => {view = null; dismissed = state.version + ':' + state.status; banner.hidden = true;}, {once: true});
    render();
    if (['idle', 'current', 'error'].includes(state.status)) receive(await desktop.checkUpdate());
  }
  desktop?.onUpdateState?.(receive);
  return {open};
}
