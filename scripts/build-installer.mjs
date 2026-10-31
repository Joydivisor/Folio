import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {version}=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const payload=path.join(root,'dist',`v${version}`,'Folio-win32-x64');
const output=path.join(root,'releases',`Folio-Setup-${version}-win-x64.exe`);
const generated=path.join(root,'dist',`v${version}`,'installer');
const compiler=process.env.NSIS_EXE||path.join(root,'.installer-cache','nsis-3.13','makensis.exe');
if(!fs.existsSync(compiler))throw Error('NSIS 3.13 is required. Set NSIS_EXE to makensis.exe or unpack the official portable distribution into .installer-cache.');
if(!fs.existsSync(path.join(payload,'Folio.exe')))throw Error('Run npm run package:win first.');
fs.mkdirSync(generated,{recursive:true});fs.mkdirSync(path.dirname(output),{recursive:true});
const files=[],dirs=[];
function walk(base=''){
 for(const entry of fs.readdirSync(path.join(payload,base),{withFileTypes:true})){
  const relative=path.join(base,entry.name);
  if(entry.isSymbolicLink())throw Error('Symlinks are not permitted in the installer payload.');
  if(entry.isDirectory()){dirs.push(relative);walk(relative);}else files.push(relative);
 }
}
walk();
// NSIS source values: prevent paths or filenames from becoming script syntax.
const quote=value=>String(value).replaceAll('$','$$').replaceAll('"','$\\"');
const sizes=files.reduce((n,f)=>n+fs.statSync(path.join(payload,f)).size,0);
const parts=version.match(/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/);
if(!parts)throw Error('Unsupported installer version format');
const constants={APP_VERSION:version,NUMERIC_VERSION:parts.slice(1).map(n=>n||'0').join('.'),PAYLOAD_DIR:payload,APP_ICON:path.join(root,'build','folio.ico'),INSTALLER_OUTPUT:output};
fs.writeFileSync(path.join(generated,'build-info.nsh'),Object.entries(constants).map(([k,v])=>`!define ${k} "${quote(v)}"`).join('\n')+`\n!define INSTALLED_KB ${Math.ceil(sizes/1024)}\n`);
fs.writeFileSync(path.join(generated,'uninstall-files.nsh'),files.map(f=>`Delete "$INSTDIR\\${quote(f)}"`).concat(dirs.sort((a,b)=>b.split(path.sep).length-a.split(path.sep).length).map(d=>`RMDir "$INSTDIR\\${quote(d)}"`)).join('\n')+'\n');
const result=spawnSync(compiler,['/V2','/INPUTCHARSET','UTF8',`/X!addincludedir "${generated}"`,path.join(root,'installer','folio.nsi')],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
console.log(output);
