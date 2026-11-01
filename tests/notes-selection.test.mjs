import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import {createNoteMarkdown,normalizeLatex,exportNoteMarkdown,safeNoteFilename} from '../public/note-markdown.js';
import {rectangle,adjustRectangle,containsCenter,joinGlyphs} from '../public/region-geometry.js';
import {createConversations} from '../public/conversations.js';

test('selection can be drawn in reverse and moved/resized without escaping page bounds',()=>{
 assert.deepEqual(rectangle([.8,.8],[.2,.3]),[.2,.3,.6000000000000001,.5]);
 const r=[.2,.3,.4,.2];assert.deepEqual(adjustRectangle(r,'move',4,-4),[.6,0,.4,.2]);
 for(const handle of ['n','ne','e','se','s','sw','w','nw'])for(const d of [-10,10]){const q=adjustRectangle(r,handle,d,d);assert.ok(q[0]>=0&&q[1]>=0&&q[2]>0&&q[3]>0&&q[0]+q[2]<=1.000001&&q[1]+q[3]<=1.000001);}
});
test('selection excludes neighboring rows and columns and reconstructs visual reading order',()=>{
 const glyphs=[{text:'B',x:.2,y:.2,width:.02,height:.02},{text:'A',x:.1,y:.2,width:.02,height:.02},{text:'C',x:.1,y:.3,width:.02,height:.02},{text:'outside',x:.6,y:.2,width:.04,height:.02}];
 const picked=glyphs.filter(g=>containsCenter([.08,.18,.3,.15],g));assert.equal(joinGlyphs(picked),'A B\nC');
});
test('Markdown preserves math subscript/alignment and literal code while escaping active content',()=>{
 const md=createNoteMarkdown(MarkdownIt),source=String.raw`## Definition

The group is $S_3$ and $a*b$.

\[
\begin{aligned}
S_3' &= A_3 \\
A_3' &= \{e\}
\end{aligned}
\]

<script>alert(1)</script>

[bad](javascript:alert(1))

![remote](https://example.com/tracker.png)`;
 const html=md.render(normalizeLatex(source));assert.match(html,/<h2>Definition<\/h2>/);assert.match(html,/S_3/);assert.match(html,/begin\{aligned\}/);assert.doesNotMatch(html,/<script|<img|href="javascript:/);assert.match(html,/&lt;script&gt;/);
 assert.equal(normalizeLatex('`\\(x\\)`'),'`\\(x\\)`');
});
test('Obsidian export retains source metadata, original excerpt, math and safe attachment references',()=>{
 const md=exportNoteMarkdown({id:'n1',title:'Test: group',text:'## Result\n\n\\[a_1+b_2\\]',source:{name:'a.pdf',page:7,text:'original\nsecond line'}},{attachment:'attachments/region-1.png'});
 assert.match(md,/page: 7/);assert.match(md,/\$\$\na_1\+b_2\n\$\$/);assert.match(md,/> original\n> second line/);assert.match(md,/attachments\/region-1.png/);assert.equal(safeNoteFilename('../../bad:name'),'..-..-bad-name');assert.equal(safeNoteFilename('CON'),'Folio-note');
});
test('archived conversations retain region and document revision for source recovery',()=>{
 const conversations=createConversations({id:()=> 'test'});const token=conversations.begin({id:'book',documentId:'canonical',revision:'v1',page:2,rect:[.1,.2,.3,.4],regionId:'r1',text:'selected'},'question');conversations.complete(token,'question',{paragraphs:[{text:'answer',sources:[]}]},{kind:'explain'});const n=conversations.snapshot();assert.equal(n.source.regionId,'r1');assert.equal(n.source.revision,'v1');assert.deepEqual(n.source.rect,[.1,.2,.3,.4]);assert.match(n.text,/### 1\. question/);
});
