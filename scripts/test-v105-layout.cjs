// Reproduce the long-answer/self-check overlap in an isolated real Chromium window.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
if(!process.versions.electron){
 const {spawnSync}=require('node:child_process'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const r=spawnSync(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true,timeout:120000});if(r.error)console.error(r.error);process.exit(r.status??1);
}else{
 const {app,BrowserWindow}=require('electron'),{pathToFileURL}=require('node:url');
 app.disableHardwareAcceleration();const output=path.join(root,'tests/reports/v105-layout');fs.mkdirSync(output,{recursive:true});const temp=fs.mkdtempSync(path.join(output,'run-'));app.setPath('userData',path.join(temp,'profile'));
 let win,server,requests=0;const checks=[],wait=ms=>new Promise(r=>setTimeout(r,ms)),js=s=>win.webContents.executeJavaScript(s);
 async function until(s){for(let i=0;i<300;i++){if(await js(s))return;await wait(100);}throw Error('Timed out: '+s);}
 async function shot(name){fs.writeFileSync(path.join(output,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
 const formula=String.raw`\[\operatorname{MultiHead}(Q,K,V)=\operatorname{Concat}(\operatorname{head}_1,\ldots,\operatorname{head}_h)W^O,\qquad \operatorname{head}_i=\operatorname{Attention}(QW_i^Q,KW_i^K,VW_i^V)\]`;
 const dimensions=String.raw`其中 \(W_i^Q,W_i^K\in\mathbb{R}^{d_{\mathrm{model}}\times d_k}\)，\(W_i^V\in\mathbb{R}^{d_{\mathrm{model}}\times d_v}\)，\(W^O\in\mathbb{R}^{hd_v\times d_{\mathrm{model}}}\)。`;
 const prose='多个头让模型可以在不同位置、不同表示子空间里同时关注信息；如果只算一个头，加权平均会把这种多样性抹平。具体拼接时，先把各个头的输出拼接，再乘输出投影矩阵得到最终结果。';
 async function measure(label){
  await js('document.fonts.ready');await wait(150);
  const m=await js(`(()=>{const stage=document.querySelector('#visualStage'),panel=document.querySelector('#visualPanel'),quiz=document.querySelector('#selfCheck'),history=document.querySelector('#conversationHistory'),r=e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height};};return {stage:r(stage),quiz:r(quiz),history:r(history),panel:r(panel),contentBottom:Math.max(...[...stage.querySelectorAll('.reading-answer,.learning-next-actions,.artifact-discussion')].map(e=>e.getBoundingClientRect().bottom)),panelClientWidth:panel.clientWidth,panelScrollWidth:panel.scrollWidth,panelHeight:panel.clientHeight,panelScrollHeight:panel.scrollHeight,math:[...document.querySelectorAll('#visualStage .katex-display')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))};})()`);
  checks.push({label,...m});
  assert.ok(m.stage.bottom>=m.contentBottom-1,label+': answer paints outside its container '+JSON.stringify(m));
  assert.ok(m.quiz.top>=m.contentBottom+6,label+': self-check overlaps answer '+JSON.stringify(m));
  assert.ok(m.stage.top>=m.history.bottom-1,label+': expanded history overlaps the current answer');
  assert.ok(m.panelScrollWidth<=m.panelClientWidth+1,label+': entire panel scrolls horizontally');
  assert.ok(m.math.length>0,label+': formulas rendered');if(m.stage.right-m.stage.left<650)assert.ok(m.math.some(f=>f.scroll>f.client),label+': wide formula remains independently scrollable');
  assert.ok(m.math.every(f=>f.left>=m.stage.left-1&&f.right<=m.stage.right+1),label+': formula container exceeds answer width');
  await js("document.querySelector('#selfCheck').scrollIntoView({block:'end'})");await wait(80);await shot(label);
 }
 app.whenReady().then(async()=>{
  const {makeServer}=await import(pathToFileURL(path.join(process.env.FOLIO_TEST_ARCHIVE||root,'server.mjs')).href);
  server=makeServer({port:4195,sessionKey:'layout-fixture',fetchImpl:async(url,options)=>{assert.ok(options?.body);requests++;const body=JSON.parse(options.body),prompt=body.messages.at(-1).content;const response=prompt.includes('"requested_type"')?{type:'choice',question:'多个头的输出在投影前如何合并？',options:['取均值','拼接','只保留第一个头'],correctIndex:1,explanation:'拼接保留各个头的信息，再由输出投影组合。'}:{kind:'explain',object:'多头注意力',reason:'解释输出的拼接过程',explanation:{title:'多头注意力的输出',paragraphs:Array.from({length:8},(_,i)=>({text:(i+1)+'. '+prose+'\n\n'+formula+'\n\n'+dimensions,sources:[]}))}};return Response.json({choices:[{message:{content:JSON.stringify(response)}}]});}});await new Promise(r=>server.listen(4195,'127.0.0.1',r));
  win=new BrowserWindow({width:1400,height:900,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:true}});await win.loadURL('http://127.0.0.1:4195');await js("(async()=>{const {setLanguage}=await import('/i18n.js');setLanguage('zh-CN')})()");await until("!!document.querySelector('#chatForm')?.onsubmit && !!document.querySelector('.canvas-empty') && document.querySelector('#modelStatus').textContent.includes('已配置')");
  await js("document.querySelector('#readerTab').click();const d=new DataTransfer();d.setData('text/plain','解释多头注意力输出的拼接');document.querySelector('#visualStage').dispatchEvent(new DragEvent('drop',{dataTransfer:d,bubbles:true,cancelable:true}));");await until("!!document.querySelector('#selfCheck .self-check') && !!document.querySelector('#visualStage .katex-display') && document.querySelector('#learning').getAttribute('aria-busy')==='false'");
  await measure('long-answer');
  win.setSize(1000,650);await measure('compact');
  await js("document.querySelector('.conversation-turn').open=true");await until("!!document.querySelector('.conversation-turn .reading-answer')");await measure('expanded-history');
  await js("document.querySelector('.conversation-turn').open=false;document.querySelector('#prompt').value='为什么先拼接再投影？';document.querySelector('#chatForm').requestSubmit();");await until("!!document.querySelector('.artifact-discussion') && document.querySelector('#learning').getAttribute('aria-busy')==='false'");await measure('follow-up');
  await js("[...document.querySelectorAll('#selfCheck button')].find(b=>b.textContent.includes('选择题')).click()");await until("!!document.querySelector('.quiz-option')");await measure('with-question');
  await js("document.querySelector('.quiz-option input[value=\"1\"]').checked=true;document.querySelector('.quiz-form').requestSubmit()");await until("!document.querySelector('.quiz-feedback').hidden");await measure('with-feedback');
  win.webContents.setZoomFactor(1.25);await measure('zoom-125');win.webContents.setZoomFactor(1);
  await js("document.documentElement.dataset.theme='dark';document.querySelector('#focusCanvas').click()");await measure('dark-focus');
  await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});await until("!!document.querySelector('.quiz-feedback') && !!document.querySelector('#visualStage .katex-display')");await measure('restored');
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({pass:true,requests,checks},null,2));console.log('PASS long answers, formulas, history, follow-ups, quizzes, zoom, focus and restart: no overlap.');win.destroy();server.close();app.quit();
 }).catch(async error=>{console.error(error.message);if(win&&!win.isDestroyed())await shot('failure');fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({pass:false,error:error.message,checks},null,2));win?.destroy();server?.close();app.exit(1);});
}
