const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
(async()=>{
 const version=JSON.parse(fs.readFileSync('package.json')).version;
 const archive=process.env.FOLIO_TEST_ARCHIVE||path.resolve('dist','v'+version,'Folio-win32-x64/resources/app.asar');
 const asar=require('@electron/asar');
 const files=asar.listPackage(archive);const allowed=new Set(['public','desktop','node_modules','build','package.json','server.mjs']);
 if(files.some(f=>!allowed.has(f.split(/[\\/]/).filter(Boolean)[0])))throw Error('Unexpected package root');
 for(const file of ['public/app.js','public/document-file.js','public/pdf-selection.js','public/reflow-layout.js','public/reflow-view.js','public/reflow.css','public/workspace-manager.js','public/annotations.js']){
  if(!asar.extractFile(archive,file).equals(fs.readFileSync(file)))throw Error('Stale packaged file: '+file);
 }
 for(const file of files.filter(f=>/^[/\\](public|desktop)[/\\].*\.(js|cjs|mjs|json|html)$/.test(f))){const text=asar.extractFile(archive,file.replace(/^[/\\]/,'')).toString();if(/(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,}/.test(text))throw Error('Credential pattern in runtime');}
 const {makeServer}=await import(pathToFileURL(path.join(archive,'server.mjs')).href),port=4197,server=makeServer({port});await new Promise(r=>server.listen(port,'127.0.0.1',r));
 try{for(const route of ['/','/document-file.js','/pdf-selection.js','/reflow-layout.js','/reflow-view.js','/reflow.css']){const r=await fetch('http://127.0.0.1:'+port+route);if(!r.ok||!(await r.text()).length)throw Error('Missing route '+route);}const status=await(await fetch('http://127.0.0.1:'+port+'/api/status')).json();if(status.configured)throw Error('Fresh runtime contains a key');console.log('PASS packaged byte parity, allowlist, credential scan, runtime assets and empty key.');}finally{server.close();server.closeAllConnections();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
