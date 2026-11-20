// Click the actual composer and inspect its rendered results in an isolated Electron profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
if(!process.versions.electron){
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const run=require('node:child_process').spawnSync(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true,timeout:150000});
 if(run.error)throw run.error;
 process.exit(run.status??1);
}
const {app,BrowserWindow}=require('electron');
const output=path.join(root,'tests','reports','output-modes');
fs.mkdirSync(output,{recursive:true});app.disableHardwareAcceleration();
app.setPath('userData',fs.mkdtempSync(path.join(output,'profile-')));
let win,server;
const js=script=>win.webContents.executeJavaScript(script);
async function until(script){
 const deadline=Date.now()+20000;
 while(Date.now()<deadline){if(await js(script))return;await new Promise(resolve=>setTimeout(resolve,80));}
 throw Error('Timed out waiting for '+script);
}
async function send(mode,question){
 await js(`document.querySelector('.output-command-button').click();document.querySelector('[data-command="${mode}"]').click();`);
 await js(`document.querySelector('#prompt').value=${JSON.stringify(question)};document.querySelector('#prompt').dispatchEvent(new Event('input'));document.querySelector('#chatForm').requestSubmit()`);
}
async function run(){
 await app.whenReady();
 const {makeServer}=await import(pathToFileURL(path.join(process.env.FOLIO_TEST_ARCHIVE||root,'server.mjs')).href);
 const {outputCases,fixtureFor}=await import(pathToFileURL(path.join(root,'tests/output-mode-cases.mjs')).href);
 const requests=[],errors=[];let queued=[];
 server=makeServer({port:4198,sessionKey:'synthetic-fixture',fetchImpl:async(_url,options)=>{
  const {messages}=JSON.parse(options.body),task=JSON.parse(messages[1].content);
  const c=outputCases.find(c=>c.mode===task.requested_output);
  assert.ok(c);assert.ok(messages[0].content.includes('/'+c.mode+'（'));
  requests.push({mode:c.mode,question:task.question,history:task.conversation.length});
  const value=queued.length?queued.shift():fixtureFor(c);
  return Response.json({choices:[{message:{content:JSON.stringify(value)}}]});
 }});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4198,'127.0.0.1',resolve);});
 win=new BrowserWindow({width:1320,height:900,show:false,webPreferences:{offscreen:true,backgroundThrottling:false,sandbox:true,contextIsolation:true,nodeIntegration:false}});
 win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
 await win.loadURL('http://127.0.0.1:4198');
 await until("!!document.querySelector('#fileInput')?.onchange");
 win.webContents.debugger.attach('1.3');
 const {root:dom}=await win.webContents.debugger.sendCommand('DOM.getDocument');
 const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:dom.nodeId,selector:'#fileInput'});
 await win.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files:[path.join(root,'tests/fixtures/reading-notes.txt')]});
 await until("!!document.querySelector('[data-doc]')");
 await js("document.querySelector('[data-doc]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");
 await until("document.querySelector('.reader-page')?.dataset.ready==='true'");
 await js("document.querySelector('#includePage').checked=false;window.__outputErrors=[];window.addEventListener('error',e=>__outputErrors.push(e.message));window.addEventListener('unhandledrejection',e=>__outputErrors.push(String(e.reason)))");
 const idle="document.querySelector('#learning').getAttribute('aria-busy')==='false'";
 for(const [i,c] of outputCases.entries()){
  const start=requests.length,question=c.selection+' '+c.question;
  if(c.mode==='compare')queued=[fixtureFor(outputCases.at(-1)),fixtureFor(outputCases.at(-1))];
  if(c.mode==='concept')queued=[{...fixtureFor(c),visual:undefined}];
  await send(c.mode,question);
  if(c.mode==='compare'){
   await until(idle+"&&!!document.querySelector('.visual-error[role=alert]')");
   assert.equal(await js("document.querySelector('#prompt').value"),question);
   assert.equal(await js("document.querySelector('.output-command-chip').hidden"),false);
   assert.equal(await js("document.querySelectorAll('.conversation-turn').length"),i);
   await js("document.querySelector('.visual-error button').click()");
  }
  await until(idle+`&&document.querySelector('#visualStage .reading-answer h2')?.textContent===${JSON.stringify(c.mode)}&&!!document.querySelector(${JSON.stringify('#visualStage '+c.selector)})`);
  assert.equal(await js("document.querySelector('#prompt').value"),'');
  assert.equal(await js("document.querySelectorAll('.conversation-turn').length"),i+1);
  assert.equal(await js("document.querySelector('#visualStage .artifact-renderer').hidden"),c.mode==='explain');
  const calls=requests.slice(start);assert.equal(calls.length,c.mode==='compare'?3:c.mode==='concept'?2:1);
  assert.ok(calls.every(r=>r.mode===c.mode&&r.question===question&&r.history===i));
 }
 const three=outputCases.find(c=>c.mode==='3d');
 queued=[{...fixtureFor(three),kind:'clarify',explanation:{title:'Axis?',paragraphs:[{text:'A rotation needs an axis.'}],nextQuestion:'Which axis?'}}];
 await send('3d','演示这个物体的转动。');
 await until(idle+"&&document.querySelector('.answer-next')?.textContent==='Which axis?'");
 assert.deepEqual(await js('window.__outputErrors'),[]);
 await win.reload();await until("!!document.querySelector('.answer-next')&&!document.querySelector('.output-command-chip').hidden");
 await js(`document.querySelector('#prompt').value=${JSON.stringify(three.selection)};document.querySelector('#chatForm').requestSubmit()`);
 await until(idle+"&&!!document.querySelector('#visualStage .geometry-view')");
 assert.equal(requests.at(-1).mode,'3d');assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'ui.json'),JSON.stringify({passed:true,modes:outputCases.map(c=>c.mode),calls:requests.length,checks:['menu to renderer','strict repair','editable retry','history commits once','clarification across restart'],errors},null,2));
 console.log('PASS all nine output menu entries, rendered results, retries and clarification across restart.');
}
run().then(()=>{win.destroy();server.close();app.quit();}).catch(error=>{console.error(error);win?.destroy();server?.close();app.exit(1);});
