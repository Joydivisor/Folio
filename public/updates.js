import {ui, node, button, modal} from './workspace-ui.js';
import {isNewerRelease, validateRelease} from './release-info.js';

export function setupUpdates({beforeRestart = async () => {}} = {}) {
  const desktop = window.folioDesktop;
  window.folioPrepareForUpdate = async () => {
    try {return await beforeRestart();} catch {return 'save';}
  };
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
    editing: ['请先保存并关闭编辑窗口，再退出 Folio。', 'Save and close the editor, then quit Folio.'],
    save: ['工作区尚未保存，请稍后重试退出。', 'The workspace could not be saved. Try quitting again.'],
    authorization: ['系统未授权安装。请重试并在系统提示中批准更新。', 'Installation needs system authorization. Retry and approve the system prompt.'],
    cancelled: ['已取消系统授权。可以继续使用 Folio，稍后重试。', 'Authorization was cancelled. You can keep working and retry later.'],
  };
  function receive(next) {
    state = next;
    if (view) render();
    const key = state.version + ':' + state.status;
    document.body.inert = state.status === 'installing';
    const visible = (['available', 'downloaded'].includes(state.status) || state.error) && dismissed !== key + ':' + state.error && !view;
    banner.hidden = !visible;
    if (visible) {
      const label = node('span', state.error ? ui(...(errors[state.error] || errors.check)) : state.status === 'downloaded' ? ui('更新已就绪，下次退出时安装。', 'Update ready. It will install when you quit.') : ui('发现新版本 ', 'New version available: ') + state.version);
      const later = button(ui('稍后', 'Later'), () => {dismissed = key + ':' + state.error; banner.hidden = true;});
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
      downloaded: ['退出 Folio 时将安装 ', 'Quit Folio to install '], installing: ['正在安装更新…', 'Installing update…'],
      error: ['更新未完成。', 'Update could not finish.'],
    };
    status.textContent = ui(...(labels[state.status] || labels.idle)) + (['available', 'downloading', 'downloaded'].includes(state.status) ? state.version : '');
    error.textContent = state.error ? ui(...(errors[state.error] || errors.check)) : '';
    progress.hidden = detail.hidden = state.status !== 'downloading';
    if (state.progress?.total) progress.value = state.progress.percent; else progress.removeAttribute('value');
    detail.textContent = state.progress?.total ? `${Math.floor(progress.value)}% · ${(state.progress.transferred / 1048576).toFixed(1)} / ${(state.progress.total / 1048576).toFixed(1)} MB` : '';
    const key = state.status + ':' + state.error;
    if (view.actionKey === key) return;
    view.actionKey = key;
    actions.replaceChildren();
    if (state.status === 'error') actions.append(button(ui('重试更新', 'Retry update'), () => desktop.prepareUpdate()));
    if (state.status === 'downloaded') actions.append(button(ui('现在退出并更新', 'Quit and update now'), () => desktop.installUpdate()));
    if (state.status !== 'installing') actions.append(button(ui('关闭', 'Close'), () => view.root.close()));
  }
  async function manual(body) {
    const current = await (await fetch('/api/version')).json();
    body.append(node('p', ui('当前版本：', 'Current version: ') + current.version));
    body.append(node('p', ui('请先安装桌面版。Mac 请将 Folio 拖入「应用程序」，Linux 请安装 DEB。安装后即可从帮助菜单更新。', 'Install the desktop app to update from Help. On Mac, drag Folio to Applications. On Linux, install the DEB.')));
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
    // Send the user action before any asynchronous UI read so an immediate quit sees it.
    const preparation = desktop?.prepareUpdate?.().catch(() => null);
    if (desktop?.updateState) {
      try {state = await desktop.updateState();} catch {state = null;}
    }
    if (!root.open) return;
    if (!state || state.status === 'unsupported') {await manual(body); return;}
    const current = node('p'), status = node('p'), progress = node('progress', undefined, {max: 100}), detail = node('p'), error = node('p'), actions = node('div', undefined, {className: 'update-actions'});
    status.setAttribute('role', 'status'); error.setAttribute('role', 'alert');
    progress.setAttribute('aria-label', ui('更新下载进度', 'Update download progress'));
    view = {root, current, status, progress, detail, error, actions};
    body.append(current, status, progress, detail, error, node('p', ui('可以关闭此窗口继续阅读。正常退出 Folio 时会完成更新，下次打开就是新版。', 'Keep reading while the update downloads. Quit Folio normally to finish, then reopen to use the new version.')), actions);
    root.addEventListener('close', () => {view = null; dismissed = state.version + ':' + state.status + ':' + state.error; banner.hidden = true;}, {once: true});
    render();
    await preparation;
  }
  desktop?.onUpdateState?.(receive);
  return {open};
}
