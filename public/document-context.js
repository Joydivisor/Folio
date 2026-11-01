const abort = signal => {if(signal?.aborted)throw new DOMException('已停止读取文献','AbortError');};
const normalize = text => text.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
function terms(text){
 const result=new Set((text.normalize('NFKC').toLowerCase().match(/[a-z][a-z0-9_-]{1,}|[α-ω]|[\u4e00-\u9fff]{2,}/g)||[]).flatMap(word=>/[\u4e00-\u9fff]/.test(word)?Array.from({length:word.length-1},(_,i)=>word.slice(i,i+2)):[word]));
 for(const word of ['这个','这里','上面','为什么','解释','一下','请问','如何','什么','这段','内容'])result.delete(word);
 return [...result].slice(0,100);
}
export function explicitReferences(text){return [...String(text).matchAll(/(?:theorem|lemma|definition|proposition|corollary|equation|figure|table|定理|引理|定义|命题|推论|公式|图|表)\s*\(?([0-9]+(?:\.[0-9]+)*)\)?/gi)].map(m=>({label:m[0].replace(/\s+/g,''),number:m[1]}));}
export function selectContext(pages,selection,anchorPage,{budget=14000}={}){
 const available=pages.filter(p=>p.text?.trim());
 if(available.reduce((n,p)=>n+p.text.length+30,0)<=budget)return available.map(p=>({page:p.page,text:p.text}));
 const query=terms(selection),needle=normalize(selection),references=explicitReferences(selection),candidates=[];
 for(const p of available){
  for(let start=0;start<p.text.length;start+=1150){const text=p.text.slice(start,start+1500),flat=normalize(text);let score=query.reduce((n,t)=>n+(flat.includes(t)?1:0),0);
   if(p.page===anchorPage)score+=6;else if(Math.abs(p.page-anchorPage)===1)score+=2;
   if(needle.length>4&&flat.includes(needle))score+=100;
   for(const ref of references)if(flat.includes(normalize(ref.label)))score+=40;
   candidates.push({page:p.page,text,start,end:start+text.length,score});
  }
 }
 candidates.sort((a,b)=>b.score-a.score||Math.abs(a.page-anchorPage)-Math.abs(b.page-anchorPage)||a.start-b.start);
 const selected=[];let remaining=budget;
 for(const c of candidates){if(remaining<400||selected.length>=12)break;if(c.score<=0&&selected.length>=3)break;
  if(selected.some(s=>s.page===c.page&&c.start<s.end&&c.end>s.start))continue;
  const text=c.text.slice(0,remaining-30);selected.push({...c,text});remaining-=text.length+30;
 }
 return selected.sort((a,b)=>a.page-b.page||a.start-b.start).map(({page,text})=>({page,text}));
}
export function createDocumentIndex({id,name,total,readPage,loadPages=async()=>[],savePage=async()=>{}}){
 const cache=new Map();
 const loaded=loadPages().then(pages=>{for(const p of pages)if(p.page>0&&p.page<=total&&!p.failed)cache.set(p.page,p);});
 return {id,name,total,async retrieve(selection,anchorPage,{signal,onProgress=()=>{}}={}){
  await loaded;abort(signal);
  let done=cache.size;onProgress(done,total);
  const order=[anchorPage,anchorPage-1,anchorPage+1,...Array.from({length:total},(_,i)=>i+1)].filter((n,i,a)=>n>0&&n<=total&&a.indexOf(n)===i);
  for(let start=0;start<order.length;start+=3){abort(signal);await Promise.all(order.slice(start,start+3).map(async page=>{
   if(cache.has(page)&&!cache.get(page).failed)return;abort(signal);
   try{const text=await readPage(page);abort(signal);const record={page,text:String(text)};await savePage(record);cache.set(page,record);}catch(error){if(signal?.aborted||error.name==='AbortError')throw error;cache.set(page,{page,text:'',failed:true});}
   onProgress(++done,total);
  }));}
  abort(signal);const pages=[...cache.values()].sort((a,b)=>a.page-b.page),excerpts=selectContext(pages,selection,anchorPage);
  return {documentId:id,name,total,scanned:pages.length,failedPages:pages.filter(p=>p.failed).map(p=>p.page),emptyPages:pages.filter(p=>!p.text.trim()&&!p.failed).map(p=>p.page),excerpts,text:excerpts.map(p=>'[第 '+p.page+' 页]\n'+p.text).join('\n\n')};
 }};
}
