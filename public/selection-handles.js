import {ui} from './workspace-ui.js';

export function graphemeOffsets(text){
 const offsets=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(s=>s.index);
 return [...new Set([...offsets,text.length])];
}
// The PDF remains a canvas plus PDF.js text. Native ranges still power copy,
// annotations and source anchors; only pointer hit-testing and handles are ours.
export function mountSelectionHandles({layer,wrap,layout}){
 const abort=new AbortController(),signal=abort.signal,viewport=wrap.closest('.reader-viewport');
 const controls=document.createElement('div');controls.className='pdf-selection-controls';controls.dataset.noI18n='';
 const handles={};
 for(const edge of ['start','end']){
  const b=document.createElement('button');b.type='button';b.className='selection-handle selection-'+edge;b.dataset.selectionHandle=edge;b.hidden=true;
  b.setAttribute('aria-label',edge==='start'?ui('调整选区起点','Adjust selection start'):ui('调整选区终点','Adjust selection end'));
  b.title=ui('拖动调整，方向键微调','Drag to adjust; arrow keys to fine-tune');controls.append(b);handles[edge]=b;
 }
 const lens=document.createElement('div');lens.className='selection-loupe';lens.hidden=true;lens.setAttribute('aria-hidden','true');
 const preview=document.createElement('canvas');preview.width=392;preview.height=156;lens.append(preview);document.body.append(lens);wrap.append(controls);
 const records=[...layer.querySelectorAll('span[data-block]')].filter(el=>el.firstChild?.nodeType===3&&el.textContent.length).map((el,index)=>({el,node:el.firstChild,index,column:Number(el.dataset.column),offsets:graphemeOffsets(el.textContent)}));
 const byNode=new Map(records.map(r=>[r.node,r]));let drag=null,frame=0,scrollFrame=0,geometry=[],disposed=false;
 const on=(target,type,fn,options={})=>target?.addEventListener(type,fn,{...options,signal});
 function measure(){const bounds=wrap.getBoundingClientRect();geometry=records.map(r=>{const b=r.el.getBoundingClientRect();return {...r,x:b.left-bounds.left,y:b.top-bounds.top,width:b.width,height:b.height};}).filter(r=>r.width>0&&r.height>0);}
 function position(record,offset){return {node:record.node,offset,record};}
 function endpoints(){
  const s=getSelection();if(!s?.rangeCount||s.isCollapsed||!layer.contains(s.anchorNode)||!layer.contains(s.focusNode))return null;
  const range=s.getRangeAt(0);let a=byNode.get(range.startContainer),b=byNode.get(range.endContainer);
  if(a&&b)return {start:position(a,range.startOffset),end:position(b,range.endOffset)};
  const selected=records.filter(r=>range.intersectsNode(r.node));if(!selected.length)return null;
  a=selected[0];b=selected.at(-1);return {start:position(a,0),end:position(b,b.node.length)};
 }
 function compare(a,b){return a.record.index-b.record.index||a.offset-b.offset;}
 function setRange(a,b){if(!a||!b)return;getSelection().setBaseAndExtent(a.node,a.offset,b.node,b.offset);schedule();}
 function caret(p){
  if(!p)return null;const range=document.createRange(),len=p.node.length;if(!len)return null;
  const offsets=p.record.offsets,at=offsets.findIndex(n=>n>=p.offset),start=p.offset===len?offsets.at(-2):p.offset,end=p.offset===len?len:(offsets[at+1]??len);
  range.setStart(p.node,start);range.setEnd(p.node,end);const rect=range.getBoundingClientRect(),rtl=getComputedStyle(p.record.el).direction==='rtl';
  return {x:p.offset===len?(rtl?rect.left:rect.right):(rtl?rect.right:rect.left),y:rect.top+rect.height/2,top:rect.top,bottom:rect.bottom,height:rect.height};
 }
 function hit(x,y,preferred){
  if(!geometry.length)measure();const bounds=wrap.getBoundingClientRect(),px=x-bounds.left,py=y-bounds.top;
  const gutters=(layout.gutters||[]).map(g=>g*bounds.width);let col=gutters.filter(g=>px>g).length;
  if(preferred!==undefined&&gutters.some(g=>Math.abs(px-g)<8))col=preferred;
  let candidates=geometry.filter(r=>r.column===col||r.column===-1&&py>=r.y-2&&py<=r.y+r.height+2);
  if(!candidates.length)candidates=geometry;
  let best=null,score=Infinity;
  for(const r of candidates){const dx=Math.max(r.x-px,0,px-r.x-r.width),dy=Math.max(r.y-py,0,py-r.y-r.height),d=dx*dx+dy*dy*5;if(d<score){best=r;score=d;}}
  if(!best)return null;
  // Binary search measured glyph boundaries, not an average character width.
  const offsets=best.offsets;let lo=0,hi=offsets.length-1,rtl=getComputedStyle(best.el).direction==='rtl';
  while(lo<hi){const mid=Math.floor((lo+hi)/2),p=caret(position(best,offsets[mid]));if(rtl?p.x>x:p.x<x)lo=mid+1;else hi=mid;}
  const right=position(best,offsets[lo]),left=position(best,offsets[Math.max(0,lo-1)]);
  return Math.abs(caret(left).x-x)<=Math.abs(caret(right).x-x)?left:right;
 }
 function paintLoupe(p){
  if(!drag||!p)return;lens.hidden=false;const paper=wrap.querySelector('canvas'),b=wrap.getBoundingClientRect(),v=viewport.getBoundingClientRect(),c=preview.getContext('2d');
  const x=p.x-b.left,y=p.y-b.top,ratio=paper.width/b.width,zoom=2,sourceW=196/zoom,sourceH=78/zoom,sx=Math.max(0,Math.min(b.width-sourceW,x-sourceW/2)),sy=Math.max(0,Math.min(b.height-sourceH,y-sourceH/2));
  c.fillStyle='#fff';c.fillRect(0,0,392,156);c.drawImage(paper,sx*ratio,sy*ratio,sourceW*ratio,sourceH*ratio,0,0,392,156);
  const lineX=(x-sx)*zoom*2;c.strokeStyle='#4f83ce';c.lineWidth=3;c.beginPath();c.moveTo(lineX,Math.max(10,(p.top-b.top-sy)*zoom*2));c.lineTo(lineX,Math.min(146,(p.bottom-b.top-sy)*zoom*2));c.stroke();
  const left=Math.max(v.left+8,Math.min(v.right-204,p.x-98));let top=p.top-112;if(top<v.top+8)top=Math.min(v.bottom-86,p.bottom+40);
  Object.assign(lens.style,{left:left+'px',top:top+'px'});
 }
 function paint(){
  frame=0;if(disposed||!wrap.isConnected)return;const ends=endpoints(),bounds=wrap.getBoundingClientRect(),v=viewport.getBoundingClientRect();
  for(const edge of ['start','end']){
   const b=handles[edge],p=ends&&caret(ends[edge]);b.hidden=!p||p.bottom<v.top||p.top>v.bottom||p.x<v.left||p.x>v.right;
   if(!p)continue;Object.assign(b.style,{left:p.x-bounds.left-22+'px',top:(edge==='start'?p.top-28:p.bottom-6)-bounds.top+'px'});
   b.classList.toggle('is-adjusting',drag?.kind==='handle'&&drag.moving===edge);
  }
  if(drag?.point)paintLoupe(caret(drag.point));else lens.hidden=true;
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
 function moveDrag(x,y){
  if(!drag)return;drag.x=x;drag.y=y;const p=hit(x+drag.dx,y+drag.dy,drag.point?.record.column);if(!p)return;
  if(drag.kind==='text'&&!drag.moved&&Math.hypot(x-drag.originX,y-drag.originY)<3)return;
  drag.moved=true;drag.point=p;drag.moving=compare(p,drag.fixed)<0?'start':'end';setRange(drag.fixed,p);
 }
 function scroll(){
  scrollFrame=0;if(!drag)return;const r=viewport.getBoundingClientRect();let dy=0;
  if(drag.x>=r.left&&drag.x<=r.right){const y=drag.y;if(y<r.top+32)dy=-Math.min(18,(r.top+32-y)*.35);else if(y>r.bottom-32)dy=Math.min(18,(y-r.bottom+32)*.35);}
  if(dy){const before=viewport.scrollTop;viewport.scrollTop+=dy;if(before!==viewport.scrollTop)moveDrag(drag.x,drag.y);}
  scrollFrame=requestAnimationFrame(scroll);
 }
 function begin(e,state,owner){
  e.preventDefault();e.stopPropagation();measure();drag={...state,x:e.clientX,y:e.clientY,originX:e.clientX,originY:e.clientY,owner,pointerId:e.pointerId,moved:false};
  owner.setPointerCapture(e.pointerId);viewport.classList.add('reader-selecting');scrollFrame=requestAnimationFrame(scroll);schedule();
 }
 function finish(e){
  if(!drag||e.pointerId!==drag.pointerId)return;const current=drag;drag=null;cancelAnimationFrame(scrollFrame);viewport.classList.remove('reader-selecting');lens.hidden=true;
  if(current.owner.hasPointerCapture(e.pointerId))current.owner.releasePointerCapture(e.pointerId);schedule();
 }
 function inSelection(x,y){const s=getSelection();return s?.rangeCount&&!s.isCollapsed&&layer.contains(s.anchorNode)&&[...s.getRangeAt(0).getClientRects()].some(r=>r.width>0&&r.height>0&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom);}
 on(layer,'pointerdown',e=>{
  if(e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.detail>1||inSelection(e.clientX,e.clientY))return;
  measure();const p=hit(e.clientX,e.clientY);if(!p)return;
  // A blank margin click dismisses the existing selection instead of snapping to text.
  const b=p.record.el.getBoundingClientRect();if(e.clientX<b.left-8||e.clientX>b.right+8||e.clientY<b.top-8||e.clientY>b.bottom+8){getSelection()?.removeAllRanges();return;}
  const s=getSelection(),anchor=e.shiftKey&&byNode.has(s?.anchorNode)?position(byNode.get(s.anchorNode),s.anchorOffset):p;
  setRange(anchor,p);begin(e,{kind:'text',fixed:anchor,point:p,dx:0,dy:0},layer);
 });
 for(const [edge,b]of Object.entries(handles)){
  on(b,'pointerdown',e=>{if(e.button!==0)return;const ends=endpoints();if(!ends)return;const p=caret(ends[edge]);begin(e,{kind:'handle',fixed:ends[edge==='start'?'end':'start'],point:ends[edge],moving:edge,dx:p.x-e.clientX,dy:p.y-e.clientY},b);});
  on(b,'keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;const ends=endpoints();if(!ends)return;e.preventDefault();e.stopPropagation();measure();const p=ends[edge],r=p.record,step=e.key==='ArrowLeft'?-1:1;let next;
   if(['ArrowUp','ArrowDown'].includes(e.key)){const c=caret(p);next=hit(c.x,c.y+(e.key==='ArrowUp'?-1:1)*c.height*1.3,r.column);}
   else{const i=r.offsets.indexOf(p.offset),off=i+step;if(off<0){const prev=records[r.index-1];next=prev&&position(prev,prev.node.length);}else if(off>=r.offsets.length){const after=records[r.index+1];next=after&&position(after,0);}else next=position(r,r.offsets[off]);}
   if(next)setRange(ends[edge==='start'?'end':'start'],next);
  });
 }
 on(controls,'click',e=>{e.stopPropagation();e.preventDefault();});
 on(wrap,'pointermove',e=>{if(drag&&e.pointerId===drag.pointerId){e.preventDefault();e.stopPropagation();moveDrag(e.clientX,e.clientY);}});
 on(wrap,'pointerup',finish);on(wrap,'pointercancel',finish);on(wrap,'lostpointercapture',finish);
 on(document,'selectionchange',schedule);on(viewport,'scroll',schedule,{passive:true});on(window,'resize',()=>{measure();schedule();});
 on(document,'keydown',e=>{if(e.key==='Escape'&&drag){finish({pointerId:drag.pointerId});getSelection()?.removeAllRanges();}});
 on(window,'folio-language',()=>{for(const [edge,b]of Object.entries(handles)){b.setAttribute('aria-label',edge==='start'?ui('调整选区起点','Adjust selection start'):ui('调整选区终点','Adjust selection end'));b.title=ui('拖动调整，方向键微调','Drag to adjust; arrow keys to fine-tune');}});
 measure();schedule();
 return {destroy(){disposed=true;abort.abort();cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);if(drag?.owner.hasPointerCapture(drag.pointerId))drag.owner.releasePointerCapture(drag.pointerId);drag=null;viewport.classList.remove('reader-selecting');controls.remove();lens.remove();}};
}
