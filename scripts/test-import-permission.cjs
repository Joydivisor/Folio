// Isolated integration test: real file picker input, IndexedDB, OPFS and PDF
// rendering, with a permission stub that enforces actual Chromium activation.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),reports=path.join(root,'tests/reports');
fs.mkdirSync(reports,{recursive:true});
const temp=fs.mkdtempSync(path.join(reports,'import-permission-'));
app.setPath('userData',path.join(temp,'profile'));
let win,server;
const checks=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const js=expression=>win.webContents.executeJavaScript(expression);
async function until(expression){for(let i=0;i<100;i++){if(await js(expression))return;await wait(100);}throw Error('Timed out: '+expression);}
async function click(selector){
 const rect=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});
 await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});
}
async function selectFile(file){
 const {root:dom}=await win.webContents.debugger.sendCommand('DOM.getDocument');
 const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:dom.nodeId,selector:'#fileInput'});
 await win.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files:[file]});
}
const reset="window.__permission={state:'prompt',answer:'granted',calls:[],fail:false};";
app.whenReady().then(async()=>{
 const {makeServer}=await import(pathToFileURL(path.join(root,'server.mjs')).href);
 server=makeServer({port:4195});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4195,'127.0.0.1',resolve);});
 win=new BrowserWindow({width:1200,height:800,show:false,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 await win.loadURL('http://127.0.0.1:4195');
 await until("!!document.querySelector('#fileInput').onchange");
 win.webContents.debugger.attach('1.3');
 const bootstrap=reset+`
  FileSystemHandle.prototype.queryPermission=async function(options){return options.mode==='readwrite'?window.__permission.state:'granted';};
  FileSystemHandle.prototype.requestPermission=async function(options){
   const active=navigator.userActivation.isActive;
   window.__permission.calls.push({mode:options.mode,active});
   if(!active||window.__permission.fail)throw new DOMException('User activation is required to request permissions.','SecurityError');
   window.__permission.state=window.__permission.answer;return window.__permission.answer;
  };
  window.showDirectoryPicker=async()=>{const root=await navigator.storage.getDirectory();return root.getDirectoryHandle('Permission library',{create:true});};
 `;
 await js(bootstrap+';void 0;');
 await js("document.querySelector('#chooseFolder').click()");
 await until("document.querySelector('#folderName').textContent==='Permission library'");
 const source=path.join(temp,'selected.pdf');fs.copyFileSync(path.join(root,'tests/fixtures/group-theory.pdf'),source);

 await selectFile(source);await until("!!document.querySelector('[data-import-permission]')");
 assert.deepEqual(await js('window.__permission.calls'),[]);
 assert.equal(await js("document.querySelectorAll('[data-doc]').length"),0);
 checks.push('file-picker change never requests write permission or writes before consent');
 await click('[data-import-allow]');
 await until("!document.querySelector('[data-import-permission]')&&document.querySelectorAll('[data-doc]').length===1&&document.querySelector('#fileInput').value===''");
 assert.deepEqual(await js('window.__permission.calls'),[{mode:'readwrite',active:true}]);
 checks.push('explicit click carries user activation and imports into connected folder');

 await selectFile(source);
 await until("document.querySelectorAll('[data-doc]').length===2&&document.querySelector('#fileInput').value===''");
 assert.equal(await js('window.__permission.calls.length'),1);
 assert.equal(await js("[...document.querySelectorAll('[data-doc]')].some(e=>e.textContent.includes('selected (1)'))"),true);
 checks.push('granted folder access is reused and duplicate names preserve the original');

 await js("window.__permission.state='prompt';window.__permission.answer='denied';document.querySelector('[data-folder]').click()");
 await selectFile(source);await until("!!document.querySelector('[data-import-permission]')");
 await click('[data-import-allow]');
 await until("!document.querySelector('[data-import-permission] [role=status]').hidden");
 assert.equal(await js("document.querySelectorAll('[data-doc]').length"),2);
 await click('[data-import-local]');
 await until("document.querySelectorAll('[data-doc]').length===3&&document.querySelector('#fileInput').value===''");
 assert.equal(await js("document.querySelector('[data-filter=all]').classList.contains('active')"),true);
 const localId=await js("document.querySelector('[data-doc^=\"local:\"]').dataset.doc");
 fs.renameSync(source,source+'.moved');
 await js("document.querySelector('[data-doc^=\"local:\"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");
 await until("document.querySelector('.textLayer')?.textContent.includes('Permutation groups')");
 await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});
 await until("!!document.querySelector('#fileInput').onchange&&document.querySelectorAll('[data-doc]').length===3&&document.querySelector('#folderName').textContent==='Permission library'");
 // The page has a new realm. Restore the permission simulation while keeping
 // the real persisted folder, document bytes and IndexedDB from the old page.
 await js(bootstrap+';void 0;');
 await js(`document.querySelector('[data-doc="${localId}"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);
 await until("document.querySelector('.textLayer')?.textContent.includes('Permutation groups')");
 checks.push('denial offers a durable local copy visible outside the folder filter and readable after moving the source and reloading');
 fs.renameSync(source+'.moved',source);
 await js("document.querySelector('#libraryButton').click()");

 await selectFile(source);await until("!!document.querySelector('[data-import-permission]')");
 await click('[data-import-permission] header button');
 await until("!document.querySelector('[data-import-permission]')&&document.querySelector('#fileInput').value===''");
 assert.equal(await js("document.querySelectorAll('[data-doc]').length"),3);
 await selectFile(source);await until("!!document.querySelector('[data-import-permission]')");
 checks.push('cancel imports nothing, clears the picker, and allows the same file to be selected again');

 await js('window.__permission.fail=true');
 await click('[data-import-allow]');
 await until("!document.querySelector('[data-import-permission] [role=status]').hidden");
 assert.equal(await js("document.querySelector('[data-import-permission]').textContent.includes('User activation')"),false);
 await click('[data-import-local]');
 await until("document.querySelectorAll('[data-doc]').length===4&&document.querySelector('#fileInput').value===''");
 checks.push('platform permission errors stay actionable and local import remains available');
 await js("localStorage.setItem('jianwei-notes',JSON.stringify([{id:'keep-note',text:'Retained note'}]));localStorage.setItem('folio-annotations',JSON.stringify([{id:'keep-annotation'}]));");
 await js(`document.querySelector('[data-remove-doc="${localId}"]').click()`);
 await until("!!document.querySelector('[data-remove-document]')");await click('[data-remove-cancel]');
 await until("!document.querySelector('[data-remove-document]')");
 assert.equal(await js("document.querySelectorAll('[data-doc]').length"),4);
 await js(`document.querySelector('[data-doc="${localId}"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}))`);
 await click('[data-remove-confirm]');
 await until("document.querySelectorAll('[data-doc]').length===3&&!document.querySelector('[data-remove-document]')");
 assert.equal(await js("document.querySelector('#readerTabGroup').hidden"),true);
 assert.equal(await js(`(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('jianwei-library');r.onsuccess=()=>resolve(r.result)});return new Promise(resolve=>{const r=db.transaction('files').objectStore('files').get(${JSON.stringify(localId)});r.onsuccess=()=>resolve(!r.result);});})()`),true);
 assert.ok(fs.existsSync(source));
 checks.push('cancel preserves documents; Delete removes only the imported copy and closes its reader');
 const linkedId=await js("document.querySelector('[data-doc^=\"folder:\"]').dataset.doc");
 await js(`document.querySelector('[data-document-row="${linkedId}"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`);
 await click('[data-remove-confirm]');
 await until("document.querySelectorAll('[data-doc]').length===2&&!document.querySelector('[data-remove-document]')");
 assert.equal(await js("(async()=>{const d=await (await navigator.storage.getDirectory()).getDirectoryHandle('Permission library');const names=[];for await(const name of d.keys())names.push(name);return names.length;})()"),2);
 await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});
 await until("!!document.querySelector('#fileInput').onchange&&document.querySelector('#folderName').textContent==='Permission library'&&document.querySelectorAll('[data-doc]').length===2");
 assert.equal(await js("JSON.parse(localStorage.getItem('jianwei-notes'))[0].id"),'keep-note');
 assert.equal(await js("JSON.parse(localStorage.getItem('folio-annotations'))[0].id"),'keep-annotation');
 checks.push('right-click removal survives reload and keeps linked disk files, notes and annotations');
 const result={passed:true,checks,isolatedProfile:temp};
 fs.writeFileSync(path.join(reports,'import-permission-latest.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}).catch(async error=>{console.error(error);if(win)console.error(await js("JSON.stringify({permission:window.__permission,picker:document.querySelector('#fileInput')?.value,folder:document.querySelector('#folderName')?.textContent,count:document.querySelectorAll('[data-doc]').length,toast:document.querySelector('#toast')?.textContent,disabled:document.querySelector('#importFiles')?.disabled,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.textContent)})").catch(()=>''));process.exitCode=1;}).finally(()=>{win?.destroy();server?.close();server?.closeAllConnections();app.exit(process.exitCode||0);});
