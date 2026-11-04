import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {installFilePermissions} from '../desktop/file-permissions.cjs';
import {scanDirectory,restoredCatalog} from '../public/library-folder.js';

test('desktop restores only Folio file-handle reads, then returns to native user-gesture permissions',()=>{
 let check,request;
 const main={isDestroyed:()=>false,getURL:()=> 'http://127.0.0.1:4174/'};
 const session={setPermissionCheckHandler:fn=>check=fn,setPermissionRequestHandler:fn=>request=fn};
 const finish=installFilePermissions(session,{origin:'http://127.0.0.1:4174',getWebContents:()=>main});
 const directory=path.resolve('fixture-library'),details={filePath:directory,fileAccessType:'readable',isDirectory:true,isMainFrame:false};
 assert.equal(check(null,'fileSystem','http://127.0.0.1:4174/',details),true);
 for(const origin of ['https://evil.example','http://127.0.0.1:4173/','http://user@127.0.0.1:4174/','invalid'])assert.equal(check(null,'fileSystem',origin,details),false);
 assert.equal(check({},'fileSystem',main.getURL(),details),false);
 assert.equal(check(null,'media',main.getURL(),details),false);
 assert.equal(check(null,'fileSystem',main.getURL(),{...details,filePath:'relative'}),false);
 const write={...details,fileAccessType:'writable',requestingUrl:main.getURL()};
 assert.equal(check(null,'fileSystem',main.getURL(),write),false);
 let allowed;
 request(main,'fileSystem',value=>allowed=value,write);assert.equal(allowed,true);
 assert.equal(check(null,'fileSystem',main.getURL(),{...write,filePath:path.join(directory,'paper.txt')}),false);
 assert.equal(check(null,'fileSystem',main.getURL(),{...write,filePath:directory+'-other/paper.txt'}),false);
 request(main,'fileSystem',value=>allowed=value,{...write,requestingUrl:'https://evil.example'});assert.equal(allowed,false);
 finish();assert.equal(check,null);
});

test('saved folder catalogs are bound to folder identity, including same-name folders',async()=>{
 const folder={isSameEntry:async other=>other===folder};
 const entries=[{id:'folder:library:a.pdf',name:'a.pdf',path:'a.pdf',handle:{kind:'file'}}];
 assert.equal((await restoredCatalog(folder,{version:1,folder,entries})).length,1);
 assert.deepEqual(await restoredCatalog(folder,{version:1,folder:{name:'library'},entries}),[]);
 assert.deepEqual(await restoredCatalog(folder,null),[]);
 assert.deepEqual(await restoredCatalog({isSameEntry:async()=>{throw Error('offline');}},{version:1,folder,entries}),[]);
});

test('directory scans preserve document IDs, ignore hidden files and enforce a bounded catalog',async()=>{
 const file={kind:'file'},nested={kind:'directory',async *entries(){yield ['b.pdf',file];}};
 const folder={name:'library',async *entries(){yield ['.hidden.pdf',file];yield ['notes.txt',file];yield ['nested',nested];yield ['image.png',file];}};
 const result=await scanDirectory(folder,name=>/\.(pdf|txt)$/.test(name));
 assert.deepEqual(result.map(e=>e.id),['folder:library:nested/b.pdf','folder:library:notes.txt']);
 await assert.rejects(scanDirectory(folder,name=>/\.(pdf|txt)$/.test(name),1),/2000/);
});
