import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCredential} from '../public/credential-input.js';
import {contextBelongsToSource} from '../public/selection-source.js';
import {permutationPower,validatePermutationSnapshot} from '../public/permutation-state.js';
test('explicit paste extracts one key without selecting a provider or accepting ambiguity',()=>{
 const key='sk-'+ 'a'.repeat(32),other='sk-'+'b'.repeat(32);
 assert.equal(extractCredential('API_KEY="'+key+'"'),key);
 assert.equal(extractCredential('Bearer '+key),key);
 assert.equal(extractCredential(''), '');
 assert.throws(()=>extractCredential(key+' '+other));assert.throws(()=>extractCredential('sk-***masked***'));
});
test('document context never attaches to external or another-book selections',()=>{
 assert.equal(contextBelongsToSource({id:'book-a'},'book-a'),true);
 assert.equal(contextBelongsToSource({id:null},'book-a'),false);
 assert.equal(contextBelongsToSource({id:'book-b'},'book-a'),false);
 assert.equal(contextBelongsToSource({id:'book-a',external:true},'book-a'),false);
});
test('power playback returns to identity and saved states are isolated and validated',()=>{
 const sigma=[1,2,0];assert.deepEqual(permutationPower(sigma,2),[2,0,1]);assert.deepEqual(permutationPower(sigma,3),[0,1,2]);
 const source={kind:'permutation-state',version:1,plan:{n:3,sigma,order:'right-first',object:'cycle'},state:[2,0,1],steps:2};
 const restored=validatePermutationSnapshot(source);source.state[0]=1;assert.deepEqual(restored.state,[2,0,1]);
 assert.throws(()=>validatePermutationSnapshot(source));assert.throws(()=>permutationPower([1,1,0],2));assert.throws(()=>permutationPower(sigma,-1));
});
