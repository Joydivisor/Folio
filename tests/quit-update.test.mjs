import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import crypto from 'node:crypto';
import {createUpdateController} from '../desktop/updates.cjs';
import unix from '../desktop/unix-updater.cjs';
import {signUpdate} from '../scripts/sign-update-feeds.mjs';

test('one Help action joins an ongoing background check and waits for download on an ordinary quit',async()=>{
  const updater=new EventEmitter(),installArgs=[],counts={check:0,download:0,flush:0};
  let finishCheck,finishDownload;
  updater.checkForUpdates=()=>{counts.check++;return new Promise(resolve=>{finishCheck=()=>{updater.emit('update-available',{version:'2.0.0'});resolve();};});};
  updater.downloadUpdate=()=>{counts.download++;return new Promise(resolve=>{finishDownload=()=>{updater.emit('update-downloaded',{version:'2.0.0'});resolve();};});};
  updater.quitAndInstall=(...args)=>installArgs.push(args);
  const update=createUpdateController({updater,version:'1.0.7',beforeInstall:async()=>{counts.flush++;}});
  const background=update.check();
  assert.equal(update.shouldWaitOnQuit(),false);
  const a=update.prepare(),b=update.prepare();
  assert.equal(update.shouldWaitOnQuit(),true);
  const quit=update.install(false),duplicate=update.install(false);
  await new Promise(r=>setImmediate(r)); finishCheck(); await background;
  await new Promise(r=>setImmediate(r));assert.equal(update.getState().status,'downloading');
  assert.deepEqual(installArgs,[]);finishDownload();await Promise.all([a,b,quit,duplicate]);
  assert.deepEqual(counts,{check:1,download:1,flush:1});assert.deepEqual(installArgs,[[true,false]]);
});

test('offline or current checks release an ordinary exit and errors remain retryable',async()=>{
  const updater=new EventEmitter();
  const update=createUpdateController({updater,version:'1.0.7'});
  updater.checkForUpdates=async()=>{throw Error('offline');};
  assert.equal((await update.prepare()).error,'check');assert.equal(update.shouldWaitOnQuit(),false);
  updater.checkForUpdates=async()=>updater.emit('update-not-available');
  assert.equal((await update.prepare()).status,'current');assert.equal(update.shouldWaitOnQuit(),false);
});

test('cancelling system authorization keeps the staged package available for the next quit',async()=>{
  const updater=new EventEmitter();let attempts=0;
  updater.checkForUpdates=async()=>updater.emit('update-available',{version:'2.0.0'});
  updater.downloadUpdate=async()=>updater.emit('update-downloaded',{version:'2.0.0'});
  updater.quitAndInstall=async()=>{if(!attempts++)throw Object.assign(Error('cancel'),{code:'FOLIO_CANCELLED'});};
  const update=createUpdateController({updater,version:'1.0.7'});
  await update.prepare();assert.equal((await update.install(false)).error,'cancelled');
  assert.equal(update.getState().status,'downloaded');
  assert.equal((await update.install(false)).status,'installing');assert.equal(attempts,2);
});

test('updates are limited to the installed architecture, official package and a newer stable version',async()=>{
  assert.equal(unix.unixInstallLocation('darwin','/Users/demo/Applications/Folio.app/Contents/MacOS/Folio'),'/Users/demo/Applications/Folio.app');
  for(const exe of ['/Volumes/Folio/Folio.app/Contents/MacOS/Folio','/private/var/AppTranslocation/R/Folio.app/Contents/MacOS/Folio'])assert.equal(unix.unixInstallLocation('darwin',exe),null);
  assert.equal(unix.unixInstallLocation('linux','/opt/Folio/Folio'),'/opt/Folio');
  assert.equal(unix.unixInstallLocation('linux','/tmp/Folio'),null);
  const mock=v=>({version:v,downloads:[{id:'linux-x64',sizeBytes:5,sha256:'a'.repeat(64),url:'https://github.com/Joydivisor/Folio/releases/download/v'+v+'/wrong.deb'}]});
  const updater=new unix.UnixUpdater({platform:'linux',arch:'x64',version:'1.0.7',fetch:async()=>Response.json(mock('1.0.8'))});
  await assert.rejects(updater.checkForUpdates(),/platform download/);
  updater.fetch=async()=>Response.json(mock('1.0.9-beta.1'));
  let current=false;updater.on('update-not-available',()=>{current=true;});
  await updater.checkForUpdates();assert.ok(current);assert.equal(updater.latest,null);
});

test('macOS archive signatures and Debian signed metadata reject any change to the release',()=>{
  const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
  const bytes=Buffer.from('native fixture'),version='1.0.8',base='https://github.com/Joydivisor/Folio/releases/download/v1.0.8/';
  for(const id of ['mac-x64','mac-arm64']){
    const {name,content}=signUpdate({version,id,bytes,key:privateKey,base});assert.equal(name,'appcast-'+id+'.xml');
    const signature=Buffer.from(content.match(/edSignature="([^"]+)"/)[1],'base64');
    assert.ok(crypto.verify(null,bytes,publicKey,signature));assert.ok(!crypto.verify(null,Buffer.from('wrong'),publicKey,signature));
    assert.ok(content.includes(base+'Folio-'+version+'-'+id+'.dmg'));assert.ok(content.includes('length="'+bytes.length+'"'));
  }
  const signature=Buffer.from(signUpdate({version,id:'linux-x64',bytes,key:privateKey,base}).content.trim(),'base64'),sha=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.ok(crypto.verify(null,unix.debStatement(version,bytes.length,sha),publicKey,signature));
  assert.ok(!crypto.verify(null,unix.debStatement('1.0.9',bytes.length,sha),publicKey,signature));
});
