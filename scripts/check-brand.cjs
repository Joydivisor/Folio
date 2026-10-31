const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tests/reports/brand');fs.mkdirSync(out,{recursive:true});
app.setPath('userData',path.join(out,'profile'));
app.whenReady().then(async()=>{
 let server,win;const errors=[];
 try{
  const before=fs.readFileSync(path.join(root,'design/icon-options/pre-upgrade/index.html'),'utf8');const after=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const sidebar=s=>s.match(/<aside class="library-sidebar">[\s\S]*?<\/aside>/)[0];assert.equal(sidebar(after),sidebar(before),'sidebar contents must remain byte-identical');
  const {makeServer}=await import(pathToFileURL(path.join(root,'server.mjs')).href);server=makeServer({port:4191});await new Promise(r=>server.listen(4191,'127.0.0.1',r));
  win=new BrowserWindow({width:1320,height:860,show:false,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}});
  win.webContents.on('console-message',(_e,level,message)=>{if(level===3)errors.push(message);});
  await win.loadURL('http://127.0.0.1:4191');
  const js=s=>win.webContents.executeJavaScript(s,true);
  for(let i=0;i<50;i++){if(await js('document.querySelectorAll("#appMenubar>button").length===5 && !!document.querySelector(".document-card")'))break;await new Promise(r=>setTimeout(r,100));}
  await js(`document.querySelector('#settingsButton').click();document.querySelector('#languageSelect').value='zh-CN';document.querySelector('#languageSelect').dispatchEvent(new Event('change'));document.querySelector('#settingsDialog').close();document.querySelector('#homeBrand').click();const style=document.createElement('style');style.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';document.head.append(style)`);
  const results=[];
  for(const theme of ['light','dark']){
   await js(`window.folioAppearance.set('${theme}')`);
   await new Promise(r=>setTimeout(r,200));
   await js(`document.getAnimations().forEach(a=>{try{a.finish()}catch{}})`);
   const surface=await js(`getComputedStyle(document.querySelector('.library-nav button.active')).backgroundColor`);
   assert.equal(surface,theme==='light'?'rgb(242, 232, 229)':'rgb(58, 45, 47)');
   await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
   const state=await js(`(()=>{const r=s=>document.querySelector(s).getBoundingClientRect(),c=s=>getComputedStyle(document.querySelector(s)).color;return {theme:document.documentElement.dataset.theme,mark:c('.brand'),icons:['all','recent','starred'].map(n=>c('[data-filter="'+n+'"] .icon')),menuCount:document.querySelectorAll('#appMenubar>button').length,titleBottom:r('.app-titlebar').bottom,tabsTop:r('.app-header').top,sidebarTop:r('.library-sidebar').top,tabsBottom:r('.app-header').bottom,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
   assert.equal(state.theme,theme);assert.equal(state.menuCount,5);assert.equal(new Set(state.icons).size,3);assert.ok(state.titleBottom<=state.tabsTop);assert.ok(state.tabsBottom<=state.sidebarTop);assert.equal(state.overflow,false);results.push(state);
   fs.writeFileSync(path.join(out,theme+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  await js(`document.querySelector('#appMenubar>button').click()`);assert.equal(await js(`document.querySelector('#commandMenu').matches(':popover-open')`),true);await js(`document.querySelector('#commandMenu').hidePopover()`);
  await js(`document.querySelector('[data-filter="recent"]').click()`);assert.equal(await js(`document.querySelector('[data-filter="recent"]').classList.contains('active')`),true);
  await js(`document.querySelector('#homeBrand').click()`);assert.equal(await js(`document.querySelector('[data-filter="all"]').classList.contains('active')`),true);
  await js(`document.querySelector('.document-open').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);await new Promise(r=>setTimeout(r,350));
  assert.equal(await js(`document.body.dataset.view`),'reader');fs.writeFileSync(path.join(out,'reader.png'),(await win.webContents.capturePage()).toPNG());
  await js(`document.querySelector('#settingsButton').click()`);assert.equal(await js(`document.querySelector('#settingsDialog').open`),true);
  await js(`document.querySelector('#languageSelect').value='en';document.querySelector('#languageSelect').dispatchEvent(new Event('change'));document.querySelector('#settingsDialog').close();document.querySelector('#homeBrand').click()`);
  assert.equal(await js(`document.querySelector('#appMenubar>button').textContent`),'File');
  win.setSize(900,600);await new Promise(r=>setTimeout(r,200));assert.equal(await js(`document.querySelector('.header-actions').getBoundingClientRect().right<=innerWidth`),true);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({sidebarUnchanged:true,menu:true,filters:true,reader:true,settings:true,english:true,minWindow:true,results,errors},null,2));
  console.log('Brand UI verification passed: themes, icon colors, unchanged sidebar, menus, filters, reader, settings, English, 900px layout.');
 }catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();server?.close();app.exit(process.exitCode||0);}
});
