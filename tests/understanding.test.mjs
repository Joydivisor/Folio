import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUnderstanding} from '../public/understanding.js';
import {resolveAnchor} from '../public/annotation-anchor.js';
test('understanding accepts actual S4 parameters without substituting S3',()=>{
 const p=parseUnderstanding(JSON.stringify({kind:'permutation',object:'S4',reason:'four-cycle',n:4,sigma:[2,3,4,1],order:'right-first'}));
 assert.deepEqual(p.sigma,[1,2,3,0]);assert.equal(p.n,4);assert.equal(p.tau,undefined);
});
test('reject invalid bijections, unsupported groups and executable scene types',()=>{
 const base={kind:'permutation',object:'S3',reason:'',n:3,sigma:[2,3,1],order:'right-first'};
 for(const fields of [{sigma:[2,2,1]},{n:4},{tau:[1,2]},{order:'unknown'},{kind:'derived',n:6},{kind:'tetrahedron',operation:'eval'},{kind:'javascript'}])assert.throws(()=>parseUnderstanding(JSON.stringify({...base,...fields})));
});
test('annotation anchors survive reflow/text shifts and refuse ambiguous matches',()=>{
 const a={start:2,end:6,exact:'群的定义',prefix:'第一',suffix:'如下'};
 assert.deepEqual(resolveAnchor('第一群的定义如下',a),{start:2,end:6});
 assert.deepEqual(resolveAnchor('新增第一群的定义如下',a),{start:4,end:8});
 assert.equal(resolveAnchor('第一群的定义如下，第一群的定义如下',{...a,start:100,end:104}),null);
 assert.equal(resolveAnchor('原文已删去',a),null);
});
