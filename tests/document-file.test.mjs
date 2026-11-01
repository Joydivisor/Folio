import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotFile,readDocumentFile,fileReadMessage} from '../public/document-file.js';

test('import owns bytes after external file permission expires',async()=>{
 let valid=true,reads=0;
 const external={name:'paper.pdf',type:'application/pdf',lastModified:123,arrayBuffer:async()=>{reads++;if(!valid)throw new DOMException('expired','NotReadableError');return new TextEncoder().encode('paper bytes').buffer;}};
 const copy=await snapshotFile(external);valid=false;
 assert.equal(await copy.text(),'paper bytes');
 assert.equal(await (await readDocumentFile({blob:copy})).text(),'paper bytes');
 assert.equal(reads,1);assert.equal(copy.lastModified,123);
});
test('reading asks only for read permission before getting bytes',async()=>{
 const calls=[];const handle={queryPermission:async o=>{calls.push(['query',o.mode]);return 'prompt';},requestPermission:async o=>{calls.push(['request',o.mode]);return 'granted';},getFile:async()=>{calls.push(['get']);return new File(['ok'],'a.txt');}};
 assert.equal(await (await readDocumentFile({handle})).text(),'ok');
 assert.deepEqual(calls,[['query','read'],['request','read'],['get']]);
});
test('stale disk snapshot is reacquired once; repeated failure terminates',async()=>{
 let reads=0;
 const stale={arrayBuffer:async()=>{throw new DOMException('changed','NotReadableError');}};
 assert.equal(await (await readDocumentFile({handle:{getFile:async()=>++reads===1?stale:new File(['fresh'],'a.txt')}})).text(),'fresh');
 assert.equal(reads,2);reads=0;
 await assert.rejects(readDocumentFile({handle:{getFile:async()=>{reads++;return stale;}}}),{name:'NotReadableError'});assert.equal(reads,2);
});
test('denied or missing files never become successful imports',async()=>{
 let reads=0;
 await assert.rejects(readDocumentFile({handle:{queryPermission:async()=> 'denied',requestPermission:async()=> 'denied',getFile:async()=>reads++}}),{name:'NotAllowedError'});
 assert.equal(reads,0);
 await assert.rejects(snapshotFile(null),{name:'NotFoundError'});
 assert.match(fileReadMessage({name:'NotReadableError'},true),/Download cloud files/);
});
