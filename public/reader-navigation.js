import {selectReadingRegion} from './region-selection.js';
import {ui,node,button,modal} from './workspace-ui.js';
export function setupReaderNavigation({getState,goPage,store,addNote,visualize,onContextChanged,stageSource}){
 let active=null,closeRegion=null;
 function stop(){closeRegion?.();closeRegion=null;active?.abort();active=null;}
 function identity(){const s=getState();if(!s.ready)throw Error(ui('请先打开文献','Open a document first'));return s;}
 const same=s=>getState().ready&&getState().entry.id===s.entry.id&&getState().entry.revision===s.entry.revision;
 async function navigate(s,page,text){if(!same(s))throw Error(ui('文献已切换','The document has changed'));await goPage(page);if(!same(s)||!text)return;const host=document.querySelector('#documentContent [data-page="'+page+'"]')||document.getElementById('documentContent'),walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT),ranges=[],nodes=[];let n,full='';while(n=walker.nextNode()){nodes.push({node:n,start:full.length,end:full.length+n.textContent.length});full+=n.textContent;}const needle=text.toLowerCase();for(let at=full.toLowerCase().indexOf(needle);at>=0;at=full.toLowerCase().indexOf(needle,at+needle.length)){const first=nodes.find(x=>x.end>at),last=nodes.find(x=>x.end>=at+needle.length);if(first&&last){const r=document.createRange();r.setStart(first.node,at-first.start);r.setEnd(last.node,at+needle.length-last.start);ranges.push(r);}}if(globalThis.Highlight)CSS.highlights.set('folio-search',new Highlight(...ranges));}
 async function open(){const s=identity(),{root,body}=modal(ui('目录与全文搜索','Outline & full-text search')),status=node('p','',{className:'muted'}),results=node('div',undefined,{className:'navigation-results'}),input=node('input',undefined,{type:'search',placeholder:ui('搜索本书文字','Search this document')});const actions=node('div',undefined,{className:'workspace-actions'});let controller=new AbortController();stop();active=controller;root.addEventListener('close',stop);body.append(input,actions,status,results);
  actions.append(button(ui('搜索','Search'),async()=>{if(!input.value.trim())return;if(controller.signal.aborted){controller=new AbortController();active=controller;}results.replaceChildren();status.textContent=ui('正在建立索引…','Indexing…');const index=s.index();const found=await index.retrieve(input.value,s.page,{signal:controller.signal,onProgress:(n,total)=>status.textContent=n+' / '+total});if(!same(s)||controller.signal.aborted)return;const pages=(await store.all('pages')).filter(p=>p.documentId===(s.entry.documentId||s.entry.id)&&p.revision===s.entry.revision);let count=0;for(const p of pages){const at=p.text.toLowerCase().indexOf(input.value.toLowerCase());if(at<0)continue;count++;results.append(button(ui('第 '+p.page+' 页 · ','Page '+p.page+' · ')+p.text.slice(Math.max(0,at-45),at+170),async()=>{root.close();await navigate(s,p.page,input.value);}));}status.textContent=ui(count+' 页匹配','Matches on '+count+' pages')+(s.ocr&&found.emptyPages.length?ui(' · '+found.emptyPages.length+' 页尚无文字，可先识别整本。',' · '+found.emptyPages.length+' pages have no text yet. Recognize all scanned pages to include them.'):'');}),button(ui('停止','Stop'),()=>{controller.abort();status.textContent=ui('已停止；已完成的页保留在索引中','Stopped; completed pages remain indexed');}));input.onkeydown=e=>{if(e.key==='Enter')actions.querySelector('button').click();};
  if(s.ocr)actions.append(button(ui('识别整本扫描文字','Recognize all scanned pages'),async()=>{
   if(controller.signal.aborted){controller=new AbortController();active=controller;}
   try{const result=await s.ocr.recognizeAll({signal:controller.signal,onProgress:p=>{if(root.isConnected)status.textContent=ui('正在识别 ','Recognizing ')+p.page+' / '+p.total;}});
    if(!same(s)||controller.signal.aborted)return;status.textContent=ui('已识别 '+result.recognized+' 页，可搜索全文。','Recognized '+result.recognized+' pages. Full-text search is ready.')+(result.failed.length?ui(' 失败页：',' Failed pages: ')+result.failed.join(', '):'');
   }catch(e){if(e.name==='AbortError')status.textContent=ui('已停止；已识别的页保留','Stopped; recognized pages are retained');else status.textContent=e.message;}
  }));
  if(s.pdf){const outline=await s.pdf.getOutline();if(!root.isConnected||!same(s))return;const walk=(items,depth=0)=>{for(const item of items||[]){if(depth>15)break;const b=button(item.title,async()=>{let dest=typeof item.dest==='string'?await s.pdf.getDestination(item.dest):item.dest;if(!dest)return;const page=typeof dest[0]==='number'?dest[0]+1:await s.pdf.getPageIndex(dest[0])+1;root.close();await navigate(s,page);});b.style.paddingLeft=12+depth*16+'px';results.append(b);walk(item.items,depth+1);}};walk(outline);if(!outline?.length)status.textContent=ui('此 PDF 没有内置目录，可以使用全文搜索。','This PDF has no embedded outline. Full-text search is available.');}
 }
 async function recognize(){
  const s=identity();if(!s.pdf||!s.ocr)throw Error(ui('OCR 用于 PDF 页面','OCR is available for PDF pages'));
  const {root,body}=modal(ui('本页文字识别 · 本地运行','Page OCR · on-device')),status=node('p',ui('准备识别…','Preparing…')),editor=node('textarea',undefined,{className:'ocr-editor'});
  stop();const controller=new AbortController();active=controller;root.addEventListener('close',stop);editor.setAttribute('aria-label',ui('识别文字，可校正','Recognized text, editable'));body.append(status,editor);
  const actions=node('div',undefined,{className:'workspace-actions'}),save=button(ui('保存校正后的文字','Save corrected text'),async()=>{
   if(!same(s)||!record)throw Error('Document changed');
   const changed=editor.value!==record.text;
   await store.put('pages',{...record,text:editor.value,words:changed?[]:record.words,corrected:changed||record.corrected,versions:[...(record.versions||[]).slice(-9),{text:record.text,date:new Date().toISOString()}]});
   root.close();onContextChanged();
  });save.disabled=true;let record;
  async function run(force=false){
   save.disabled=true;retry.disabled=true;
   try{record=await s.ocr.recognize(s.page,{force,signal:controller.signal,onProgress:m=>{if(root.isConnected)status.textContent=ui('本地识别 ','Local OCR ')+Math.round((m.progress||0)*100)+'%';}});
    if(controller.signal.aborted||!same(s)||!root.isConnected)return;
    if(!record){status.textContent=ui('此页已有原生文字，可直接选取；需要时可重新识别。','This page has native text. Select it directly or run OCR again.');return;}
    editor.value=record.text;save.disabled=false;status.textContent=ui('识别置信度 ','Recognition confidence ')+Math.round(record.confidence||0)+'% · '+ui('可对照原页校正。校正后的文字用于搜索与引用。','Review against the source. Corrections are used for search and citations.');
    const transcript=node('div',record.text,{className:'ocr-transcript'});transcript.setAttribute('aria-label',ui('可选择并拖动的识别文字','Selectable recognized text'));body.querySelector('.ocr-transcript')?.remove();body.append(transcript);
   }catch(e){if(controller.signal.aborted)status.textContent=ui('已取消','Cancelled');else status.textContent=ui('识别失败，可重试。','Recognition failed. Try again.');}
   finally{retry.disabled=controller.signal.aborted;}
  }
  const retry=button(ui('重新识别本页','Recognize again'),()=>run(true));actions.append(save,retry,button(ui('取消识别','Cancel recognition'),()=>{controller.abort();status.textContent=ui('已取消','Cancelled');}));
  if(stageSource)actions.append(button(ui('加入提问','Quote in prompt'),()=>{if(!editor.value.trim()||!same(s))return;const source={id:s.entry.id,documentId:s.entry.documentId,revision:s.entry.revision,name:s.entry.name,page:s.page,text:editor.value.slice(0,16000),ocr:true};root.close();stageSource(source);}));
  body.append(actions);await run();
 }

 function region(){identity();stop();closeRegion=selectReadingRegion({getState,store,addNote,visualize,onClose:()=>{closeRegion=null;}});}
 return {open,recognize,region,stop,navigate};
}
