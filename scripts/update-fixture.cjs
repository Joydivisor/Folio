// Runs only inside the disposable update integration package.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {profile,resultFile,initial,cache,name}=require('./update-test-config.json');
app.setPath('userData',profile);app.disableHardwareAcceleration();
process.env.LOCALAPPDATA=cache;
fs.copyFileSync(path.join(path.dirname(process.execPath),'Uninstall '+name+'.exe'),path.join(path.dirname(process.execPath),'Uninstall Folio.exe'));
app.on('browser-window-created',(_event,win)=>{
 win.webContents.once('did-finish-load',()=>setTimeout(async()=>{
  const js=s=>win.webContents.executeJavaScript(s),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async s=>{for(let i=0;i<900;i++){if(await js(s))return;await wait(100);}throw Error('Timed out: '+s);};
  const screenshot=async label=>fs.writeFileSync(path.join(path.dirname(resultFile),label+'.png'),(await win.webContents.capturePage()).toPNG());
  try{
   await until("!!document.querySelector('#fileInput').onchange");
   if(app.getVersion()===initial){
    await js(`(async()=>{
      localStorage.setItem('jianwei-notes',JSON.stringify([{id:'update-note',title:'升级前的笔记',text:'保留原文与公式 x²',source:{id:'local:update-paper',name:'update-paper.txt',page:1}}]));
      localStorage.setItem('jianwei-settings',JSON.stringify({model:'fixture-model',baseUrl:'https://example.invalid/v1'}));
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jianwei-library',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put({id:'local:update-paper',name:'update-paper.txt',path:'Local library',blob:new Blob(['Document survives an actual installer upgrade.'])});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
      const store=await import('/workspace-store.js');await store.openWorkspace().put('state',{id:'jianwei-favorites',value:['local:update-paper']});
      localStorage.setItem('folio-language','zh-CN');
    })()`);
    await js("window.dispatchEvent(new CustomEvent('folio-feature',{detail:'updates'})); true");
    await until("window.folioDesktop.updateState().then(s=>s.status==='available')");
    await screenshot('available');
    await js("[...document.querySelectorAll('.update-actions button')].find(b=>/下载更新|Download update/.test(b.textContent)).click(); true");
    await until("window.folioDesktop.updateState().then(s=>s.status==='downloaded')");
    await screenshot('downloaded');
    await js("[...document.querySelectorAll('.update-actions button')].find(b=>/重启并更新|Restart and update/.test(b.textContent)).click(); true");
   }else{
    const data=await js(`(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('jianwei-library',1);q.onsuccess=()=>r(q.result);});const doc=await new Promise(r=>{const q=db.transaction('files').objectStore('files').get('local:update-paper');q.onsuccess=()=>r(q.result);});db.close();const w=(await import('/workspace-store.js')).openWorkspace();return {notes:JSON.parse(localStorage.getItem('jianwei-notes')),settings:JSON.parse(localStorage.getItem('jianwei-settings')),document:await doc.blob.text(),favorites:(await w.get('state','jianwei-favorites')).value};})()`);
    assert.equal(data.notes[0].text,'保留原文与公式 x²');assert.equal(data.settings.model,'fixture-model');assert.equal(data.document,'Document survives an actual installer upgrade.');assert.deepEqual(data.favorites,['local:update-paper']);
    await screenshot('after-update');
    fs.writeFileSync(resultFile,JSON.stringify({passed:true,from:initial,to:app.getVersion(),installedPath:process.execPath,profile:app.getPath('userData'),document:true,notes:true,settings:true,workspaceIndexedDB:true,realDownload:true,realInstaller:true,relaunched:true},null,2));app.quit();
   }
  }catch(error){fs.writeFileSync(resultFile,JSON.stringify({passed:false,error:error.stack}));app.exit(1);}
 },1200));
});
require('./main.cjs');
