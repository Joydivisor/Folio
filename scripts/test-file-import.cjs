// Isolated renderer test: never opens the user's library or credentials.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const folderMode=process.argv.includes('--folder');
const temp=fs.mkdtempSync(path.join(root,'tests/reports/file-import-'));
app.setPath('userData',path.join(temp,'profile'));
let win,server;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<100;i++){if(await win.webContents.executeJavaScript(expression))return;await wait(100);}throw Error('Timed out: '+expression);}
app.whenReady().then(async()=>{
 const {makeServer}=await import(pathToFileURL(path.join(root,'server.mjs')).href);
 server=makeServer({port:4196});await new Promise(r=>server.listen(4196,'127.0.0.1',r));
 win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
 await win.loadURL('http://127.0.0.1:4196');
 await until("!!document.querySelector('#fileInput')?.onchange");
 const source=path.join(temp,'source');fs.mkdirSync(source);const file=path.join(source,'first-import.pdf');fs.copyFileSync(path.join(root,'tests/fixtures/group-theory.pdf'),file);
 win.webContents.debugger.attach('1.3');
 const {root:dom}=await win.webContents.debugger.sendCommand('DOM.getDocument');
 const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:dom.nodeId,selector:folderMode?'#folderInput':'#fileInput'});
 await win.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files:[folderMode?source:file]});
 await until("document.querySelectorAll('[data-doc]').length===1 && document.querySelector('#fileInput').value===''");
 fs.renameSync(file,file+'.moved');
 await win.webContents.executeJavaScript("document.querySelector('[data-doc]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");
 await until("document.querySelector('.textLayer')?.textContent.includes('Permutation groups')");
 await win.reload();
 await until("!!document.querySelector('[data-doc]')?.ondblclick");
 await win.webContents.executeJavaScript("document.querySelector('[data-doc]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");
 await until("document.querySelector('.textLayer')?.textContent.includes('Permutation groups')");
 console.log((folderMode?'FOLDER ':'FILE ')+'PASS: first PDF import, input reset, original moved, renderer reload, stored PDF reopened.');
 fs.writeFileSync(path.join(root,'tests/reports/file-import-latest.json'),JSON.stringify({passed:true,folderMode,checks:['first import','input cleared','external file moved','PDF rendered','reload','persisted copy reopened']},null,2));
}).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{win?.destroy();server?.close();server?.closeAllConnections();app.exit(process.exitCode||0);});
