import test from 'node:test';
import assert from 'node:assert/strict';
import ELK from 'elkjs';
import {createDocumentIndex,selectContext} from '../public/document-context.js';
import {parseReading} from '../public/reading-response.js';
import {layoutConcept} from '../public/graph-layout.js';
import {verifyPlanAgainstSource} from '../public/source-verification.js';

test('current document is read across pages and cached; far definitions can be retrieved',async()=>{
 let reads=0;const pages=Array.from({length:20},(_,i)=>({page:i+1,text:('本页讨论其他话题。').repeat(250)}));pages[17].text='先定义Zorvik群：这是一个循环群。'+pages[17].text;
 const index=createDocumentIndex({id:'one',name:'test',total:20,readPage:async n=>{reads++;return pages[n-1].text;}});
 const result=await index.retrieve('Zorvik 群为什么可解？',2);assert.equal(reads,20);assert.equal(result.scanned,20);assert.ok(result.excerpts.some(e=>e.page===18&&e.text.includes('Zorvik')));assert.ok(result.text.length<14500);
 await index.retrieve('其他话题',3);assert.equal(reads,20);
 const other=createDocumentIndex({id:'two',name:'unrelated',total:1,readPage:async()=> '另一本书'});assert.equal((await other.retrieve('定义',1)).text.includes('Zorvik'),false);
});
test('short books include neighboring definitions, interrupted indexing stops before all pages',async()=>{
 assert.equal(selectContext([{page:1,text:'σ=(1 2 3)'},{page:2,text:'因此σ³=e'}],'因此σ³=e',2).length,2);
 const controller=new AbortController();let reads=0;const index=createDocumentIndex({id:'a',name:'book',total:30,readPage:async()=>{if(++reads===2)controller.abort();return 'text';}});
 await assert.rejects(index.retrieve('text',1,{signal:controller.signal}),{name:'AbortError'});assert.ok(reads<30);
});
test('page failures are reported and valid explanation survives unavailable renderer',async()=>{
 const index=createDocumentIndex({id:'a',name:'book',total:2,readPage:async n=>{if(n===2)throw Error('bad page');return '正规子群在共轭下不变。';}});
 const context=await index.retrieve('它是什么？',1);assert.deepEqual(context.failedPages,[2]);
 const response=parseReading(JSON.stringify({kind:'unsupported',object:'正方体',reason:'没有3D模板',explanation:{title:'旋转对称',paragraphs:[{text:'绕体对角线旋转120度保持正方体不变。',sources:[{page:99,quote:'伪造引用'},{page:1,quote:'原文没有这句话'}]}]}}),context.excerpts);
 assert.equal(response.plan.kind,'explain');assert.equal(response.answer.paragraphs.length,1);assert.deepEqual(response.answer.paragraphs[0].sources,[]);
});
test('valid page quotes are preserved and products do not masquerade as tau definitions',()=>{
 const text='定义 σ = (1 2 3)，τ = (1 2)。结果 στ = (1 3)，τσ = (2 3)。';
 const plan=verifyPlanAgainstSource({kind:'permutation',n:3,sigma:[1,2,0],tau:[1,0,2],order:'right-first'},text);assert.deepEqual(plan.verification.checked,['σ','τ']);
 const response=parseReading(JSON.stringify({kind:'explain',object:'定义',reason:'解释',explanation:{title:'置换',paragraphs:[{text:'这是一个三循环。',sources:[{page:2,quote:'σ = (1 2 3)'}]}]}}),[{page:2,text}]);assert.equal(response.answer.paragraphs[0].sources.length,1);
});
const overlaps=(a,b)=>a.x<b.x+b.width-.01&&a.x+a.width>b.x+.01&&a.y<b.y+b.height-.01&&a.y+a.height>b.y+.01;
const node=(id,label)=>({id,label,detail:label});
test('layout reserves nodes and edge labels; routes do not cut through other nodes',async()=>{
 const graphs=[
  {nodes:[node('a','置换σ'),node('b','σ³=e'),node('c','元素的正整数次幂'),node('d','恒等元'),node('e','首次等于'),node('f','元素的阶')],edges:[['a','b','三次作用得恒等'],['b','e','提供首次幂例'],['c','f','用于定义'],['d','f','等于是判定对象'],['e','f','首次即最小指数']].map(([from,to,label])=>({from,to,label}))},
  {nodes:['a','b','c','d'].map(id=>node(id,'这是一个需要换行的很长概念标签'+id)),edges:[['a','b'],['a','c'],['b','d'],['c','d'],['d','a']].map(([from,to])=>({from,to,label:'这是一条需要独立留白的关系标签'}))}
 ];
 for(const g of graphs){const result=await layoutConcept(g,new ELK()),labels=result.edges.flatMap(e=>e.labels||[]);
  for(let i=0;i<result.children.length;i++)for(let j=i+1;j<result.children.length;j++)assert.ok(!overlaps(result.children[i],result.children[j]),'nodes overlap');
  for(const l of labels)for(const n of result.children)assert.ok(!overlaps(l,n),'edge label overlaps node');
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)assert.ok(!overlaps(labels[i],labels[j]),'edge labels overlap');
  for(const e of result.edges)for(const s of e.sections||[]){const points=[s.startPoint,...(s.bendPoints||[]),s.endPoint];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];for(const n of result.children){if(e.sources.includes(n.id)||e.targets.includes(n.id))continue;const hit=a.x===b.x?a.x>n.x+.01&&a.x<n.x+n.width-.01&&Math.max(a.y,b.y)>n.y&&Math.min(a.y,b.y)<n.y+n.height:a.y>n.y+.01&&a.y<n.y+n.height-.01&&Math.max(a.x,b.x)>n.x&&Math.min(a.x,b.x)<n.x+n.width;assert.ok(!hit,'route cuts through node');}}}
 }
});
