// Actual Electron process exits/restarts with a native directory handle created
// through Chromium's file-drop flow. All files and profiles are synthetic.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),runtime=process.env.FOLIO_TEST_ARCHIVE||root;
if(!process.versions.electron){
 const {spawnSync}=require('node:child_process');
 const reports=path.join(root,'tests/reports');fs.mkdirSync(reports,{recursive:true});
 const temp=fs.mkdtempSync(path.join(reports,'library-restart-')),library=path.join(temp,'Restart library');
 fs.mkdirSync(library);fs.writeFileSync(path.join(library,'first.txt'),'Restart reading fixture');
 fs.mkdirSync(path.join(library,'nested'));fs.copyFileSync(path.join(root,'tests/fixtures/group-theory.pdf'),path.join(library,'nested','paper.pdf'));
 const checks=[];
 for(const phase of ['seed','restart','restart-again','browser','offline']){
  if(phase==='restart-again')fs.writeFileSync(path.join(library,'added.txt'),'Detected on restart');
  if(phase==='offline'){
   const destination=path.join(temp,'offline-library');
   for(const target of [library,destination])assert(path.resolve(target).startsWith(path.resolve(temp)+path.sep));
   fs.renameSync(library,destination);
  }
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const r=spawnSync(require('electron'),[__filename,phase,temp],{env,encoding:'utf8',windowsHide:true,timeout:60000});
  if(r.status!==0){console.error(r.stdout,r.stderr);process.exit(1);}
  const row=r.stdout.split(/\r?\n/).find(line=>line.startsWith('RESULT '));assert(row,phase+' No phase result: '+r.stdout+' '+r.stderr);checks.push(JSON.parse(row.slice(7)));
 }
 fs.writeFileSync(path.join(reports,'library-restart.json'),JSON.stringify({runtime,checks},null,2));
 console.log('PASS native folder migration, two process restarts, fresh scan, saved catalog, browser permission renewal, offline preservation and scoped writes.');
}else{
 const {app,BrowserWindow}=require('electron'),{pathToFileURL}=require('node:url');
 const phase=process.argv[2],temp=process.argv[3],origin='http://127.0.0.1:4198';
 app.setPath('userData',path.join(temp,'profile'));let win,server;const errors=[];
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),js=s=>win.webContents.executeJavaScript(s);
 async function until(s){for(let i=0;i<120;i++){if(await js(s))return;await wait(100);}throw Error('Timed out: '+s);}
 async function click(selector,count=1){const point=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);for(const type of ['mousePressed','mouseReleased'])await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type,button:'left',clickCount:count,...point});}
 app.whenReady().then(async()=>{
  const {makeServer}=await import(pathToFileURL(path.join(runtime,'server.mjs')));server=makeServer({port:4198});await new Promise(r=>server.listen(4198,'127.0.0.1',r));
  win=new BrowserWindow({width:1200,height:850,show:false,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  const finishRestore=phase!=='seed'&&phase!=='browser'?require(path.join(runtime,'desktop/file-permissions.cjs')).installFilePermissions(win.webContents.session,{origin,getWebContents:()=>win.webContents}):()=>{};
  win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  await win.loadURL(origin);await until("!!document.querySelector('#fileInput').onchange");win.webContents.debugger.attach('1.3');
  await js(`window.libraryDB=new Promise((resolve,reject)=>{const r=indexedDB.open('jianwei-library',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});window.getFolder=async()=>{const d=await libraryDB;return new Promise(r=>{const q=d.transaction('meta').objectStore('meta').get('folder');q.onsuccess=()=>r(q.result);});};void 0`);
  if(phase==='seed'){
   await js(`window.dropped=new Promise((resolve,reject)=>{for(const name of ['dragenter','dragover'])document.addEventListener(name,e=>{e.preventDefault();e.stopImmediatePropagation();},true);document.addEventListener('drop',async e=>{e.preventDefault();e.stopImmediatePropagation();try{const folder=await e.dataTransfer.items[0].getAsFileSystemHandle();const d=await libraryDB;await new Promise((a,b)=>{const tx=d.transaction(['meta','files'],'readwrite');tx.objectStore('meta').put(folder,'folder');tx.objectStore('meta').delete('folder-catalog');tx.objectStore('files').put({id:'local:restart-fixture',name:'local.txt',path:'Local library',blob:new File(['Local copy survives restart'],'local.txt')});tx.oncomplete=a;tx.onerror=b;});localStorage.setItem('jianwei-favorites',JSON.stringify(['folder:Restart library:first.txt']));resolve(folder.kind);}catch(error){reject(error);}},true);});void 0`);
   for(const type of ['dragEnter','dragOver','drop']){await win.webContents.debugger.sendCommand('Input.dispatchDragEvent',{type,x:350,y:300,data:{items:[],files:[path.join(temp,'Restart library')],dragOperationsMask:1}});await wait(100);}
   assert.equal(await js('dropped'),'directory');
  }else{
   const count=phase==='restart'?3:4;
   await until(`document.querySelectorAll('[data-doc]').length===${count}&&document.querySelector('#folderName').textContent==='Restart library'`);
   if(phase!=='offline')await until("document.querySelector('#folderDescription').textContent.includes('已连接')||document.querySelector('#folderDescription').textContent.includes('已恢复目录')");
   finishRestore();
   assert.equal(await js("JSON.parse(localStorage.getItem('jianwei-favorites'))[0]"),'folder:Restart library:first.txt');
   if(phase!=='offline'){
    await click('[data-doc="folder:Restart library:first.txt"]',2);
    await until("document.querySelector('#documentContent').textContent.includes('Restart reading fixture')");
    if(phase==='restart'){
     assert.equal(await js("getFolder().then(h=>h.queryPermission({mode:'readwrite'}))"),'prompt');
     await wait(5500);
     assert.notEqual(await js("getFolder().then(h=>h.requestPermission({mode:'readwrite'})).catch(e=>e.name)"),'granted');
     await js(`window.writeResult=null;const b=document.createElement('button');b.id='test-write';b.textContent='Test explicit import access';b.onclick=async()=>{try{const h=await getFolder();const permission=await h.requestPermission({mode:'readwrite'});if(permission!=='granted')throw Error(permission);const f=await h.getFileHandle('write-check.txt',{create:true}),w=await f.createWritable();await w.write('explicit write');await w.close();await h.removeEntry('write-check.txt');window.writeResult='granted';}catch(e){window.writeResult=e.name+':'+e.message;}};document.body.prepend(b);void 0`);
     await click('#test-write');await until('window.writeResult!==null');assert.equal(await js('window.writeResult'),'granted');
    }
   }else{
    await until("!document.querySelector('#toast').hidden");
    assert.equal(await js("document.querySelectorAll('[data-doc]').length"),4);
    await click('[data-doc="local:restart-fixture"]',2);await until("document.querySelector('#documentContent').textContent.includes('Local copy survives restart')");
   }
  }
  assert.deepEqual(errors,[]);console.log('RESULT '+JSON.stringify({phase,passed:true}));
 }).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{win?.destroy();server?.close();app.exit(process.exitCode||0);});
}
