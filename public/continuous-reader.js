import {layoutText,plainLayout,blockContext} from './reflow-layout.js';
import {enhancePDFSelection} from './pdf-selection.js';
import {cropSource} from './reflow-view.js';
import {ui} from './workspace-ui.js';

export const readerMode=value=>value==='paged'?'paged':'continuous';
export function readingPosition(value,total){
 const p=typeof value==='number'?{page:value}:value||{};
 return {page:Math.max(1,Math.min(total,Math.trunc(Number(p.page)||1))),offset:Math.max(0,Math.min(.98,Number(p.offset)||0))};
}
// Page shells keep their dimensions when distant canvases are released.
export function createReaderView({host,viewport,pdf,pdfLib,textPages,zoom=1,mode='continuous',onActive=()=>{},onPosition=()=>{},onRendered=()=>{},onSelect=()=>{}}){
 const count=pdf?.numPages||textPages.length,records=new Map(),abort=new AbortController();
 let dead=false,observer,frame=0,timer,active=1,jumping=false,inflight=0,queue=[],lastPosition={page:1,offset:0};
 const shown=()=>!dead&&host.isConnected&&viewport.clientHeight>0&&viewport.clientWidth>0;
 const top=r=>r.wrap.getBoundingClientRect().top-viewport.getBoundingClientRect().top;
 function position(){if(!shown())return {...lastPosition};const r=records.get(active);lastPosition={page:active,offset:r?.wrap.offsetHeight?Math.max(0,Math.min(.98,-top(r)/r.wrap.offsetHeight)):0};return {...lastPosition};}
 function report(){if(!shown()||jumping)return;const list=[...records.values()];let lo=0,hi=list.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(top(list[mid])<=64)lo=mid;else hi=mid-1;}
  const r=list[lo];if(!r)return;active=r.number;position();onActive(r);clearTimeout(timer);timer=setTimeout(()=>onPosition(position()),120);evict();
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(report);}
 function pinned(r){const s=getSelection();return !!s?.rangeCount&&!s.isCollapsed&&s.getRangeAt(0).intersectsNode(r.wrap);}
 function release(r){r.controls?.destroy();r.controls=null;r.textLayer?.cancel();r.textLayer=null;r.task?.cancel();r.task=null;r.wrap.querySelectorAll('canvas').forEach(c=>{c.width=0;c.height=0;});r.wrap.replaceChildren();r.ready=false;r.layout=null;r.wrap.dataset.ready='false';}
 function evict(){for(const r of records.values())if(r.ready&&Math.abs(r.number-active)>4&&!pinned(r)&&!r.wrap.contains(document.activeElement))release(r);}
 function enqueue(r){if(dead||r.ready||r.promise)return r?.promise;if(!queue.includes(r))queue.push(r);pump();}
 function pump(){while(!dead&&inflight<2&&queue.length){const r=queue.shift();if(r.ready||r.promise)continue;inflight++;load(r).catch(()=>{}).finally(()=>{inflight--;pump();});}}
 function load(r){if(r.ready)return Promise.resolve(r);if(r.promise)return r.promise;
  r.promise=(async()=>{r.wrap.replaceChildren();r.wrap.dataset.loading='true';
   if(!pdf){const article=document.createElement('article');article.className='paper plain-text';article.style.fontSize=14*zoom+'px';article.textContent=textPages[r.number-1]||'';r.wrap.append(article);r.layout=plainLayout(article.textContent,r.number);r.wrap.style.height='auto';}
   else{
    const p=await pdf.getPage(r.number);if(dead)return;
    const natural=p.getViewport({scale:1}),scale=Math.min(Math.max(260,viewport.clientWidth-60)/natural.width,1.5)*zoom,v=p.getViewport({scale}),anchor=records.get(active),oldTop=anchor?top(anchor):0;
    r.wrap.style.width=v.width+'px';r.wrap.style.height=v.height+'px';r.wrap.style.setProperty('--scale-factor',scale);r.wrap.style.setProperty('--total-scale-factor',scale);
    if(!jumping&&anchor&&r.number<active)viewport.scrollTop+=top(anchor)-oldTop;
    const canvas=document.createElement('canvas'),layer=document.createElement('div'),dpr=Math.min(devicePixelRatio||1,2);layer.className='textLayer';
    canvas.width=Math.floor(v.width*dpr);canvas.height=Math.floor(v.height*dpr);canvas.style.width=v.width+'px';canvas.style.height=v.height+'px';r.wrap.append(canvas,layer);
    r.task=p.render({canvasContext:canvas.getContext('2d'),viewport:v,transform:dpr===1?null:[dpr,0,0,dpr,0,0]});await r.task.promise;if(dead)return;r.task=null;
    const content=await p.getTextContent();if(dead)return;
    r.textLayer=new pdfLib.TextLayer({textContentSource:content,container:layer,viewport:v});await r.textLayer.render();if(dead)return;
    r.layout=layoutText(content.items,natural,r.number);
    r.controls=enhancePDFSelection({layer,textDivs:r.textLayer.textDivs,items:content.items,layout:r.layout,viewport:natural,wrap:r.wrap,onSelect:blocks=>{if(dead)return;const ids=blocks.map(b=>b.id);onSelect(r.number,{text:blocks.map(b=>b.text).join('\n\n'),blockIds:ids,rect:blocks[0]?.rect,selectionMethod:'blocks',blockContext:blockContext(r.layout,ids),...(blocks.length===1&&['formula','table'].includes(blocks[0].kind)?{image:cropSource(canvas,blocks[0].rect)}:{})});}});
   }
   if(dead)return;r.ready=true;delete r.wrap.dataset.loading;r.wrap.dataset.ready='true';onRendered(r);if(active===r.number)onActive(r);evict();return r;
  })().catch(error=>{if(dead||error.name==='RenderingCancelledException'||error.name==='AbortException')return;
   delete r.wrap.dataset.loading;r.wrap.dataset.ready='false';r.wrap.replaceChildren();const retry=document.createElement('button');retry.className='page-retry';retry.textContent=ui('此页加载失败，点击重试','Page failed to load. Retry');retry.onclick=()=>load(r).catch(()=>{});r.wrap.append(retry);throw error;
  }).finally(()=>{r.promise=null;});return r.promise;
 }
 async function jump(number,offset=0){const target=readingPosition({page:number,offset},count),r=records.get(target.page);if(!r||dead)return;jumping=true;active=target.page;onActive(r);
  try{if(target.page===1&&target.offset===0)viewport.scrollTop=0;else viewport.scrollTop+=top(r)+target.offset*r.wrap.offsetHeight;await load(r);if(dead)return;if(target.page===1&&target.offset===0)viewport.scrollTop=0;else viewport.scrollTop+=top(r)+target.offset*r.wrap.offsetHeight;onActive(r);onPosition(position());}
  finally{jumping=false;if(!dead){for(const n of [active-1,active+1])if(records.has(n))enqueue(records.get(n));evict();}}
 }
 async function init(initial=1,offset=0){active=readingPosition(initial,count).page;let natural={width:595,height:842};if(pdf)natural=(await pdf.getPage(active)).getViewport({scale:1});if(dead)return;
  host.replaceChildren();host.classList.add('reading-pages');host.dataset.readingMode=mode;
  const scale=Math.min(Math.max(260,viewport.clientWidth-60)/natural.width,1.5)*zoom;
  for(let n=1;n<=count;n++){if(mode==='paged'&&n!==active)continue;const wrap=document.createElement('section');wrap.className=pdf?'pdf-page reader-page':'reader-page text-page';wrap.dataset.page=String(n);wrap.setAttribute('aria-label',ui('第 '+n+' 页','Page '+n));wrap.style.width=(pdf?natural.width*scale:Math.max(260,viewport.clientWidth-60))+'px';wrap.style.height=(pdf?natural.height*scale:Math.max(300,(textPages[n-1]?.length||0)*.3*zoom))+'px';host.append(wrap);records.set(n,{number:n,wrap,ready:false,layout:null});}
  viewport.addEventListener('scroll',schedule,{passive:true,signal:abort.signal});
  observer=new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){const r=records.get(Number(item.target.dataset.page));if(r)enqueue(r);}},{root:viewport,rootMargin:'900px 0px'});
  await jump(active,offset);if(dead)return;for(const r of records.values())observer.observe(r.wrap);
 }
 return {init,jump,position,get:number=>records.get(number),destroy(){if(dead)return;onPosition(position());dead=true;abort.abort();observer?.disconnect();cancelAnimationFrame(frame);clearTimeout(timer);queue=[];for(const r of records.values())release(r);records.clear();}};
}
