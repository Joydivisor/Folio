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
