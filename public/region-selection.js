import {ui,node,button,modal,showError} from './workspace-ui.js';
import {clamp,rectangle,adjustRectangle,containsCenter,joinGlyphs} from './region-geometry.js';
import {normalizeOCRText} from './ocr-text.js';

export function selectReadingRegion({getState,store,addNote,visualize,onClose=()=>{}}){
 const initial=getState(),page=document.querySelector('#documentContent [data-page="'+initial.page+'"]');
 if(!initial.ready||!page)throw Error(ui('请先打开文献','Open a document first'));
 const same=()=>page.isConnected&&getState().ready&&getState().entry.id===initial.entry.id&&getState().entry.revision===initial.entry.revision&&getState().page===initial.page;
 const overlay=node('div',undefined,{className:'precision-overlay',tabIndex:0}),box=node('div',undefined,{className:'precision-box',tabIndex:0}),dock=node('div',undefined,{className:'precision-dock'});
 overlay.setAttribute('aria-label',ui('拖动框选原文；空格创建选区，Escape 取消','Drag to select; Space creates a selection, Escape cancels'));
 const trigger=document.getElementById('selectRegion');trigger?.setAttribute('aria-pressed','true');
 box.setAttribute('aria-label',ui('移动选区，方向键微调，Shift 加速','Move selection; arrow keys to adjust, Shift for larger steps'));
 box.dataset.handle='move';box.hidden=true;
 let rect=null,drag=null,closed=false,preview=null,worker=null,recognition=0;
 const previewButton=button(ui('预览选区','Preview selection'),openPreview);previewButton.disabled=true;
 dock.append(button(ui('取消','Cancel'),close),previewButton);overlay.append(box);page.append(overlay);document.querySelector('.reader-body').append(dock);
 const handles={nw:['左上','Top left'],n:['上边','Top'],ne:['右上','Top right'],e:['右边','Right'],se:['右下','Bottom right'],s:['下边','Bottom'],sw:['左下','Bottom left'],w:['左边','Left']};
 for(const [id,label]of Object.entries(handles)){const h=node('button',undefined,{type:'button',className:'precision-handle handle-'+id});h.dataset.handle=id;h.setAttribute('aria-label',ui('调整'+label[0], 'Resize '+label[1]));box.append(h);}
 function paint(){box.hidden=!rect;if(!rect)return;Object.assign(box.style,{left:rect[0]*100+'%',top:rect[1]*100+'%',width:rect[2]*100+'%',height:rect[3]*100+'%'});previewButton.disabled=rect[2]<.005||rect[3]<.005;}
 function pos(e){const b=overlay.getBoundingClientRect();return [clamp((e.clientX-b.left)/b.width),clamp((e.clientY-b.top)/b.height)];}
 overlay.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const at=pos(e),handle=e.target.closest('[data-handle]')?.dataset.handle;drag={at,handle,rect:rect?.slice()};if(!handle){rect=rectangle(at,at);paint();}overlay.setPointerCapture(e.pointerId);};
 overlay.onpointermove=e=>{if(!drag)return;const at=pos(e);rect=drag.handle?adjustRectangle(drag.rect,drag.handle,at[0]-drag.at[0],at[1]-drag.at[1]):rectangle(drag.at,at);paint();};
 overlay.onpointerup=e=>{if(!drag)return;drag=null;if(overlay.hasPointerCapture(e.pointerId))overlay.releasePointerCapture(e.pointerId);box.focus({preventScroll:true});};
 overlay.onpointercancel=()=>{drag=null;};
 overlay.onkeydown=e=>{if(e.key===' '&&!rect){e.preventDefault();rect=[.15,.15,.7,.2];paint();box.focus({preventScroll:true});return;}if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key==='Enter'&&!previewButton.disabled){e.preventDefault();openPreview().catch(err=>showError(err.message));return;}if(!rect||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const b=overlay.getBoundingClientRect(),step=e.shiftKey?10:1;rect=adjustRectangle(rect,e.target.dataset.handle||'move',(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)/b.width,(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)/b.height);paint();};
 overlay.focus({preventScroll:true});
 function close(){if(closed)return;closed=true;recognition++;worker?.terminate().catch(()=>{});worker=null;preview?.close();overlay.remove();dock.remove();trigger?.setAttribute('aria-pressed','false');onClose();}
 function extract(){
  const root=page.querySelector('.textLayer')||page,bounds=page.getBoundingClientRect(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),glyphs=[];let textNode,count=0;
  while(textNode=walker.nextNode()){
   if(textNode.parentElement.closest('.precision-overlay,.annotation-layer'))continue;
   for(let i=0;i<textNode.length&&count<100000;i++,count++){
    const r=document.createRange();r.setStart(textNode,i);r.setEnd(textNode,i+1);const b=r.getBoundingClientRect();if(!b.width||!b.height)continue;
    const g={text:textNode.textContent[i],x:(b.left-bounds.left)/bounds.width,y:(b.top-bounds.top)/bounds.height,width:b.width/bounds.width,height:b.height/bounds.height};if(containsCenter(rect,g))glyphs.push(g);
   }
  }
  return joinGlyphs(glyphs);
 }
 function crop(){const original=page.querySelector('canvas');if(!original)return null;const canvas=document.createElement('canvas'),sx=Math.round(rect[0]*original.width),sy=Math.round(rect[1]*original.height);canvas.width=Math.max(1,Math.min(original.width-sx,Math.round(rect[2]*original.width)));canvas.height=Math.max(1,Math.min(original.height-sy,Math.round(rect[3]*original.height)));canvas.getContext('2d').drawImage(original,sx,sy,canvas.width,canvas.height,0,0,canvas.width,canvas.height);return canvas;}
 async function openPreview(){
  if(closed||preview?.open||!same())return;const chosen=rect.slice(),canvas=crop(),image=canvas?.toDataURL('image/png'),{root,body}=modal(ui('选区','Selection'));preview=root;root.classList.add('selection-preview');
  const editor=node('textarea',undefined,{className:'selection-text',value:extract(),maxLength:16000});editor.setAttribute('aria-label',ui('选区文字，可校正','Selected text, editable'));
  const status=node('p','',{className:'selection-status'});status.setAttribute('role','status');
  if(image)body.append(node('img',undefined,{src:image,alt:ui('原文选区','Source region')}));
  body.append(editor,status);if(!editor.value.trim())status.textContent=ui('选区没有可提取文字，可识别图片或手动输入。','No selectable text. Recognize the image or enter text.');
  const actions=node('div',undefined,{className:'selection-actions'});
  const source={id:initial.entry.id,documentId:initial.entry.documentId,revision:initial.entry.revision,name:initial.entry.name,page:initial.page,rect:chosen};
  let regionId=null;
  async function persist(){if(!same())throw Error(ui('原文页面已改变，请重新框选','The source page changed. Select again.'));if(image){regionId??=crypto.randomUUID();await store.put('regions',{id:regionId,source,image});}return {...source,...(regionId?{regionId}:{}),text:editor.value.trim(),selectionMethod:'region'};}
  const send=button(ui('解读选区','Explain selection'),async()=>{if(!editor.value.trim()&&!image)return;if(editor.value.length>16000)throw Error(ui('选区文字过长，请缩小范围或删减至 16000 字以内。','Selection too long. Reduce it to 16,000 characters.'));const s=await persist();close();await visualize(s,true,{question:s.text||ui('请解读这张图片，核对其中的文字和公式。','Explain this image and read its text and formulas.')} );});
  send.disabled=!editor.value.trim()&&!image;editor.oninput=()=>{send.disabled=!editor.value.trim()&&!image;};
  if(canvas)actions.append(button(ui('识别图片文字','Recognize text'),async()=>{
   const token=++recognition,original=editor.value;status.textContent=ui('正在识别…','Recognizing…');send.disabled=true;
   try{if(!globalThis.Tesseract)await new Promise((resolve,reject)=>{const script=node('script',undefined,{src:'/ocr/tesseract.min.js'});script.onload=resolve;script.onerror=()=>reject(Error('OCR unavailable'));document.head.append(script);});if(closed||!root.open||token!==recognition)return;
    const w=await Tesseract.createWorker(['eng','chi_sim'],1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr-core',langPath:'/ocr-data',workerBlobURL:false});if(closed||!root.open||token!==recognition){await w.terminate();return;}worker=w;const result=await w.recognize(canvas);await w.terminate();if(worker===w)worker=null;if(closed||!root.open||token!==recognition||!same())return;
    if(editor.value===original)editor.value=normalizeOCRText(result.data.text).slice(0,16000);status.textContent=ui('请对照图片校正公式和符号。','Check formulas and symbols against the image.');
   }catch(error){if(root.open)status.textContent=ui('识别失败，可手动填写后继续。','Recognition failed. You can enter text manually.');}finally{if(root.open)send.disabled=!editor.value.trim()&&!image;}
  }));
  actions.append(button(ui('调整范围','Adjust region'),()=>root.close()),button(ui('存为笔记','Save to notes'),async()=>{const s=await persist();addNote(editor.value.trim()||ui('原文选区','Source region'),s);close();}),send);body.append(actions);
  root.addEventListener('close',()=>{recognition++;worker?.terminate().catch(()=>{});worker=null;if(preview===root)preview=null;if(!closed)box.focus({preventScroll:true});});
  editor.focus();
 }
 return close;
}
