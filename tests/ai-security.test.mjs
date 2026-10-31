import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vaultModule from '../desktop/ai-vault.cjs';
import { parseGraph } from '../public/graph-schema.js';

test('stored credential cannot be redirected to another host or URL', () => {
  for (const url of ['https://evil.test','https://api.deepseek.com.evil.test','https://api.deepseek.com@evil.test','http://api.deepseek.com','https://api.deepseek.com/redirect','https://api.deepseek.com/?key=x']) assert.throws(()=>vaultModule.officialEndpoint(url));
  assert.equal(vaultModule.officialEndpoint('https://api.deepseek.com/v1/'),'https://api.deepseek.com/v1');
});
test('vault does not expose key in status; encryption failure cannot save plaintext', async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'folio-vault-'));
  const vault=vaultModule.createVault(dir,{isAsyncEncryptionAvailable:async()=>false});
  try {
    await vault.save('test-only-secret',false);
    assert.deepEqual(vault.status(),{configured:true,persisted:false});
    await assert.rejects(vault.save('test-only-secret',true));
    await assert.rejects(readFile(path.join(dir,'deepseek-key.bin')));
    await vault.forget();assert.equal(vault.status().configured,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('graph rejects duplicate IDs, missing targets and oversized output',()=>{
  const graph={title:'群',summary:'关系',nodes:[{id:'a',label:'群',detail:'定义'}],edges:[]};
  assert.equal(parseGraph(JSON.stringify(graph)).nodes.length,1);
  assert.throws(()=>parseGraph(JSON.stringify({...graph,nodes:[...graph.nodes,...graph.nodes]})));
  assert.throws(()=>parseGraph(JSON.stringify({...graph,edges:[{from:'a',to:'missing',label:'关系'}]})));
  assert.throws(()=>parseGraph('x'.repeat(40001)));
});

test('Linux plaintext fallback never persists or loads a credential', async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'folio-vault-linux-'));
 let encrypted=false,decrypted=false;
 const vault=vaultModule.createVault(dir,{getSelectedStorageBackend:()=> 'basic_text',isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async()=>{encrypted=true;return Buffer.from('weak');},decryptStringAsync:async()=>{decrypted=true;return 'secret';}});
 try{await assert.rejects(vault.save('test-only-secret',true));await vault.load();assert.equal(encrypted,false);assert.equal(decrypted,false);await vault.save('test-only-secret',false);assert.deepEqual(vault.status(),{configured:true,persisted:false});}
 finally{await rm(dir,{recursive:true,force:true});}
});
