import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleMapping,verifyPlanAgainstSource} from '../public/source-verification.js';
const base={kind:'permutation',n:4,sigma:[3,2,0,1],tau:[1,2,0,3],order:'left-first'};
test('a valid but incorrect AI bijection is corrected from unambiguous original cycles',()=>{
 const result=verifyPlanAgainstSource(base,'Ω={1,2,3,4}，σ=(1 4)(2 3)，τ=(1 2 3)。');
 assert.deepEqual(result.sigma,[3,2,1,0]);assert.deepEqual(result.verification,{checked:['σ','τ'],corrected:['σ']});
 assert.deepEqual(base.sigma,[3,2,0,1]);
});
test('cycle products respect convention, repeated labels and conflicting definitions are rejected',()=>{
 assert.deepEqual(cycleMapping('(1 2 3)(1 2)',3,'right-first'),[2,1,0]);
 assert.deepEqual(cycleMapping('(1 2 3)(1 2)',3,'left-first'),[0,2,1]);
 assert.throws(()=>verifyPlanAgainstSource(base,'σ=(1 4 4)'));
 assert.throws(()=>verifyPlanAgainstSource(base,'σ=(1 4)，σ=(1 2)'));
 assert.throws(()=>verifyPlanAgainstSource(base,'σ=(1 9)'));
});
test('plain prose and unsupported powers are not labeled as independently checked',()=>{
 assert.deepEqual(verifyPlanAgainstSource(base,'交换两个元素').verification.checked,[]);
 assert.deepEqual(verifyPlanAgainstSource(base,'σ=(1 2)^-1').verification.checked,[]);
 assert.deepEqual(verifyPlanAgainstSource(base,'\\sigma=(1,4)(2,3)').sigma,[3,2,1,0]);
});

test('a cube can never select the tetrahedral renderer',()=>{
 assert.equal(verifyPlanAgainstSource({kind:'tetrahedron',object:'正方体绕体对角线旋转',operation:'vertex'},'正方体绕对角线旋转120°').kind,'explain');
 assert.equal(verifyPlanAgainstSource({kind:'tetrahedron',object:'旋转',operation:'vertex'},'把它旋转').kind,'explain');
 assert.equal(verifyPlanAgainstSource({kind:'tetrahedron',object:'正四面体旋转',operation:'vertex'},'正四面体绕顶点轴转120°').kind,'tetrahedron');
});
