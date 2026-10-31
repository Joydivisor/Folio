import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {packager} from '@electron/packager';
import {getRawHeader,extractFile} from '@electron/asar';
const root=process.cwd(),platform=process.platform,arch=process.arch;
if(!['darwin','linux'].includes(platform))throw Error('Build on macOS or Linux.');
const {version}=JSON.parse(fs.readFileSync('package.json','utf8'));
const out=path.join(root,'dist','v'+version),release=path.join(root,'releases');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(release,{recursive:true});
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit'});
let icon=path.join(root,'build','folio.png');
if(platform==='darwin'){
 const set=path.join(out,'Folio.iconset');fs.mkdirSync(set,{recursive:true});
 for(const n of [16,32,128,256,512])for(const factor of [1,2])run('sips',['-z',String(n*factor),String(n*factor),icon,'--out',path.join(set,`icon_${n}x${n}${factor===2?'@2x':''}.png`)]);
 icon=path.join(out,'folio.icns');run('iconutil',['-c','icns',set,'-o',icon]);
}
const [folder]=await packager({dir:root,out,name:'Folio',executableName:'Folio',platform,arch,icon,overwrite:true,prune:true,asar:true,appBundleId:'app.getfolio.desktop',appCategoryType:'public.app-category.education',darwinDarkModeSupport:true,
 ignore:[/^\/(?!(?:public|desktop|node_modules|build)(?:\/|$)|(?:package\.json|server\.mjs)$).+/]});
const app=path.join(folder,'Folio.app'),resources=platform==='darwin'?path.join(app,'Contents','Resources'):path.join(folder,'resources');
const archive=path.join(resources,'app.asar'),header=getRawHeader(archive).header;
const allowed=new Set(['public','desktop','node_modules','build','package.json','server.mjs']);
if(Object.keys(header.files).some(k=>!allowed.has(k)))throw Error('Unexpected packaged files');
let count=0;
function audit(files,base=''){for(const [n,e] of Object.entries(files)){const p=path.join(base,n);if(e.files)audit(e.files,p);else{count++;if(!p.startsWith('node_modules')){const s=extractFile(archive,p).toString();if(/(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(s))throw Error('Credential pattern in runtime');}}}}
audit(header.files);
fs.writeFileSync(path.join(out,'package-audit.json'),JSON.stringify({platform,arch,version,files:count,topLevel:Object.keys(header.files)},null,2));
if(platform==='darwin'){
 // Ad-hoc signing makes the Apple Silicon binary structurally valid; it is NOT Developer ID signing or notarization.
 run('codesign',['--force','--deep','--sign','-',app]);run('codesign',['--verify','--deep','--strict',app]);
 const stage=path.join(out,'dmg');fs.mkdirSync(stage,{recursive:true});
 run('ditto',[app,path.join(stage,'Folio.app')]);fs.symlinkSync('/Applications',path.join(stage,'Applications'));
 run('hdiutil',['create','-volname','Folio','-srcfolder',stage,'-ov','-format','UDZO',path.join(release,`Folio-${version}-mac-${arch}.dmg`)]);
}else{
 if(arch!=='x64')throw Error('Only Linux x64 is supported in this release');
 const stage=path.join(out,'deb'),install=path.join(stage,'opt','Folio');fs.mkdirSync(path.dirname(install),{recursive:true});fs.cpSync(folder,install,{recursive:true});
 fs.chmodSync(path.join(install,'chrome-sandbox'),0o4755);
 const control=path.join(stage,'DEBIAN');fs.mkdirSync(control,{recursive:true});
 fs.writeFileSync(path.join(control,'control'),`Package: folio\nVersion: ${version.replace('-beta.','~beta.')}\nArchitecture: amd64\nMaintainer: Folio <noreply@getfolio.pages.dev>\nSection: education\nPriority: optional\nDepends: libc6 (>= 2.35), libgtk-3-0, libnss3, libasound2 | libasound2t64, libgbm1, libxss1, libxtst6, libatspi2.0-0, libdrm2\nHomepage: https://getfolio.pages.dev/\nDescription: Local-first interactive reading workspace\n Read documents, annotate and explore concepts with your own AI service.\n`);
 const applications=path.join(stage,'usr','share','applications'),icons=path.join(stage,'usr','share','icons','hicolor','512x512','apps');fs.mkdirSync(applications,{recursive:true});fs.mkdirSync(icons,{recursive:true});
 fs.copyFileSync(icon,path.join(icons,'folio.png'));
 fs.writeFileSync(path.join(applications,'folio.desktop'),'[Desktop Entry]\nName=Folio\nComment=Interactive reading workspace\nExec=/opt/Folio/Folio\nIcon=folio\nTerminal=false\nType=Application\nCategories=Education;Office;\nStartupWMClass=Folio\n');
 run('dpkg-deb',['--root-owner-group','--build',stage,path.join(release,`Folio-${version}-linux-x64.deb`)]);
}
fs.writeFileSync(path.join(out,'runtime-path.txt'),platform==='darwin'?path.join(app,'Contents','MacOS','Folio'):path.join(folder,'Folio'));
