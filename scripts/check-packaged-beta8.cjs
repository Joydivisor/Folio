// Run using the packaged Electron's Node mode; does not touch the user's profile.
const path=require('node:path'),fs=require('node:fs');
(async()=>{
 const archive=path.resolve('dist/v1.0.0-beta.8/Folio-win32-x64/resources/app.asar');
 const {makeServer}=await import(require('node:url').pathToFileURL(path.join(archive,'server.mjs')).href);
 const port=4194,server=makeServer({port}),checks=[];
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 try{
  for(const route of ['/','/app.js','/artifact-workspace.js','/reading-response.js','/reading-intent.js','/learning-actions.js','/learning-upgrade.css','/study-note.js','/study-note-dialog.js','/note-renderer.js','/note-vendor/markdown.js','/note-vendor/fflate.js','/katex/katex.mjs','/katex/contrib/auto-render.mjs']){
   const r=await fetch('http://127.0.0.1:'+port+route),bytes=(await r.arrayBuffer()).byteLength;if(!r.ok||!bytes)throw Error('Missing packaged asset: '+route);checks.push({route,status:r.status,bytes});
  }
  const version=await(await fetch('http://127.0.0.1:'+port+'/api/version')).json();if(version.version!=='1.0.0-beta.8')throw Error('Wrong packaged version');
  const status=await(await fetch('http://127.0.0.1:'+port+'/api/status')).json();if(status.configured)throw Error('Fresh package includes a key');
  fs.writeFileSync('tests/reports/beta8-packaged-runtime.json',JSON.stringify({version:version.version,checks,emptyCredential:true},null,2));
  console.log('Packaged runtime: '+checks.length+' routes passed; no configured key.');
 }finally{server.close();server.closeAllConnections();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
