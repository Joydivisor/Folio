// Uses locally downloaded, provenance-recorded public scans; never calls a model API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'tests/reports/real-scans');
if(!process.versions.electron){const cp=require('node:child_process'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const r=cp.spawnSync(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true,timeout:300000});process.exit(r.status??1);}
else{
 const {app,BrowserWindow}=require('electron'),{pathToFileURL}=require('node:url');app.disableHardwareAcceleration();app.setPath('userData',fs.mkdtempSync(path.join(folder,'profile-')));let win,server;
 app.whenReady().then(async()=>{
  const {makeServer}=await import(pathToFileURL(path.join(process.env.FOLIO_TEST_ARCHIVE||root,'server.mjs')).href);server=makeServer({port:4197,fetchImpl:()=>{throw Error('No external APIs allowed');}});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4197,'127.0.0.1',resolve)});
  win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,offscreen:true}});await win.loadURL('http://127.0.0.1:4197');
  const results=[];for(const sample of JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')))){
   const data=fs.readFileSync(sample.file).toString('base64');console.log('OCR '+sample.id+' ('+sample.pages+' pages)');
   const records=await win.webContents.executeJavaScript(`(async()=>{const m=await import('/pdf-ocr.js'),pdfjs=await import('/vendor/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/build/pdf.worker.mjs';const pdf=await pdfjs.getDocument({data:Uint8Array.from(atob(${JSON.stringify(data)}),c=>c.charCodeAt(0)),wasmUrl:'/vendor/wasm/',cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/'}).promise;const cache=new Map(),store={get:async(t,id)=>cache.get(id),put:async(t,v)=>cache.set(v.id,v)},ocr=m.createPDFOCR({pdf,entry:{id:${JSON.stringify(sample.id)},revision:'real-scan'},store}),records=[];try{for(let page=1;page<=pdf.numPages;page++){const native=await(await pdf.getPage(page)).getTextContent();if(native.items.some(i=>i.str.trim()))throw Error('Fixture has a text layer');const started=performance.now(),r=await ocr.recognize(page);records.push({...r,seconds:(performance.now()-started)/1000});if((await ocr.recognize(page)).text!==r.text)throw Error('Cache changed');}}finally{ocr.destroy();await pdf.cleanup();}return records})()`);
   for(const r of records){assert.ok(r.text.trim().length>20,sample.id+' empty page '+r.page);assert.ok(r.words.length>10);assert.ok(r.words.every(w=>w.rect.every(Number.isFinite)&&w.rect[0]>=0&&w.rect[1]>=0&&w.rect[0]+w.rect[2]<=1.00001&&w.rect[1]+w.rect[3]<=1.00001));console.log(sample.id+' page '+sample.sourcePages[r.page-1]+': '+r.text.length+' chars, '+r.confidence.toFixed(1)+' confidence, '+r.seconds.toFixed(1)+'s');}
   results.push({...sample,records});fs.writeFileSync(path.join(folder,'ocr-results.json'),JSON.stringify(results,null,2));
  }
  console.log('PASS image-only input, OCR text/word boxes and cache for '+results.reduce((n,r)=>n+r.pages,0)+' real scan pages. Accuracy is scored separately against manually checked passages.');win.destroy();server.close();app.quit();
 }).catch(e=>{console.error(e);win?.destroy();server?.close();app.exit(1);});
}
