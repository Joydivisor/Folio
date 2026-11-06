import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePermutationSnapshot} from '../public/permutation-state.js';
import {compositionTrace} from '../public/experiment-math.js';

test('composition snapshots restore the exact convention and step, rejecting a mismatched visible result',()=>{
 for(const order of ['right-first','left-first'])for(const product of ['στ','τσ'])for(const stage of [0,1,2]){
  const plan={kind:'permutation',object:'Composition',n:3,sigma:[1,2,0],tau:[1,0,2],order};
  const [a,b]=product==='στ'?[plan.sigma,plan.tau]:[plan.tau,plan.sigma],trace=compositionTrace(a,b,order);
  const value={kind:'permutation-state',version:1,plan,state:[trace.initial,trace.intermediate,trace.result][stage],steps:stage,composition:{product,stage}};
  assert.deepEqual(validatePermutationSnapshot(value),value);
  assert.throws(()=>validatePermutationSnapshot({...value,steps:stage+1}),/Composition/);
  assert.throws(()=>validatePermutationSnapshot({...value,composition:{product,stage:3}}),/Invalid composition/);
 }
});
