// Isolated renderer test: never opens the user's library or credentials.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const folderMode=true;
const temp=fs.mkdtempSync(path.join(root,'tests/reports/file-import-'));
app.setPath('userData',path.join(temp,'profile'));
let win,server;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<100;i++){if(await win.webContents.executeJavaScript(expression))return;await wait(100);}throw Error('Timed out: '+expression);}
app.whenReady().then(async()=>{
 const {makeServer}=await import(pathToFileURL(path.join(process.env.FOLIO_TEST_ARCHIVE||root,'server.mjs')).href);
 server=makeServer({port:4196});await new Promise(r=>server.listen(4196,'127.0.0.1',r));
 win=new BrowserWindow({width:1380,height:920,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
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
 await win.webContents.executeJavaScript("(async()=>{const m=await import('/vendor/build/pdf.mjs');const render=m.TextLayer.prototype.render;m.TextLayer.prototype.render=async function(...args){await render.apply(this,args);window.__spanBefore=this.textDivs.filter(n=>n.isConnected).map(n=>({n,r:n.getBoundingClientRect().toJSON()}));};})()");

 await win.webContents.executeJavaScript("document.querySelector('[data-doc]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");
 await until("document.querySelector('.textLayer')?.textContent.includes('Permutation groups')");


 await until("document.querySelectorAll('.semantic-block').length>1");

 const displacement=await win.webContents.executeJavaScript("Math.max(0,...window.__spanBefore.flatMap(({n,r})=>{const b=n.getBoundingClientRect();return ['x','y','width','height'].map(k=>Math.abs(r[k]-b[k]));}))");if(displacement>.1)throw Error('PDF selection moved relative to page: '+displacement);
 console.log('Text-layer displacement: '+displacement+' px');
 const modeExists=await win.webContents.executeJavaScript("!!document.querySelector('#readingMode,#originalMode,.reflow-paper')");if(modeExists)throw Error('Unwanted reading mode');
 await win.webContents.executeJavaScript("document.querySelector('.semantic-block span[data-block]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:3}))");
 await until("!!document.querySelector('.selection-dock')");
 await win.webContents.executeJavaScript("getSelection().removeAllRanges()");
 await until("!document.querySelector('.selection-dock')");
 await win.webContents.executeJavaScript("document.querySelector('.semantic-block span[data-block]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:3}))");
 await until("!!document.querySelector('.selection-dock')");
 const blank=await win.webContents.executeJavaScript("(()=>{const r=document.querySelector('.pdf-page').getBoundingClientRect();return {x:r.left+8,y:r.top+8};})()");
 await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...blank,button:'left',clickCount:1});
 await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...blank,button:'left',clickCount:1});
 await until("!document.querySelector('.selection-dock')");
 await win.webContents.executeJavaScript("document.querySelector('.semantic-block span[data-block]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:3}))");
 await until("!!document.querySelector('.selection-dock')");
 await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await until("!document.querySelector('.selection-dock')");
 await win.webContents.executeJavaScript("document.querySelector('.semantic-block span[data-block]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:3}))");
 await until("!!document.querySelector('.selection-dock')");


 const noteButton=await win.webContents.executeJavaScript("(()=>{const r=document.querySelector('.selection-dock button:last-child').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...noteButton,button:'left',clickCount:1});
 await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...noteButton,button:'left',clickCount:1});

 await until("!!document.querySelector('.quote-editor')");
 await win.webContents.executeJavaScript("[...document.querySelectorAll('.workspace-dialog .selection-actions button')].find(b=>/记笔记|Add note/.test(b.textContent)).click()");
 await until("!document.querySelector('.quote-editor') && JSON.parse(localStorage.getItem('jianwei-notes')).length===1");
 const sourceAnchor=await win.webContents.executeJavaScript("JSON.parse(localStorage.getItem('jianwei-notes'))[0].source");if(!sourceAnchor.blockIds?.length||!sourceAnchor.blockContext?.text)throw Error('Missing block context');
 await win.webContents.executeJavaScript("document.querySelector('.semantic-block span[data-block]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:3}))");await wait(100);
 await win.webContents.executeJavaScript("document.querySelector('#highlightSelection').click()");
 await until("JSON.parse(localStorage.getItem('folio-annotations'))?.[0]?.view==='original'");
 await win.webContents.executeJavaScript("document.querySelector('#closeAnnotations').click()");
 win.setSize(1380,920);await wait(200);
 await win.webContents.executeJavaScript("const r=document.querySelector('#learning').getBoundingClientRect();const dt=new DataTransfer();dt.setData('text/plain','A selected passage.');document.querySelector('#learning').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:r.x+r.width/2,clientY:r.y+200}));");
 await until("!!document.querySelector('.drop-feedback')");
 const feedback=await win.webContents.executeJavaScript("(()=>{const e=document.querySelector('.drop-feedback');return {body:e.parentNode===document.body,width:e.getBoundingClientRect().width,ringWidth:parseFloat(getComputedStyle(e.querySelector('i')).width),label:e.textContent,dialog:!!document.querySelector('dialog[open]')};})()");if(!feedback.body||feedback.width<200||feedback.ringWidth<200||feedback.dialog)throw Error('Feedback obstructed');
 await win.webContents.executeJavaScript("document.querySelector('.drop-feedback').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=400;})");
 await wait(180);console.log(await win.webContents.executeJavaScript("JSON.stringify(['#learning','.drop-feedback','.drop-waves','.drop-waves i','.drop-received'].map(sel=>{const n=document.querySelector(sel),c=getComputedStyle(n);return {sel,rect:n.getBoundingClientRect().toJSON(),transform:c.transform,position:c.position,width:c.width,height:c.height,opacity:c.opacity,animation:c.animation};}))"));
 await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(150);
 fs.writeFileSync(path.join(root,'tests/reports/beta9-drop.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 await until("document.querySelector('#quoteText')?.textContent==='A selected passage.'");
 await wait(1700);if(await win.webContents.executeJavaScript("!!document.querySelector('.drop-feedback')"))throw Error('Feedback not cleaned up');
 win.setSize(940,720);await win.webContents.executeJavaScript("window.folioAppearance.set('dark')");await wait(300);
 if(await win.webContents.executeJavaScript("document.documentElement.scrollWidth>innerWidth+2"))throw Error('Narrow overflow');
 fs.writeFileSync(path.join(root,'tests/reports/beta9-reading-dark.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 fs.writeFileSync(path.join(root,'tests/reports/beta9-reading.json'),JSON.stringify({passed:true,checks:['folder import','source moved','reload','unchanged PDF canvas','default semantic text layer','triple-click paragraph','source-linked note','selection cleared hides toolbar','blank click hides toolbar','Escape hides toolbar','toolbar actions preserve quote','annotation','direct drop without modal','visible feedback','feedback cleanup','narrow dark layout']},null,2));
 console.log('PASS revised beta9 original-layout selection and visible drop workflow');
}).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{win?.destroy();server?.close();server?.closeAllConnections();app.exit(process.exitCode||0);});
