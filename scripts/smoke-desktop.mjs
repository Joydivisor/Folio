// Run on a disposable CI runner. Starts the real packaged application with a fresh profile.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
const {version,folioRevision:revision='r0'}=JSON.parse(fs.readFileSync('package.json'));
const out=path.resolve('dist','v'+version);
const executable=process.env.FOLIO_SMOKE_EXECUTABLE||fs.readFileSync(path.join(out,'runtime-path.txt'),'utf8');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'folio-smoke-'));
const child=spawn(executable,[`--user-data-dir=${profile}`],{stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env}});
let log='',failure;child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);child.on('error',e=>failure=e);
const checks=[];
try{
 const deadline=Date.now()+45000;
 while(!log.includes('Folio window ready')){
  if(failure)throw failure;if(child.exitCode!==null)throw Error('App exited before window loaded');
  if(Date.now()>deadline)throw Error('Window load timed out');
  await new Promise(r=>setTimeout(r,250));
 }
 const installed=await (await fetch('http://127.0.0.1:4174/api/version')).json();
 if(installed.version!==version||installed.revision!==revision)throw Error('Unexpected installed version or revision');
 for(const p of ['/library-folder.js','/controls.css','/segmented-control.js','/','/app.js','/icons.js','/vendor/build/pdf.mjs','/katex/katex.min.js','/workspace-store.js','/artifact-workspace.js','/reader-navigation.js','/ocr/tesseract.min.js','/ocr/worker.min.js','/ocr-core/tesseract-core.wasm.js','/ocr-data/eng.traineddata.gz','/ocr-data/chi_sim.traineddata.gz','/document-file.js','/import-permission.js','/pdf-selection.js','/selection-handles.js','/feature-guide.js','/feature-guide.css','/library-organization.js','/library-organization.css','/collections-ui.js','/library-items-ui.js','/reflow-layout.js','/reflow-view.js','/reflow.css','/learning-actions.js','/reading-intent.js','/reading-response.js','/study-note.js','/study-note-dialog.js','/learning-upgrade.css','/note-vendor/markdown.js','/note-vendor/fflate.js','/katex/katex.mjs','/continuous-reader.js','/artifact-renderer.js','/artifact-edits.js','/anatomy-plan.js','/anatomy-view.js','/vendor/anatomy/iso-kit.mjs','/diagram-plan.js','/geometry-model.js','/geometry-view.js','/beta10.css']){
  const r=await fetch('http://127.0.0.1:4174'+p),bytes=(await r.arrayBuffer()).byteLength;
  if(r.status!==200||!bytes)throw Error('Runtime asset failed: '+p);checks.push({path:p,status:r.status,bytes});
 }
 fs.writeFileSync(path.join(out,'runtime-smoke.json'),JSON.stringify({platform:process.platform,arch:process.arch,version,revision,executable:path.resolve(executable),isolatedProfile:true,windowLoaded:true,checks},null,2));
 console.log('Packaged application opened and all assets loaded.');
}catch(e){console.error(log);throw e;}finally{child.kill('SIGTERM');}
