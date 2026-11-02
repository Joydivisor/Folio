import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutText,plainLayout,blockContext,sentences} from '../public/reflow-layout.js';
const view={width:600,height:800,convertToViewportPoint:(x,y)=>[x,800-y]};
const item=(str,x,y,width=200,size=12)=>({str,width,transform:[size,0,0,size,x,800-y]});
test('two-column reading follows each column, not alternating PDF rows',()=>{
 const items=[];for(let i=0;i<5;i++){items.push(item('Left '+i,40,100+i*20),item('Right '+i,330,100+i*20));}
 const layout=layoutText(items,view,2);assert.equal(layout.columns,2);assert.ok(layout.text.indexOf('Left 4')<layout.text.indexOf('Right 0'));assert.equal(layout.page,2);
 assert.ok(layout.blocks.every(b=>b.rect.every(n=>n>=0&&n<=1)));
});
test('full-width heading precedes columns, equations retain source pixels anchor',()=>{
 const items=[item('Theorem heading',40,40,520,24)];for(let i=0;i<4;i++)items.push(item('Left text '+i,40,100+i*20),item('Right text '+i,330,100+i*20));items.push(item('σ³ = e',40,220,90));
 const l=layoutText(items,view);assert.equal(l.blocks[0].kind,'heading');const f=l.blocks.find(b=>b.text==='σ³ = e');assert.equal(f.kind,'formula');assert.ok(f.rect);const context=blockContext(l,[f.id]);assert.equal(context.heading,'Theorem heading');assert.ok(context.text.includes('σ³ = e'));
});
test('paragraphs, sentence trimming and revision-specific page anchors retain wording',()=>{
 const l=plainLayout('第一段。第二句！\n\nAnother paragraph.',3);assert.equal(l.blocks.length,2);assert.deepEqual(sentences(l.blocks[0].text),['第一段。','第二句！']);assert.deepEqual(blockContext(l,['p3-b0']).blockIds,['p3-b0']);assert.equal(blockContext(l,['missing']),null);
});
test('aligned table retains all cells and an original-page rectangle',()=>{
 const items=[];for(let r=0;r<4;r++)for(let c=0;c<3;c++)items.push(item(`cell${r}${c}`,40+c*100,100+r*18,40));
 const l=layoutText(items,view);const table=l.blocks.find(b=>b.kind==='table');assert.ok(table);assert.ok(table.text.includes('cell00 | cell01 | cell02'));assert.ok(table.text.includes('cell33')===false);assert.ok(table.text.includes('cell32'));assert.ok(table.rect[3]>.06);
});
test('sentence trimming never splits decimal values or equation numbers',()=>{
 assert.deepEqual(sentences('取 x = 3.14。参见公式 (2.1)。'),['取 x = 3.14。','参见公式 (2.1)。']);
});

test('narrow gutters are recognized before row text is joined (bold abstract beside body)',()=>{
 const items=[item('A cellular assay with an original full-width heading',40,35,520,22)];
 for(let i=0;i<24;i++)items.push(item('LEFT abstract line with enough text '+i,40,120+i*14,245,12),item('RIGHT introduction line with enough text '+i,298,120+i*14,250,11));
 const l=layoutText(items,view);assert.equal(l.columns,2);assert.ok(l.text.indexOf('LEFT abstract line with enough text 23')<l.text.indexOf('RIGHT introduction line with enough text 0'));
 assert.ok(l.blocks.every(b=>!(b.text.includes('LEFT')&&b.text.includes('RIGHT'))));
 const indices=l.blocks.flatMap(b=>b.itemIndices);assert.equal(new Set(indices).size,items.length);assert.equal(indices.length,items.length);
});
test('three columns retain independent reading order',()=>{
 const items=[];for(let i=0;i<12;i++)for(let c=0;c<3;c++)items.push(item('Column '+c+' enough words to identify a sustained text column '+i,30+c*185,100+i*16,171,10));
 const l=layoutText(items,view);assert.equal(l.columns,3);assert.ok(l.text.indexOf('column 11')<l.text.indexOf('Column 1'));
 assert.ok(l.blocks.every(b=>new Set((b.text.match(/Column \d/g)||[])).size===1));
});
test('isolated inline whitespace does not turn a single-column page into two columns',()=>{
 const items=[];for(let i=0;i<18;i++){const split=110+(i%6)*55;items.push(item('left text '+i,40,100+i*16,split-40,11),item('right text '+i,split+10,100+i*16,550-split-10,11));}
 const l=layoutText(items,view);assert.equal(l.columns,1);assert.ok(l.text.indexOf('right text 0')<l.text.indexOf('left text 1'));
});
