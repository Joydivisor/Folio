const { app, BrowserWindow, Menu, shell, dialog, nativeTheme, screen, ipcMain, safeStorage } = require('electron');
const { createVault } = require('./ai-vault.cjs');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const os = require('node:os');
const { roundedRegion } = require('./window-shape.cjs');

const PORT = 4174;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let mainWindow, server;
app.setName('Folio');
app.setAppUserModelId('local.folio.reading');

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('Folio 无法启动', error.code === 'EADDRINUSE'
      ? '本地端口 4174 正在使用。请关闭占用此端口的程序后重新打开 Folio。'
      : error.message);
    app.quit();
  });
}

async function start() {
  nativeTheme.themeSource = 'light';
  const { makeServer } = await import(pathToFileURL(path.join(__dirname, '../server.mjs')).href);
  server = makeServer({ port: PORT });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });
  const stateFile = path.join(app.getPath('userData'), 'window.json');
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
  const work = screen.getPrimaryDisplay().workArea;
  const width = Math.min(work.width, Math.max(900, Number(saved.width) || 1320));
  const height = Math.min(work.height, Math.max(600, Number(saved.height) || 860));
  mainWindow = new BrowserWindow({
    width, height, minWidth: 900, minHeight: 600, show: false,
    title: 'Folio', backgroundColor: '#f8f9fb',
    icon: path.join(__dirname, process.platform==='win32'?'../build/folio.ico':'../build/folio.png'),
    ...(process.platform==='win32'?{
      titleBarStyle: 'hidden', thickFrame: false,
      titleBarOverlay: { color: '#f1f2f5', symbolColor: '#5b6471', height: 31 },
    }:{}),
    roundedCorners: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      spellcheck: false,
    },
  });
  const send = command => mainWindow?.webContents.send('folio:command', command);
  const finishLibraryRestore = require('./file-permissions.cjs').installFilePermissions(mainWindow.webContents.session, {origin: ORIGIN, getWebContents: () => mainWindow?.webContents});
  const {menus} = await import(pathToFileURL(path.join(__dirname, '../public/commands.js')).href);
  const {menuTemplate} = require('./menu.cjs');
  const refreshMenu = language => {
    const template=menuTemplate(menus,language,send);
    if(process.platform==='darwin')template.unshift({label:'Folio',submenu:[{role:'about'},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]});
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  };
  refreshMenu('zh-CN');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://api-docs.deepseek.com/quick_start/pricing/') shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== ORIGIN) event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  const vault = createVault(app.getPath('userData'), safeStorage);
  await vault.load();
  const pending = new Map();
  const authorized = event => event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame && new URL(event.senderFrame.url).origin === ORIGIN;
  const handle = (channel, fn) => ipcMain.handle(channel, async (event, data) => {
    if (!authorized(event)) throw new Error('请求来源无效。');
    return fn(data);
  });
  handle('folio:open-download', async value=>{const {validateRelease}=await import('../public/release-info.js');const response=await fetch('https://getfolio.pages.dev/release.json',{signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw Error('Release server unavailable');const release=validateRelease(await response.json());if(!release.downloads.some(d=>d.url===value))throw Error('Unrecognized download');await shell.openExternal(value);});
  handle('folio:library-restored', () => finishLibraryRestore());
  handle('folio:language', value => {
    if(!['zh-CN','en'].includes(value))throw new Error('Invalid language');
    refreshMenu(value);
  });
  handle('folio:window-command', command => {
    if(command==='fullscreen')mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  handle('folio:edit-command', command => {
    if(!['undo','redo','cut','copy','paste','selectAll'].includes(command))throw new Error('Invalid edit command');
    mainWindow.webContents[command]();
  });
  handle('folio:theme', theme => {
    if (!['light', 'dark'].includes(theme)) throw new Error('外观设置无效。');
    nativeTheme.themeSource = theme;
    if(process.platform==='win32')mainWindow.setTitleBarOverlay({color:theme==='light'?'#f1f2f5':'#1d1e21',symbolColor:theme==='light'?'#5b6471':'#b0b3b9',height:31});
    mainWindow.setBackgroundColor(theme==='light'?'#f8f9fb':'#202124');
  });
  handle('folio:key-status', data => vault.load(data?.baseUrl));
  handle('folio:key-save', async data => {await vault.load(data.baseUrl);return vault.save(data.key, data.remember === true,data.baseUrl);});
  handle('folio:key-import', async data => {
    await vault.load(data.baseUrl);
    const result=await dialog.showOpenDialog(mainWindow,{title:'导入模型服务密钥',properties:['openFile'],filters:[{name:'文本文件',extensions:['txt']}]});
    if(result.canceled)return vault.status(data.baseUrl);
    const file=result.filePaths[0];
    if((await fs.promises.stat(file)).size>16384)throw new Error('请选择只包含密钥的小型文本文件。');
    const {extractCredential}=await import('../public/credential-input.js');
    const value=extractCredential(await fs.promises.readFile(file,'utf8'));
    if(!value)throw new Error('文件中没有可识别的密钥。');
    return vault.save(value,data.remember===true,data.baseUrl);
  });
  handle('folio:key-forget', data => vault.forget(data?.baseUrl));
  handle('folio:models', async data => {
    await vault.load(data.baseUrl);const config=vault.config(data);
    const response=await fetch(ORIGIN+'/api/models',{method:'POST',headers:{'Content-Type':'application/json',Origin:ORIGIN},body:JSON.stringify(config),signal:AbortSignal.timeout(25000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'无法获取模型列表。');return result;
  });
  handle('folio:ai-cancel', id => { pending.get(id)?.abort(); });
  handle('folio:ai-request', async data => {
    if (typeof data.id !== 'string' || pending.has(data.id) || pending.size >= 2) throw new Error('请等待当前请求完成。');
    await vault.load(data.config.baseUrl);
    const config = vault.config(data.config);
    if (!config.apiKey) throw new Error('请先在设置中填写密钥。');
    const controller = new AbortController(); pending.set(data.id, controller);
    const timeout = setTimeout(() => controller.abort(), 125000);
    try {
      const response = await fetch(ORIGIN + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ ...config, messages: data.messages }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '模型请求失败。');
      return result.content;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('请求已停止或超时。');
      throw new Error(error.message.includes(config.apiKey) ? '模型请求失败。' : error.message);
    } finally { clearTimeout(timeout); pending.delete(data.id); }
  });
  mainWindow.on('closed', () => { for (const controller of pending.values()) controller.abort(); });
  const windowState = () => mainWindow.webContents.send('folio:window-state', {
    maximized: mainWindow.isMaximized(), fullscreen: mainWindow.isFullScreen(),
  });
  const legacyCorners = process.platform === 'win32' && Number(os.release().split('.')[2]) < 22000;
  const updateShape = () => {
    if (!legacyCorners) return;
    const [width, height] = mainWindow.getSize();
    mainWindow.setShape(mainWindow.isMaximized() || mainWindow.isFullScreen()
      ? [] : roundedRegion(width, height));
  };
  for (const event of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) {
    mainWindow.on(event, windowState);
    mainWindow.on(event, updateShape);
  }
  mainWindow.on('resize', updateShape);
  mainWindow.webContents.on('did-finish-load', windowState);
  mainWindow.on('close', () => {
    const bounds = mainWindow.getNormalBounds();
    try { fs.writeFileSync(stateFile, JSON.stringify({ width: bounds.width, height: bounds.height, maximized: mainWindow.isMaximized() })); } catch {}
  });
  await mainWindow.loadURL(ORIGIN);
  if (saved.maximized) mainWindow.maximize();
  updateShape();
  mainWindow.show();
  console.info('Folio window ready');
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => server?.close());
