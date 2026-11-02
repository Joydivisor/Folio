import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseImportDestination} from '../public/import-permission.js';

test('standalone file imports never ask for unrelated directory permission',async()=>{
 assert.deepEqual(await chooseImportDestination(null,()=>{throw Error('Unexpected prompt');}),{kind:'local'});
});
test('existing write permission imports to the same folder without another permission request',async()=>{
 const calls=[];
 const handle={queryPermission:async options=>{calls.push(options);return 'granted';},requestPermission:()=>{throw Error('No user activation');}};
 assert.deepEqual(await chooseImportDestination(handle,()=>{throw Error('Unexpected prompt');}),{kind:'folder',handle});
 assert.deepEqual(calls,[{mode:'readwrite'}]);
});
test('read-only or expired folder access defers authorization to an explicit user choice',async()=>{
 for(const permission of ['prompt','denied','expired']){
  const handle={queryPermission:async()=>{if(permission==='expired')throw new DOMException('expired','SecurityError');return permission;},requestPermission:()=>{throw Error('User activation is required');}};
  let choices=0;
  const destination=await chooseImportDestination(handle,async selected=>{assert.equal(selected,handle);choices++;return {kind:'local'};});
  assert.deepEqual(destination,{kind:'local'});assert.equal(choices,1);
 }
});
test('cancelling folder authorization never silently imports somewhere else',async()=>{
 const handle={queryPermission:async()=> 'prompt',requestPermission:()=>{throw Error('No user activation');}};
 assert.equal(await chooseImportDestination(handle,async()=>null),null);
});
