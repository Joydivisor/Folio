import {ui} from './workspace-ui.js';
// Reorder only invisible PDF.js text spans. Their fonts/transforms/positions are retained.
export function assignTextBlocks(items,layout,viewport){
 const groups=layout.blocks.map(block=>({block,indices:[]}));
 for(const [i,item] of items.entries()){
  if(typeof item.str!=='string')continue;
  const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
  const cx=(x+item.width/2)/viewport.width,cy=(y-Math.hypot(item.transform[2],item.transform[3])/2)/viewport.height;
  let best=null,score=Infinity;
  for(const group of groups){const r=group.block.rect;if(!r)continue;const dx=Math.max(r[0]-cx,0,cx-r[0]-r[2]),dy=Math.max(r[1]-cy,0,cy-r[1]-r[3]),distance=dx*dx+dy*dy;if(distance<score){best=group;score=distance;}}
  best?.indices.push(i);
 }
 for(const g of groups)g.indices.sort((a,b)=>{const pa=viewport.convertToViewportPoint(items[a].transform[4],items[a].transform[5]),pb=viewport.convertToViewportPoint(items[b].transform[4],items[b].transform[5]);return Math.abs(pa[1]-pb[1])<3?pa[0]-pb[0]:pa[1]-pb[1];});
 return groups;
}
export function enhancePDFSelection({layer,textDivs,items,layout,viewport,wrap,onSelect}){
 if(viewport.rotation%180!==0)return;
 const groups=assignTextBlocks(items.filter(i=>typeof i.str==='string'),layout,viewport),textItems=items.filter(i=>typeof i.str==='string'),nodes=[],seen=new Set();let anchor=0;
 for(const {block,indices} of groups){const group=document.createElement('span');group.className='markedContent semantic-block';group.dataset.block=block.id;
  for(const index of indices){const div=textDivs[index];if(!div)continue;seen.add(div);div.dataset.block=block.id;group.append(div);if(textItems[index].hasEOL)group.append(document.createElement('br'));}
  if(group.childNodes.length)nodes.push(group);
 }
 for(const div of textDivs)if(!seen.has(div))nodes.push(div);
 layer.replaceChildren(...nodes);
 const pick=document.createElement('button');pick.type='button';pick.className='quick-paragraph';pick.textContent='¶';pick.hidden=true;pick.title=ui('选择整段 · Shift 连选','Select paragraph · Shift to extend');pick.setAttribute('aria-label',pick.title);wrap.append(pick);let current=0;
 function select(index,extend){const lo=extend?Math.min(anchor,index):index,hi=extend?Math.max(anchor,index):index;if(!extend)anchor=index;const first=nodes[lo],last=nodes[hi];if(!first||!last)return;const range=document.createRange();range.setStartBefore(first);range.setEndAfter(last);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);onSelect(layout.blocks.slice(lo,hi+1));}
 wrap.addEventListener('pointermove',e=>{if(e.buttons)return;const block=e.target.closest?.('[data-block]');if(!block)return;current=layout.blocks.findIndex(b=>b.id===block.dataset.block);if(current<0)return;const r=layout.blocks[current].rect;pick.hidden=false;pick.style.left=Math.max(2,r[0]*wrap.clientWidth-29)+'px';pick.style.top=Math.max(2,r[1]*wrap.clientHeight)+'px';});
 wrap.addEventListener('pointerleave',()=>{pick.hidden=true;});pick.onmousedown=e=>e.preventDefault();pick.onclick=e=>select(current,e.shiftKey);
 layer.addEventListener('click',e=>{if(e.detail!==3)return;const id=e.target.closest?.('[data-block]')?.dataset.block,index=layout.blocks.findIndex(b=>b.id===id);if(index>=0){e.preventDefault();select(index,e.shiftKey);}});
 return {select};
}
