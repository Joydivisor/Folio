import {normalizeOCRText} from './ocr-text.js';
import {layoutText} from './reflow-layout.js';
import {enhancePDFSelection} from './pdf-selection.js';

export const OCR_VERSION=2;
export function needsOCR(items=[]){const text=items.map(i=>i.str||'').join('').replace(/\s/g,'');return (text.match(/[\p{L}\p{N}]/gu)||[]).length<12||((text.match(/\uFFFD/g)||[]).length>text.length*.2);}
const aborted=signal=>{if(signal?.aborted)throw new DOMException('OCR stopped','AbortError');};
function cancellable(promise,signal){return new Promise((resolve,reject)=>{const stop=()=>{cleanup();reject(new DOMException('OCR stopped','AbortError'));},cleanup=()=>signal?.removeEventListener('abort',stop);signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)return stop();Promise.resolve(promise).then(v=>{cleanup();resolve(v);},e=>{cleanup();reject(e);});});}
let runtime;
function loadRuntime(){if(globalThis.Tesseract)return Promise.resolve(globalThis.Tesseract);return runtime??=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/ocr/tesseract.min.js';s.onload=()=>resolve(globalThis.Tesseract);s.onerror=()=>{s.remove();runtime=null;reject(Error('Local OCR runtime unavailable'));};document.head.append(s);});}

export function ocrWords(data,width,height){
 const words=[];
 for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const [i,word] of (line.words||[]).entries()){
  const b=word.bbox;if(!b||![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite)||b.x1<=b.x0||b.y1<=b.y0)continue;
  const x=Math.max(0,b.x0/width),y=Math.max(0,b.y0/height);if(x>=1||y>=1)continue;
  const text=normalizeOCRText(word.text||'').trim();if(!text)continue;
  const next=line.words[i+1]?.text||'';
  words.push({text,rect:[x,y,Math.min(1-x,(b.x1-b.x0)/width),Math.min(1-y,(b.y1-b.y0)/height)],eol:i===line.words.length-1,space:!!next&&!/[\u3400-\u9fff]$/.test(text)});
 }
 return words;
}

// One worker and one bounded page canvas per document. Visible pages are queued first.
export function createPDFOCR({pdf,entry,store,onPage=()=>{}}){
 const life=new AbortController(),jobs=new Map();let tail=Promise.resolve(),worker=null,idleTimer,progress=()=>{};
 const key=page=>entry.id+':'+entry.revision+':'+page;
 async function release(){clearTimeout(idleTimer);const old=worker;worker=null;if(old)await old.terminate().catch(()=>{});}
 async function getWorker(signal){
  clearTimeout(idleTimer);if(worker)return worker;const api=await cancellable(loadRuntime(),signal);aborted(signal);
  const pending=api.createWorker(['chi_sim','eng'],1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr-core',langPath:'/ocr-data',workerBlobURL:false,logger:m=>progress(m)});
  pending.then(w=>{if(signal.aborted)w.terminate().catch(()=>{});},()=>{});
  worker=await cancellable(pending,signal);
  // Tesseract.js defaults to a single text block, which joins adjacent columns.
  await cancellable(worker.setParameters({tessedit_pageseg_mode:api.PSM.AUTO}),signal);return worker;
 }
 async function cached(page){const record=await store.get('pages',key(page));return record?.corrected||record?.ocrVersion===OCR_VERSION?record:null;}
 function recognize(page,{force=false,signal,onProgress=()=>{}}={}){
  if(!force&&jobs.has(page))return cancellable(jobs.get(page),signal);
  const combined=signal?AbortSignal.any([signal,life.signal]):life.signal;
  const task=tail.catch(()=>{}).then(async()=>{
   aborted(combined);const previous=await store.get('pages',key(page));aborted(combined);
   if(previous?.ocr&&!force&&(previous.corrected||previous.ocrVersion===OCR_VERSION))return previous;
   const p=await pdf.getPage(page),content=await p.getTextContent();aborted(combined);
   if(!force&&!needsOCR(content.items))return null;
   progress=onProgress;onProgress({status:'preparing',progress:0});
   let canvas,render;const cancel=()=>{render?.cancel();void release();};combined.addEventListener('abort',cancel,{once:true});
   try{
    const w=await getWorker(combined),natural=p.getViewport({scale:1}),scale=Math.min(300/72,3600/Math.max(natural.width,natural.height),Math.sqrt(9000000/(natural.width*natural.height))),v=p.getViewport({scale});aborted(combined);
    canvas=document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
    render=p.render({canvasContext:canvas.getContext('2d'),viewport:v});await cancellable(render.promise,combined);aborted(combined);
    const result=await cancellable(w.recognize(canvas,{}, {text:true,blocks:true}),combined);aborted(combined);
    const record={id:key(page),documentId:entry.documentId||entry.id,revision:entry.revision,page,text:normalizeOCRText(result.data.text),words:ocrWords(result.data,canvas.width,canvas.height),ocr:true,ocrVersion:OCR_VERSION,confidence:result.data.confidence,versions:previous?.versions||[]};
    await store.put('pages',record);aborted(combined);onPage(record);return record;
   }catch(error){await release();throw error;}
   finally{combined.removeEventListener('abort',cancel);if(canvas){canvas.width=0;canvas.height=0;}progress=()=>{};idleTimer=setTimeout(()=>void release(),30000);}
  });tail=task;jobs.set(page,task);task.finally(()=>{if(jobs.get(page)===task)jobs.delete(page);}).catch(()=>{});return task;
 }
 async function recognizeAll({signal,onProgress=()=>{}}={}){
  let recognized=0;const failed=[];
  for(let page=1;page<=pdf.numPages;page++){aborted(life.signal);aborted(signal);try{if(await recognize(page,{signal}))recognized++;}catch(e){if(e.name==='AbortError')throw e;failed.push(page);}onProgress({page,total:pdf.numPages,recognized,failed:[...failed]});}
  return {recognized,failed};
 }
 return {cached,recognize,recognizeAll,destroy(){life.abort();void release();}};
}

export function mountOCRLayer({record,layer,wrap,natural,page,onSelect}){
 const viewport={width:natural.width,height:natural.height,scale:1,rotation:0,convertToViewportPoint:(x,y)=>[x,y]};
 const items=(record.words||[]).map(w=>({str:w.text+(w.space?' ':''),width:w.rect[2]*natural.width,transform:[1,0,0,w.rect[3]*natural.height,w.rect[0]*natural.width,(w.rect[1]+w.rect[3])*natural.height],hasEOL:w.eol}));
 const layout=layoutText(items,viewport,page),measure=document.createElement('canvas').getContext('2d'),textDivs=[];
 layer.replaceChildren();layer.classList.add('ocr-text-layer');
 for(const [i,w] of (record.words||[]).entries()){
  const span=document.createElement('span'),size=Math.max(1,w.rect[3]*wrap.clientHeight);span.textContent=items[i].str;measure.font=size+'px sans-serif';
  Object.assign(span.style,{left:w.rect[0]*100+'%',top:w.rect[1]*100+'%',fontSize:size+'px',lineHeight:'1',transform:'scaleX('+(w.rect[2]*wrap.clientWidth/Math.max(1,measure.measureText(w.text).width))+')'});textDivs.push(span);layer.append(span);
 }
 const controls=enhancePDFSelection({layer,textDivs,items,layout,viewport,wrap,onSelect});
 return {layout,controls};
}
