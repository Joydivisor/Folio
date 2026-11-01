import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createVault} from '../desktop/ai-vault.cjs';
import {normalizeEndpoint,modelOptions} from '../public/model-providers.js';
const master=randomBytes(32);
const crypto={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async text=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master,iv);const data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);},decryptStringAsync:async bytes=>{const decipher=createDecipheriv('aes-256-gcm',master,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return {result:Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'),shouldReEncrypt:false};}};
async function fixture(run){const dir=await mkdtemp(path.join(os.tmpdir(),'folio-providers-'));try{await run(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('encrypted provider keys survive a new vault without crossing hosts or paths',()=>fixture(async dir=>{
 const a=createVault(dir,crypto);await a.save('deepseek-test-secret',true);await a.save('openai-test-secret',true,'https://api.openai.com/v1');
 for(const file of await readdir(dir))assert.ok(!(await readFile(path.join(dir,file))).includes(Buffer.from('test-secret')));
 const b=createVault(dir,crypto);assert.deepEqual(await b.load(),{configured:true,persisted:true});await b.load('https://api.openai.com/v1');assert.equal(b.config({baseUrl:'https://api.deepseek.com/v1'}).apiKey,'deepseek-test-secret');assert.equal(b.config({baseUrl:'https://api.openai.com/v1'}).apiKey,'openai-test-secret');assert.equal(b.config({baseUrl:'https://api.openai.com/other'}).apiKey,'');assert.equal(b.config({baseUrl:'https://elsewhere.test/v1'}).apiKey,'');
 await b.save('',true);await b.forget('https://api.openai.com/v1');const c=createVault(dir,crypto);assert.equal((await c.load()).configured,true);assert.equal((await c.load('https://api.openai.com/v1')).configured,false);
}));
test('legacy encrypted DeepSeek key migrates and session-only remains session-only',()=>fixture(async dir=>{
 await writeFile(path.join(dir,'deepseek-key.bin'),await crypto.encryptStringAsync('legacy-test-secret'));const a=createVault(dir,crypto);await a.load();await a.save('',true);await assert.rejects(readFile(path.join(dir,'deepseek-key.bin')));const b=createVault(dir,crypto);await b.load();assert.equal(b.config({baseUrl:'https://api.deepseek.com'}).apiKey,'legacy-test-secret');await b.save('',false);assert.equal((await createVault(dir,crypto).load()).configured,false);assert.equal(b.status().configured,true);
}));
test('failed decryption reports the problem and preserves encrypted bytes',()=>fixture(async dir=>{
 const a=createVault(dir,crypto);await a.save('test-secret',true);const name=(await readdir(dir))[0],before=await readFile(path.join(dir,name));const bad=createVault(dir,{...crypto,decryptStringAsync:async()=>{throw Error('locked');}});assert.equal((await bad.load()).error,'unlock');await assert.rejects(bad.save('',true));assert.deepEqual(await readFile(path.join(dir,name)),before);
}));
test('model discovery rejects malformed lists, excludes incompatible modalities and never guesses from keys',()=>{
 assert.equal(normalizeEndpoint('https://api.deepseek.com/v1/'),'https://api.deepseek.com');assert.throws(()=>normalizeEndpoint('https://name:secret@example.com/v1'));assert.throws(()=>normalizeEndpoint('http://remote.test/v1'));assert.equal(normalizeEndpoint('http://localhost:11434/v1/'),'http://localhost:11434/v1');
 assert.deepEqual(modelOptions({data:[{id:'gpt-6-test'},{id:'gpt-image-test'},{id:'gpt-6-test'},{id:'tts-1'},{id:'text-embedding-3'}]},'https://api.openai.com/v1').map(m=>m.id),['gpt-6-test']);assert.throws(()=>modelOptions({models:[]},'https://api.deepseek.com'));
});
