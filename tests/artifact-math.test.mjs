import test from 'node:test';
import assert from 'node:assert/strict';
import {compositionTrace,permutationFacts,mappingInput,inspectGeometry} from '../public/experiment-math.js';
import {permutations,compose,identity} from '../public/groups.js';
import {vertices,operations,rotate} from '../public/geometry.js';
import {parseGraph} from '../public/graph-schema.js';

test('each displayed trace row agrees with composition for both conventions across every S4 pair',()=>{
  const all=permutations(4);
  for(const a of all)for(const b of all)for(const order of ['right-first','left-first']){
    const trace=compositionTrace(a,b,order),first=order==='right-first'?b:a,second=order==='right-first'?a:b;
    assert.deepEqual(trace.intermediate,first);
    for(const [x,mid,y] of trace.rows){assert.equal(mid,first[x-1]+1);assert.equal(y,second[mid-1]+1);}
    assert.deepEqual(trace.result,order==='right-first'?compose(a,b):compose(b,a));
  }
});
test('order and parity agree with repeated application and inversion count, including eight elements',()=>{
  for(const p of [...permutations(5),[1,2,0,4,5,6,7,3]]){
    const facts=permutationFacts(p);let power=identity(p.length);
    for(let i=1;i<=facts.order;i++){power=compose(p,power);if(i<facts.order)assert.notDeepEqual(power,identity(p.length));}
    assert.deepEqual(power,identity(p.length));
    let inversions=0;for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++)if(p[i]>p[j])inversions++;
    assert.equal(facts.even,inversions%2===0);
  }
});
test('edited mappings reject repetitions, omissions, fractions, wrong dimensions and text',()=>{
  assert.deepEqual(mappingInput('2，3，4，1'),[1,2,3,0]);
  for(const input of ['2 2 1','1 3','1.5 2','1 two 3','1','0 1',''])assert.throws(()=>mappingInput(input));
  assert.throws(()=>mappingInput('2 3 1',4));
});
test('a rigid intermediate rotation must not be presented as a tetrahedral group element',()=>{
  const op=operations.vertex,half=vertices.map(v=>rotate(v,op.axis,op.angle/2));
  assert.equal(inspectGeometry(vertices,half).rigid,true);
  assert.equal(inspectGeometry(vertices,half).isSymmetry,false);
  assert.equal(inspectGeometry(vertices,vertices.map(v=>rotate(v,op.axis,op.angle))).isSymmetry,true);
  assert.equal(inspectGeometry(vertices,vertices.map(v=>v.map(x=>x*1.01))).rigid,false);
});
test('graph evidence is matched to supplied text; model verification claims are ignored',()=>{
  const graph={title:'群',summary:'说明',nodes:[{id:'a',label:'定义',detail:'双射',type:'concept',evidence:'置换是一个双射',evidenceVerified:true}],edges:[]};
  assert.equal(parseGraph(JSON.stringify(graph),'这里说置换是一个双射。').nodes[0].evidenceVerified,true);
  assert.equal(parseGraph(JSON.stringify(graph),'其他内容').nodes[0].evidenceVerified,false);
  graph.nodes[0].type='script';assert.throws(()=>parseGraph(JSON.stringify(graph)));
});
