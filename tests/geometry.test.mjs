import test from 'node:test';
import assert from 'node:assert/strict';
import {vertices,operations,rotate,permutationFor,parseScene} from '../public/geometry.js';
import {compose,key} from '../public/groups.js';
test('3D rotations induce the stated permutations and preserve all edge lengths',()=>{
  for(const [name,op] of Object.entries(operations)){
    const points=vertices.map(v=>rotate(v,op.axis,op.angle));
    assert.deepEqual(permutationFor(points),name==='vertex'?[0,2,3,1]:[1,0,3,2]);
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(Math.abs(Math.hypot(...points[i].map((n,k)=>n-points[j][k]))-Math.sqrt(8))<1e-9);
    let repeated=vertices;
    for(let i=0;i<(name==='vertex'?3:2);i++)repeated=repeated.map(v=>rotate(v,op.axis,op.angle));
    assert.deepEqual(permutationFor(repeated),[0,1,2,3]);
  }
});
test('the two rotations generate exactly the 12 even permutations of A4',()=>{
  const generators=Object.values(operations).map(op=>permutationFor(vertices.map(v=>rotate(v,op.axis,op.angle))));
  const group=[[0,1,2,3]],seen=new Set([key(group[0])]);
  for(let i=0;i<group.length;i++)for(const g of generators){const p=compose(g,group[i]);if(!seen.has(key(p))){seen.add(key(p));group.push(p);}}
  assert.equal(group.length,12);
  for(const p of group){let inversions=0;for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(p[i]>p[j])inversions++;assert.equal(inversions%2,0);}
});
test('model output selects bounded scenes, never executable source',()=>{
  assert.equal(parseScene('{"kind":"tetrahedron","operation":"edge","explanation":"对边旋转"}').operation,'edge');
  for(const data of [{kind:'javascript',operation:'edge',explanation:'x'},{kind:'tetrahedron',operation:'eval',explanation:'x'},{kind:'tetrahedron',operation:'edge',explanation:'x'.repeat(3001)}])assert.throws(()=>parseScene(JSON.stringify(data)));
});
