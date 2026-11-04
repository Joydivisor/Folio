import {sourceLabel} from './source-label.js';
import {layoutConcept} from './graph-layout.js';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={start:{label:'开始',color:'#519e8b'},end:{label:'结束',color:'#519e8b'},action:{label:'步骤',color:'#6a91cf'},decision:{label:'判断',color:'#bd9656'},concept:{label:'概念',color:'#6a91cf'},condition:{label:'条件',color:'#bd9656'},consequence:{label:'结论',color:'#4f9d87'},example:{label:'例子',color:'#a481bc'}};
export async function mountConcept(host,data,source,onSave,renderMath,signal,{saved={},onState=()=>{},flowchart=false}={}){
 const arrowId='graphArrow-'+crypto.randomUUID();
 const root=document.createElement('div');root.className='concept-artifact'+(flowchart?' flowchart':'');host.append(root);
 root.innerHTML='<div class="visual-heading"><h2>'+escape(data.title)+'</h2><p>'+escape(data.summary)+'</p></div><p class="muted">正在安排节点与连线…</p>';
 const layout=await layoutConcept(data,new window.ELK());
 if(signal?.aborted||!root.isConnected)return;
 host.prepend(root);
 const nodes=data.nodes,edges=data.edges,count=nodes.length;
 const lines=layout.edges.map((e,i)=>'<g data-edge="'+i+'">'+(e.sections||[]).map(s=>{const points=[s.startPoint,...(s.bendPoints||[]),s.endPoint];return '<path class="edge" marker-end="url(#'+arrowId+')" d="'+points.map((p,j)=>(j?'L':'M')+p.x+' '+p.y).join(' ')+'"/>';}).join('')+'</g>').join('');
 const labels=layout.edges.map(e=>(e.labels||[]).map(l=>'<g aria-hidden="true"><rect class="edge-label-bg" x="'+l.x+'" y="'+l.y+'" width="'+l.width+'" height="'+l.height+'" rx="4"/>'+l.lines.map((line,j)=>'<text class="edge-label" x="'+(l.x+l.width/2)+'" y="'+(l.y+18+j*18)+'" text-anchor="middle">'+escape(line)+'</text>').join('')+'</g>').join('')).join('');
 const boxes=layout.children.map(p=>{const n=nodes[p.index],type=types[n.type]||types.concept;return '<g class="graph-node" style="--node-color:'+type.color+'" data-node="'+p.index+'" tabindex="0" role="button" aria-label="查看 '+escape(n.label)+'">'+(n.type==='decision'?'<path class="diagram-node-decision" d="M'+(p.x+p.width/2)+' '+p.y+'L'+(p.x+p.width)+' '+(p.y+p.height/2)+'L'+(p.x+p.width/2)+' '+(p.y+p.height)+'L'+p.x+' '+(p.y+p.height/2)+'Z"/>':'<rect x="'+p.x+'" y="'+p.y+'" width="'+p.width+'" height="'+p.height+'" rx="'+(['start','end'].includes(n.type)?32:12)+'"/>')+''+p.lines.map((t,j)=>'<text x="'+(p.x+p.width/2)+'" y="'+(p.y+p.height/2-(p.lines.length-1)*10+5+j*20)+'" text-anchor="middle">'+escape(t)+'</text>').join('')+'</g>';}).join('');
 const used=[...new Set(nodes.map(n=>n.type||'concept'))];
 root.innerHTML='<div class="visual-heading"><h2>'+escape(data.title)+'</h2><p>'+escape(data.summary)+'</p></div><div class="artifact-legend">'+used.map(t=>'<span style="--item-color:'+types[t].color+'"><i></i>'+types[t].label+'</span>').join('')+'</div><div class="graph-tools"><button data-zoom="out" aria-label="缩小关系图">−</button><output></output><button data-zoom="in" aria-label="放大关系图">＋</button><button data-zoom="fit">查看全图</button><small>拖动平移 · 点击节点</small></div><div class="graph-viewport" tabindex="0" aria-label="概念图画布，可滚动或拖动查看"><svg class="concept-graph" viewBox="0 0 '+layout.width+' '+layout.height+'" role="group" aria-label="可交互概念关系图"><defs><marker id="'+arrowId+'" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="var(--muted)"/></marker></defs>'+lines+labels+boxes+'</svg></div><div class="graph-navigation"><button data-nav="prev">← 上一项</button><span></span><button data-nav="next">下一项 →</button></div><div class="graph-detail"></div><div class="visual-source"></div><button class="wide-button" style="margin-top:16px">保存到笔记</button>';
 const q=s=>root.querySelector(s),viewport=q('.graph-viewport'),svg=q('svg');let selected=saved.selected||0,zoom=saved.zoom||1,fit=saved.fit!==false,drag=null;
 function report(){onState({selected,zoom,fit,left:viewport.scrollLeft,top:viewport.scrollTop});}
 viewport.addEventListener('scroll',report);
 function size(){if(fit)zoom=Math.max(.3,Math.min(1,(viewport.clientWidth-8)/layout.width,(viewport.clientHeight-8)/layout.height));svg.style.width=layout.width*zoom+'px';svg.style.height=layout.height*zoom+'px';q('.graph-tools output').textContent=Math.round(zoom*100)+'%';report();}
 root.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{fit=b.dataset.zoom==='fit';if(!fit)zoom=Math.max(.65,Math.min(1.6,zoom+(b.dataset.zoom==='in'?.15:-.15)));size();});
 viewport.onpointerdown=e=>{if(e.button!==0||e.target.closest('.graph-node'))return;drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);};
 viewport.onpointermove=e=>{if(!drag)return;viewport.scrollLeft=drag.left-e.clientX+drag.x;viewport.scrollTop=drag.top-e.clientY+drag.y;};viewport.onpointerup=viewport.onpointercancel=()=>{drag=null;};
 function select(i){q('.graph-detail').hidden=false;selected=Math.max(0,Math.min(count-1,i));i=selected;report();const n=nodes[i],related=edges.filter(e=>e.from===n.id||e.to===n.id);
  q('.graph-detail').innerHTML='<h3>'+escape(n.label)+'</h3><p>'+escape(n.detail)+'</p>'+(n.evidenceVerified?'<div class="graph-evidence"><small>原文依据</small>'+escape(n.evidence)+'</div>':'')+(related.length?'<div class="artifact-section"><h3>相关关系</h3>'+related.map(e=>'<p>'+escape(nodes.find(n=>n.id===e.from).label)+' → '+escape(nodes.find(n=>n.id===e.to).label)+'<br>'+escape(e.label)+'</p>').join('')+'</div>':'');
  renderMath(q('.graph-detail'));
  root.querySelectorAll('[data-node]').forEach(el=>{const active=Number(el.dataset.node)===i;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});
  root.querySelectorAll('[data-edge]').forEach(el=>{const edge=edges[Number(el.dataset.edge)];el.querySelectorAll('path').forEach(p=>p.classList.toggle('is-related',edge.from===n.id||edge.to===n.id));});
  q('.graph-navigation span').textContent=(i+1)+' / '+count;q('[data-nav="prev"]').disabled=i===0;q('[data-nav="next"]').disabled=i===count-1;
 }
 root.querySelectorAll('[data-node]').forEach(el=>{el.onclick=()=>select(Number(el.dataset.node));el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(Number(el.dataset.node));}};});
 q('[data-nav="prev"]').onclick=()=>select(Math.max(0,selected-1));q('[data-nav="next"]').onclick=()=>select(Math.min(count-1,selected+1));
 q('.visual-source').textContent=sourceLabel(source)+' · AI 整理';
 q('.wide-button').onclick=()=>onSave(data.title+'\n\n'+nodes.map(n=>n.label+'：'+n.detail+(n.evidenceVerified?'\n原文依据：'+n.evidence:'')).join('\n\n')+'\n\n关系：\n'+edges.map(e=>nodes.find(n=>n.id===e.from).label+' → '+nodes.find(n=>n.id===e.to).label+'：'+e.label).join('\n'));
 const observer=new ResizeObserver(size);observer.observe(viewport);size();select(selected);if(flowchart)q('.graph-detail').hidden=true;viewport.scrollLeft=saved.left||0;viewport.scrollTop=saved.top||0;return ()=>observer.disconnect();
}
