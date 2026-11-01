import {ui,node,button,modal} from './workspace-ui.js';
import {blockContext,sentences} from './reflow-layout.js';
export function cropSource(canvas,rect){const [x,y,w,h]=rect,copy=document.createElement('canvas');copy.width=Math.max(1,Math.ceil(w*canvas.width));copy.height=Math.max(1,Math.ceil(h*canvas.height));copy.getContext('2d').drawImage(canvas,x*canvas.width,y*canvas.height,w*canvas.width,h*canvas.height,0,0,copy.width,copy.height);return copy.toDataURL('image/png');}
// Detect visible non-text bands, preserving diagrams and table rules as source pixels.
export function visualRegions(canvas,textRects){
 const small=document.createElement('canvas');small.width=600;small.height=Math.round(canvas.height/canvas.width*600);const ctx=small.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,small.width,small.height);const {data}=ctx.getImageData(0,0,small.width,small.height),mask=new Uint8Array(small.width*small.height);
 for(const [x,y,w,h]of textRects){for(let yy=Math.max(0,Math.floor(y*small.height)-3);yy<Math.min(small.height,(y+h)*small.height+3);yy++)for(let xx=Math.max(0,Math.floor(x*600)-3);xx<Math.min(600,(x+w)*600+3);xx++)mask[yy*600+xx]=1;}
 const bands=[];let start=-1,last=-1,min=600,max=0;
 const finish=()=>{if(start>=0&&last-start>16&&max-min>24)bands.push([Math.max(0,(min-5)/600),Math.max(0,(start-5)/small.height),Math.min(1,(max-min+10)/600),Math.min(1,(last-start+10)/small.height)]);start=-1;min=600;max=0;};
 for(let y=8;y<small.height-8;y++){let count=0,l=600,r=0;for(let x=8;x<592;x++){const pos=y*600+x,i=pos*4;if(!mask[pos]&&data[i+3]>100&&Math.min(data[i],data[i+1],data[i+2])<190){count++;l=Math.min(l,x);r=x;}}if(count>6){if(start<0)start=y;last=y;min=Math.min(min,l);max=Math.max(max,r);}else if(start>=0&&y-last>12)finish();}finish();return bands.slice(0,12).map(([x,y,w,h])=>[x,y,Math.min(w,1-x),Math.min(h,1-y)]);
}
export function mountReflow(host,{layout,canvas,source,onSelect,onOriginal,onOCR,fontScale=1}){
 const article=node('article',undefined,{className:'paper reflow-paper'});article.style.setProperty('--reading-scale',fontScale);let anchor=0;
 function choose(indices){const blocks=indices.map(i=>layout.blocks[i]);article.querySelectorAll('[data-block]').forEach(el=>el.classList.toggle('block-selected',blocks.some(b=>b.id===el.dataset.block)));onSelect({...source,text:blocks.map(b=>b.text).join('\n\n'),blockIds:blocks.map(b=>b.id),rect:blocks[0]?.rect,selectionMethod:'blocks',blockContext:blockContext(layout,blocks.map(b=>b.id)),...(canvas&&blocks.length===1&&['formula','table','visual'].includes(blocks[0].kind)?{image:cropSource(canvas,blocks[0].rect)}:{})});}
 for(const [i,b]of layout.blocks.entries()){
  const section=node('section',undefined,{className:'reading-block reading-'+b.kind});section.dataset.block=b.id;
  const select=button(ui('选择本段','Select paragraph'),e=>{const indices=e.shiftKey?Array.from({length:Math.abs(i-anchor)+1},(_,n)=>Math.min(i,anchor)+n):[i];if(!e.shiftKey)anchor=i;choose(indices);});select.className='block-handle';select.textContent='⋮';select.title=ui('选择段落 · Shift 连选','Select paragraph · Shift to extend');
  const prose=node(b.kind==='heading'?'h2':'p',b.text,{className:'reflow-text'});section.append(select,prose);
  if(canvas&&b.rect&&['formula','table','visual'].includes(b.kind)){const r=b.rect,padded=[Math.max(0,r[0]-.008),Math.max(0,r[1]-.006),Math.min(1-Math.max(0,r[0]-.008),r[2]+.016),Math.min(1-Math.max(0,r[1]-.006),r[3]+.012)],image=node('img',undefined,{src:cropSource(canvas,padded),alt:b.text||ui('原文图表','Source figure')});image.className='source-block-image';image.style.width=Math.round(padded[2]*(layout.width||650)*fontScale*1.2)+'px';section.append(image);section.classList.add('source-pixels');section.append(button(ui('引用原图','Quote image'),()=>onSelect({...source,text:b.text,blockIds:[b.id],rect:padded,image:image.src,selectionMethod:'blocks',blockContext:blockContext(layout,[b.id])})));}
  if(b.rect)section.append(button(ui('原文','Source'),()=>onOriginal({...source,rect:b.rect,blockIds:[b.id]})));
  for(const control of section.querySelectorAll("button")){control.dataset.label=control.textContent;control.setAttribute("aria-label",control.title||control.textContent);control.textContent="";}
  article.append(section);
 }
 if(!layout.blocks.length)article.append(node('p',ui('此页没有可提取文字。识别后可在这里阅读。','No extractable text on this page. Run OCR to read it here.')),button(ui('识别本页文字','Recognize page text'),onOCR));
 host.replaceChildren(article);return article;
}
export function selectionReview(source,{onSend,onNote,onSource,preferred,isCurrent=()=>true}){
 const {root,body}=modal(ui('选段','Selection')),editor=node('textarea',undefined,{className:'quote-editor'}),parts=node('div',undefined,{className:'sentence-options'});editor.value=source.text||'';
 if(source.image)body.append(node('img',undefined,{src:source.image,alt:ui('引用原图','Source image'),className:'quote-image'}));
 const chunks=sentences(source.text||'');if(chunks.length>1&&chunks.length<60){const chosen=new Set(chunks.map((_,i)=>i));for(const [i,text]of chunks.entries()){const label=node('label'),check=node('input',undefined,{type:'checkbox',checked:true});check.onchange=()=>{check.checked?chosen.add(i):chosen.delete(i);editor.value=chunks.filter((_,j)=>chosen.has(j)).join(' ');};label.append(check,node('span',text));parts.append(label);}}
 body.append(parts,editor);if(source.image)body.append(node('p',ui('原图会保存到笔记；当前 AI 依据下方文字与原文上下文解读。可先补充图中信息。','The image is kept in notes. AI uses the text below and document context; add image details if needed.')));
 const actions=node('div',undefined,{className:'selection-actions'});body.append(actions);
 async function act(kind){if(!isCurrent()){root.close();return;}const text=editor.value.trim()||(kind==='note'&&source.image?ui('原文图表','Source figure'):'');if(!text||text.length>16000){editor.setCustomValidity(ui('请输入 1–16000 字的选段。','Enter 1–16,000 characters.'));editor.reportValidity();return;}editor.setCustomValidity('');const q={...source,text};root.close();if(kind==='note')await onNote(q);else await onSend(q,kind);}
 for(const [kind,zh,en]of [['explain','解释','Explain'],['steps','分步','Steps'],['visual','可视化','Visualize'],['note','记笔记','Add note']]){const b=button(ui(zh,en),()=>act(kind));if(kind===preferred)b.classList.add('primary');actions.append(b);}
 if(source.id)actions.append(button(ui('原文','Source'),()=>{root.close();onSource(source);}));editor.focus();return root;
}
export function dropFeedback(host,event){
 document.querySelector('.drop-feedback')?.remove();
 const bounds=host.getBoundingClientRect(),x=Math.max(bounds.left+60,Math.min(bounds.right-60,event?.clientX??bounds.left+bounds.width/2)),y=Math.max(bounds.top+80,Math.min(bounds.bottom-80,event?.clientY??bounds.top+130));
 const overlay=node('div',undefined,{className:'drop-feedback'});overlay.style.left=x+'px';overlay.style.top=y+'px';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
 const rings=node('span',undefined,{className:'drop-waves'});rings.setAttribute('aria-hidden','true');rings.append(node('i'),node('i'));overlay.append(rings,node('span',ui('选段已接收','Passage received'),{className:'drop-received'}));document.body.append(overlay);
 setTimeout(()=>overlay.remove(),1600);return overlay;
}
