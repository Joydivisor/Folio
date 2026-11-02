import test from 'node:test';
import assert from 'node:assert/strict';
import {assignTextBlocks} from '../public/pdf-selection.js';
import {layoutText} from '../public/reflow-layout.js';
const viewport={width:600,height:800,convertToViewportPoint:(x,y)=>[x,800-y]};
const item=(str,x,y)=>({str,width:180,transform:[12,0,0,12,x,800-y]});
test('transparent selection order covers every PDF token once and keeps columns separate',()=>{
 const items=[];for(let i=0;i<5;i++)items.push(item('left '+i,40,100+i*20),item('right '+i,340,100+i*20));
 const before=structuredClone(items),layout=layoutText(items,viewport),groups=assignTextBlocks(items,layout,viewport),order=groups.flatMap(g=>g.indices);
 assert.equal(order.length,items.length);assert.equal(new Set(order).size,items.length);
 assert.deepEqual(order,[0,2,4,6,8,1,3,5,7,9]);assert.deepEqual(items,before);
});
import {graphemeOffsets} from '../public/selection-handles.js';
test('selection handles use grapheme boundaries for accents, math and surrogate pairs',()=>{
 const text='Ae\u0301𝑥👩‍🔬中';assert.deepEqual(graphemeOffsets(text),[0,1,3,5,10,11]);
});
test('narrow columns and original PDF indices retain every token exactly once',()=>{
 const items=[];for(let i=0;i<12;i++){const a=item('LEFT narrow column sentence '+i,40,100+i*15),b=item('RIGHT narrow column sentence '+i,298,100+i*15);a.width=245;b.width=250;items.push(a,b);}
 const groups=assignTextBlocks(items,layoutText(items,viewport),viewport),order=groups.flatMap(g=>g.indices);
 assert.deepEqual(order,[...items.keys()].filter(i=>i%2===0).concat([...items.keys()].filter(i=>i%2===1)));
});
