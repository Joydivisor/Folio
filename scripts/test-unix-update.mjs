// Native integration exercise on disposable GitHub-hosted runners. Only the
// fixture ASAR points at localhost or uses the runner's preauthorized sudo.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFile, execFileSync, spawnSync} from 'node:child_process';
import {promisify} from 'node:util';
import {createPackageWithOptions, extractAll, extractFile, getRawHeader, uncache} from '@electron/asar';
import {signUpdate} from './sign-update-feeds.mjs';
import unix from '../desktop/unix-updater.cjs';

const mac = process.platform === 'darwin';
if (!['linux','darwin'].includes(process.platform) || process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') throw Error('This test installs a fixture only on disposable GitHub-hosted runners.');
const root = process.cwd(), version = JSON.parse(fs.readFileSync('package.json')).version;
const next = version.replace(/\d+$/, s => String(Number(s) + 1)), id = mac ? 'mac-' + process.arch : 'linux-x64';
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-upgrade-')), profile = path.join(scratch,'profile'), resultFile = path.join(scratch,'result.json');
const feed = path.join(scratch, 'feed'), contents = path.join(scratch, 'asar-source'), stage = path.join(scratch, 'stage');
for (const dir of [feed, stage]) fs.mkdirSync(dir);
const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
const raw = Buffer.from(publicKey.export({format:'jwk'}).x,'base64url').toString('base64');
const run = (file,args) => execFileSync(file,args,{stdio:'inherit'});
const server = http.createServer((req,res) => {
  const file = path.join(feed,path.basename(new URL(req.url,'http://localhost').pathname));
  if (!fs.existsSync(file)) {res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Length':fs.statSync(file).size});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const local = 'http://127.0.0.1:' + server.address().port + '/';
const target = mac ? path.join(scratch,'Applications/Folio.app') : '/opt/Folio';
const installedArchive = path.join(target,mac?'Contents/Resources/app.asar':'resources/app.asar');
const executable = path.join(target, mac?'Contents/MacOS/Folio':'Folio');
const runtime = fs.readFileSync(path.join('dist','v'+version,'runtime-path.txt'),'utf8').trim();
const fileName = v => 'Folio-' + v + '-' + id + (mac?'.dmg':'.deb');
const app = path.join(stage,'Folio.app'), deb = path.join(stage,'deb');
const archive = mac ? path.join(app,'Contents/Resources/app.asar') : path.join(deb,'opt/Folio/resources/app.asar');
function replace(file, old, updated) {
  const src=fs.readFileSync(file,'utf8');
  assert.ok(src.includes(old),'fixture marker: '+old);
  fs.writeFileSync(file,src.replace(old,updated));
}
try {
  if (mac) {
    run('/usr/bin/ditto',[path.resolve(runtime,'../../..'),app]);
    fs.mkdirSync(path.dirname(target));
    run('/usr/bin/plutil',['-replace','CFBundleIdentifier','-string','app.getfolio.desktop.updatetest',path.join(app,'Contents/Info.plist')]);
    run('/usr/bin/plutil',['-replace','SUPublicEDKey','-string',raw,path.join(app,'Contents/Info.plist')]);
  } else {
    run('dpkg-deb',['-R',path.join('releases',fileName(version)),deb]);
    fs.writeFileSync(path.join(deb,'usr/share/folio/update-public.pem'),unix.publicKey(raw).export({type:'spki',format:'pem'}));
  }
  extractAll(archive,contents);
  const main=path.join(contents,'desktop/main.cjs'), updates=path.join(contents,'desktop/updates.cjs'), adapter=path.join(contents,'desktop/unix-updater.cjs');
  replace(main,'const PORT = 4174;','const PORT = 4196;');
  replace(updates,"fetch: require('electron').net.fetch","fetch: (url, options) => require('electron').net.fetch("+JSON.stringify(local)+" + new URL(url).pathname.split('/').pop(), options)");
  replace(adapter,"target.base + 'appcast-mac-'",JSON.stringify(local)+" + 'appcast-mac-'");
  replace(adapter,"'/usr/bin/pkexec', ['--disable-internal-agent',","'/usr/bin/sudo', ['-n', '/usr/bin/pkexec', '--disable-internal-agent',");
  replace(adapter,"throw error;\n      }\n    } else {","console.error('Sparkle update:',error.message); throw error;\n      }\n    } else {");
  fs.writeFileSync(path.join(contents,'desktop/update-public-key.json'),JSON.stringify(raw));
  fs.copyFileSync('scripts/update-fixture.cjs',path.join(contents,'desktop/update-fixture.cjs'));
  fs.writeFileSync(path.join(contents,'desktop/update-test-config.json'),JSON.stringify({profile,resultFile,initial:version}));
  for (const v of [version,next]) {
    const pkg=path.join(contents,'package.json'), metadata=JSON.parse(fs.readFileSync(pkg));
    fs.writeFileSync(pkg,JSON.stringify({...metadata,version:v,main:'desktop/update-fixture.cjs'}));
    await createPackageWithOptions(contents,archive,{dot:true});
    if (mac) {
      const plist=path.join(app,'Contents/Info.plist');
      for (const field of ['CFBundleVersion','CFBundleShortVersionString']) run('/usr/bin/plutil',['-replace',field,'-string',v,plist]);
      const sum=crypto.createHash('sha256').update(getRawHeader(archive).headerString).digest('hex');
      // Electron Packager uses a dictionary whose archive key contains a literal dot.
      execFileSync('/usr/libexec/PlistBuddy',['-c','Set :ElectronAsarIntegrity:Resources/app.asar:hash '+sum,plist],{stdio:'pipe'});
      run('/usr/bin/codesign',['--force','--deep','--sign','-',app]);
      if(v===version) run('/usr/bin/ditto',[app,target]);
      else run('/usr/bin/hdiutil',['create','-volname','Folio Update Test','-srcfolder',stage,'-format','UDZO','-imagekey','zlib-level=1',path.join(feed,fileName(v))]);
    } else {
      if(v===next) replace(path.join(deb,'DEBIAN/control'),'Version: '+version,'Version: '+next);
      const built=path.join(feed,fileName(v));
      run('dpkg-deb',['-Zgzip','-z1','--root-owner-group','--build',deb,built]);
      if(v===version) run('/usr/bin/sudo',['-n','/usr/bin/dpkg','--install',built]);
    }
  }
  const bytes=fs.readFileSync(path.join(feed,fileName(next)));
  const signed=signUpdate({version:next,id,bytes,key:privateKey,base:local});
  fs.writeFileSync(path.join(feed,signed.name),signed.content);
  if (!mac) {
    const sha=crypto.createHash('sha256').update(bytes).digest('hex');
    const corrupt=spawnSync('/usr/bin/sudo',['-n','/usr/lib/folio/install-update',next,String(bytes.length),sha,signed.content.trim()],{input:Buffer.from('truncated download')});
    assert.equal(corrupt.status,65,'system installer must reject a corrupted DEB');
  }
  fs.writeFileSync(path.join(feed,'release.json'),JSON.stringify({version:next,downloads:[{id,url:'https://github.com/Joydivisor/Folio/releases/download/v'+next+'/'+fileName(next),sizeBytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]}));
  const launch=async()=>{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    try {await promisify(execFile)(executable,[],{env,timeout:180000,maxBuffer:1024*1024});}
    catch(e){console.error(e.stdout,e.stderr);throw Error(fs.existsSync(resultFile)?fs.readFileSync(resultFile,'utf8'):e.message);}
  };
  await launch();
  assert.ok(fs.existsSync(resultFile+'.quit'),'old app must have issued an ordinary close');
  const deadline=Date.now()+120000;
  while(true){
    let v;try{uncache(installedArchive);v=JSON.parse(extractFile(installedArchive,'package.json')).version;}catch{}
    if(v===next)break;
    if(Date.now()>deadline)throw Error('Normal quit did not replace installed app');
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  await launch();
  const result=JSON.parse(fs.readFileSync(resultFile));assert.equal(result.to,next);assert.equal(result.passed,true);
  fs.mkdirSync('tests/reports',{recursive:true});
  fs.writeFileSync('tests/reports/update-install-'+id+'.json',JSON.stringify({...result,platform:id,systemAuthorization:mac?'user-writable test Applications folder':'preauthorized GitHub runner'},null,2));
  console.log('PASS native one-click update, ordinary close, manual reopen and retained workspace:',id);
} finally {
  server.close();server.closeAllConnections();
  if (!mac) run('/usr/bin/sudo',['-n','/usr/bin/apt-get','remove','-y','folio']);
}
