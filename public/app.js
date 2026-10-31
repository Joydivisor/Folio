import {setupShell} from './shell.js';
import {t,language} from './i18n.js';
import {createConversations} from './conversations.js';
import {setupNotebook} from './notebook.js';
import {requestStructured} from './structured-response.js';
import {createDocumentIndex} from './document-context.js';
import {requestReading,parseReading,mountReadingAnswer} from './reading-response.js';
import {sourceLabel} from './source-label.js';
import {verifyPlanAgainstSource} from './source-verification.js';
import {mountConcept} from './concept-view.js';
import {setupAnnotations} from './annotations.js';
import {requestUnderstanding,parseUnderstanding} from './understanding.js';
import {mountPermutation} from './permutation-view.js';
import {enhanceSelects} from './select-menu.js';
import {mountScene} from './scene-view.js';
import {parseGraph,requestGraph} from './graph-schema.js';
import {icon,hydrateIcons} from './icons.js';
import {identity,compose,cycles,permutations,derived,commutator,key} from './groups.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readLocal=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
function saveLocal(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{toast('浏览器存储空间不足，本次更改尚未保存。');}}
let toastTimer;function toast(message){$('toast').textContent=t(message);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function guard(fn){return (...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>{if(e.name!=='AbortError')toast(e.message||'操作失败，请重试。');});}
const dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('jianwei-library',1);r.onupgradeneeded=()=>{r.result.createObjectStore('meta');r.result.createObjectStore('files',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function dbOp(store,method,...args){const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction(store,method==='get'||method==='getAll'?'readonly':'readwrite');const req=tx.objectStore(store)[method](...args);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
let folder=null,folderGranted=false,folderEntries=[],cachedEntries=[];
let current={id:'demo',name:'置换群与可解群',kind:'demo'},page=1,total=2,zoom=1,pdf=null,pdfLib=null,renderToken=0,pageText='',selected=null,quote=null;
const positions=readLocal('jianwei-positions',{}),notes=readLocal('jianwei-notes',[]);
let requestController=null,activeLab='permutation';
let rememberConversations=readLocal('folio-remember-conversations',false)===true;
const conversations=createConversations({enabled:()=>rememberConversations,save:note=>{const index=notes.findIndex(n=>n.id===note.id);if(index>=0)notes[index]=note;else notes.unshift(note);saveLocal('jianwei-notes',notes);renderNotes();}});
let desktopKey={configured:false,persisted:false},serverKey=false;
const hasKey=()=>Boolean(settings.apiKey||desktopKey.configured||serverKey);
let settings={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',thinking:false,...readLocal('jianwei-settings',{}),apiKey:''};
let mathRenderer=null;
import('/katex/contrib/auto-render.mjs').then(m=>{mathRenderer=m.default;document.querySelectorAll('.reading-answer,.notebook-prose,#notebookDetail details').forEach(renderMath);}).catch(()=>{});
function renderMath(el){if(mathRenderer)mathRenderer(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false,trust:false,strict:'ignore'});}
const demoPages=[
`<div class="paper-topline"><span>Folio · 近世代数交互导读</span><span>GROUP THEORY</span></div><span class="chapter">CHAPTER 01 / 从作用理解结构</span><h1>置换：把元素重新安排</h1><p>考虑集合 Ω = {1, 2, 3}。从 Ω 到自身的一个双射称为 Ω 上的一个<b>置换</b>。所有这样的置换组成对称群 S₃，群的运算是映射的复合。</p><div class="definition"><b>定义 · 循环记号</b><br>σ = (1 2 3) 表示 1 ↦ 2，2 ↦ 3，3 ↦ 1。<br>τ = (1 2) 表示交换 1 和 2，并保持 3 不变。</div><h2>1.1　复合的顺序</h2><p>约定 στ 表示先作用 τ，再作用 σ。观察元素 1：τ 先把它送到 2，σ 再把 2 送到 3。因此 (στ)(1) = 3。</p><div class="formula">στ = (1 3)，　τσ = (2 3)</div><p>交换作用的顺序，得到的置换也会改变。这说明 S₃ 不是阿贝尔群。你可以选中这一段，引用到右侧追问，也可以直接动手验证。</p><button class="paper-demo-button" data-experiment="permutation">↗ 在右侧试一试这两个置换</button><h2>1.2　回到起点</h2><p>连续三次作用 σ，每个元素都回到原位，即 σ³ = e。使一个群元素的正整数次幂首次等于恒等元的指数，称为该元素的阶。</p><p class="margin-note">想一想：τ 的阶是多少？σ² 又对应哪个循环？</p><div class="paper-footer">1</div>`,
`<div class="paper-topline"><span>Folio · 近世代数交互导读</span><span>GROUP THEORY</span></div><span class="chapter">CHAPTER 02 / 沿着导出列向下走</span><h1>可解群：逐层取交换子群</h1><p>交换子衡量两个元素偏离交换的程度。这里约定 [a,b] = aba⁻¹b⁻¹；如果 a 和 b 交换，那么 [a,b] = e。</p><div class="definition"><b>定义 · 导出列与可解群</b><br>令 G⁽⁰⁾ = G，递归定义 G⁽ᵏ⁺¹⁾ = [G⁽ᵏ⁾, G⁽ᵏ⁾]，右侧表示由当前群中所有交换子生成的子群。如果存在有限的 r 使 G⁽ʳ⁾ = {e}，则称 G 为可解群。</div><h2>2.1　从 S₃ 开始</h2><div class="formula">S₃ ⟶ A₃ ⟶ {e}<br><small>6 个元素　　3 个元素　　1 个元素</small></div><p>S₃ 的交换子群是 A₃ = {e, (1 2 3), (1 3 2)}。A₃ 是循环群，因此是阿贝尔群，它的所有交换子都是 e。导出列到达平凡群，所以 S₃ 可解。</p><button class="paper-demo-button" data-experiment="derived">↗ 逐步计算这条导出列</button><h2>2.2　每次都会变小吗？</h2><p>不一定。对 S₅，有 [S₅,S₅] = A₅，而 [A₅,A₅] = A₅。导出列稳定在一个非平凡群上，因此 S₅ 不可解。</p><p class="margin-note">在右侧切换 S₃、S₄、S₅，比较导出列。计算展示具体例子，定义和论证说明它们为什么成立。</p><div class="paper-footer">2</div>`];
function entries(){return [{id:'demo',name:'置换群与可解群',kind:'demo',path:'内置交互导读 · 2 页'},...folderEntries,...cachedEntries];}
function supports(name){return /\.(pdf|txt|md)$/i.test(name);}

let libraryFilter='all',libraryDisplay=readLocal('folio-display','list'),selectedDocument=null;
const favorites=new Set(readLocal('jianwei-favorites',[])),recent=readLocal('jianwei-recent',{});
function showLibrary(){endConversation();setCanvasFocus(false);document.body.dataset.view='library';$('libraryHome').hidden=false;$('readingWorkspace').hidden=true;$('viewTitle').textContent='Library';$('libraryButton').classList.add('active');$('readerTab').classList.remove('active');renderLibrary();}
function showReader(){if(location.hash.startsWith('#/notes'))history.replaceState(null,'',location.pathname);document.body.dataset.view='reader';$('libraryHome').hidden=true;$('readingWorkspace').hidden=false;$('viewTitle').textContent='Reader';$('libraryButton').classList.remove('active');$('readerTab').classList.add('active');$('readerTabGroup').hidden=false;}
function folderDot(path){const colors=['#e6b85c','#61c5a3','#729fe0','#ce82ab','#a88cdb'];const hash=[...path].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);return '<i class="folder-dot" style="--dot:'+colors[hash%colors.length]+'" aria-hidden="true"></i>';}
function renderFolders(){const paths=new Set();for(const e of folderEntries){const pieces=e.path.split('/');pieces.pop();for(let i=1;i<=pieces.length;i++)paths.add(pieces.slice(0,i).join('/'));}let content=folder?'<button data-folder="folder:" class="'+(libraryFilter==='folder:'?'active':'')+'">'+folderDot(folder.name)+'<span>'+esc(folder.name)+'</span></button>':'<div class="folder-placeholder">尚未连接</div>';for(const p of [...paths].sort())content+='<button data-folder="'+esc('folder:'+p)+'" style="padding-left:'+Math.min(35,19+p.split('/').length*7)+'px" class="'+(libraryFilter==='folder:'+p?'active':'')+'">'+folderDot(p)+'<span>'+esc(p.split('/').at(-1))+'</span></button>';$('folderTree').innerHTML=content;$('folderTree').querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.folder;history.replaceState(null,'',location.pathname);renderLibrary();});}
function formatReadTime(value){return value?new Intl.DateTimeFormat(language(),{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(value):'—';}
function selectDocument(id){
 selectedDocument=id;
 document.querySelectorAll('[data-document-row]').forEach(row=>{const active=row.dataset.documentRow===id;row.classList.toggle('selected',active);row.querySelector('[data-doc]').setAttribute('aria-pressed',String(active));});
 $('openSelected').disabled=!id;
}
function renderLibrary(){
 const isNotes=libraryFilter==='notes';$('libraryDocuments').hidden=isNotes;$('notesHome').hidden=!isNotes;$('globalNotesButton').classList.toggle('active',isNotes);if(isNotes){document.querySelectorAll('[data-filter]').forEach(b=>b.classList.remove('active'));notebook.render();return;}
 const q=$('librarySearch').value.toLowerCase();
 let list=entries().filter(e=>(e.name+' '+(e.path||'')).toLowerCase().includes(q));
 if(libraryFilter==='recent')list=list.filter(e=>recent[e.id]);
 if(libraryFilter==='starred')list=list.filter(e=>favorites.has(e.id));
 if(libraryFilter.startsWith('folder:')){const prefix=libraryFilter.slice(7);list=list.filter(e=>e.handle&&(!prefix||e.path.startsWith(prefix+'/')));}
 list.sort($('sortLibrary').value==='name'?(a,b)=>a.name.localeCompare(b.name,'zh-CN'):(a,b)=>(recent[b.id]||0)-(recent[a.id]||0));
 if(!list.some(e=>e.id===selectedDocument))selectedDocument=null;
 $('libraryCount').textContent=entries().length;
 $('resultCount').textContent=language()==='en'?list.length+(list.length===1?' document':' documents'):list.length+' 篇文献';
 $('collectionTitle').textContent=libraryFilter==='all'?'全部文献':libraryFilter==='recent'?'最近阅读':libraryFilter==='starred'?'已收藏':libraryFilter.slice(7).split('/').at(-1)||folder?.name||'本地文件夹';
 document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===libraryFilter));
 $('libraryList').classList.toggle('list-mode',libraryDisplay==='list');
 $('listColumns').hidden=libraryDisplay!=='list';
 $('gridView').classList.toggle('active',libraryDisplay==='grid');
 $('listView').classList.toggle('active',libraryDisplay==='list');
 $('libraryList').innerHTML=list.length?list.map(e=>{
  const demo=e.kind==='demo',type=demo?'导读':e.name.split('.').pop().toUpperCase(),title=e.name.replace(/\.(pdf|txt|md)$/i,''),location=demo?t('内置示例'):e.handle?(e.path.split('/').slice(0,-1).join('/')||folder?.name||'本地文件夹'):t('本地副本');
  return '<article class="document-card" data-document-row="'+esc(e.id)+'"><button class="document-open" data-doc="'+esc(e.id)+'" aria-label="'+(language()==='en'?'Select ':'选择 ')+esc(title)+'" title="'+(language()==='en'?'Double-click to read ':'双击阅读 ')+esc(title)+'"><span class="document-name">'+icon(demo?'library':'file')+'<span>'+esc(title)+'</span></span><span class="document-type">'+esc(type)+'</span><span class="document-location" title="'+esc(location)+'">'+esc(location)+'</span><span class="document-recent">'+formatReadTime(recent[e.id])+'</span></button><button class="favorite-button '+(favorites.has(e.id)?'saved':'')+'" data-favorite="'+esc(e.id)+'" aria-label="'+(language()==='en'?(favorites.has(e.id)?'Unfavorite ':'Favorite '):(favorites.has(e.id)?'取消收藏 ':'收藏 '))+esc(title)+'">'+icon('star')+'</button></article>';
 }).join(''):'<div class="empty-state">'+(libraryFilter==='starred'?'收藏的文献会出现在这里。':libraryFilter==='recent'?'还没有阅读记录。':'没有找到文献。')+'</div>';
 $('libraryList').querySelectorAll('[data-doc]').forEach(b=>{
  b.onclick=()=>selectDocument(b.dataset.doc);
  b.ondblclick=guard(()=>openDocument(entries().find(e=>e.id===b.dataset.doc)));
  b.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();guard(()=>openDocument(entries().find(item=>item.id===b.dataset.doc)))();}else if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const index=list.findIndex(item=>item.id===b.dataset.doc),next=list[Math.max(0,Math.min(list.length-1,index+(e.key==='ArrowDown'?1:-1)))];selectDocument(next.id);[...$('libraryList').querySelectorAll('[data-doc]')].find(button=>button.dataset.doc===next.id)?.focus();}};
 });
 $('libraryList').querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>{favorites.has(b.dataset.favorite)?favorites.delete(b.dataset.favorite):favorites.add(b.dataset.favorite);saveLocal('jianwei-favorites',[...favorites]);renderLibrary();});
 selectDocument(selectedDocument);renderFolders();
}
$('openSelected').onclick=guard(()=>openDocument(entries().find(e=>e.id===selectedDocument)));
$('readerTab').onclick=showReader;
function updateFolderUI(){$('folderName').textContent=folder?folder.name:t('本地文献库');$('folderDescription').textContent=folder?(folderGranted?'已连接 · 文件保存在本机':'点击刷新以重新授权'):'文件只保存在你的设备上';$('storageHint').textContent=folder?'导入文献将复制到所选文件夹':'支持 PDF、TXT、Markdown';renderFolders();}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.filter;history.replaceState(null,'',location.pathname);renderLibrary();});
for(const [id,view]of [['gridView','grid'],['listView','list']])$(id).onclick=()=>{libraryDisplay=view;saveLocal('folio-display',view);renderLibrary();};
$('sortLibrary').onchange=renderLibrary;
$('homeBrand').onclick=()=>{libraryFilter='all';history.replaceState(null,'',location.pathname);showLibrary();};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();showLibrary();$('librarySearch').focus();}});
async function scanFolder(){if(!folder)return;const found=[];async function walk(dir,prefix=''){for await(const [name,handle]of dir.entries()){if(name.startsWith('.'))continue;if(found.length>=2000)throw new Error('文件夹中超过 2000 篇文献，请选择更小的子文件夹。');const relative=prefix+name;if(handle.kind==='directory')await walk(handle,relative+'/');else if(supports(name))found.push({id:'folder:'+folder.name+':'+relative,name,handle,path:relative,kind:'file'});}}await walk(folder);folderEntries=found.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));folderGranted=true;updateFolderUI();renderLibrary();}
$('chooseFolder').onclick=async()=>{try{if(!window.showDirectoryPicker){$('folderInput').click();return;}const h=await window.showDirectoryPicker({id:'jianwei-library',mode:'readwrite'});folder=h;await dbOp('meta','put',folder,'folder');await scanFolder();toast('已连接本地文献库');}catch(e){if(e.name!=='AbortError')toast(e.message);}};
$('refreshLibrary').onclick=async()=>{try{if(!folder){await refreshCache();return;}if(await folder.requestPermission({mode:'readwrite'})!=='granted'){toast('需要文件夹访问权限才能重新读取文献。');return;}await scanFolder();toast('文献库已刷新');}catch(e){toast(e.message);}};
async function refreshCache(){cachedEntries=(await dbOp('files','getAll')).map(f=>({...f,kind:'file'}));renderLibrary();}
$('importFiles').onclick=()=>$('fileInput').click();
async function importFiles(files,forceCache=false){const valid=[...files].filter(f=>supports(f.name));if(!valid.length){toast('请选择 PDF、TXT 或 Markdown 文件。');return;}let copyToFolder=folder&&!forceCache;if(copyToFolder&&await folder.requestPermission({mode:'readwrite'})!=='granted'){toast('未获得文件夹写入权限，没有导入文件。');return;}let count=0;for(const file of valid){if(file.size>200*1024*1024){toast(file.name+' 超过 200 MB，已跳过。');continue;}if(copyToFolder){let name=file.name,i=1;while(true){try{await folder.getFileHandle(name);const dot=file.name.lastIndexOf('.');name=file.name.slice(0,dot)+` (${i++})`+file.name.slice(dot);}catch(e){if(e.name==='NotFoundError')break;throw e;}}const h=await folder.getFileHandle(name,{create:true});const w=await h.createWritable();try{await w.write(file);await w.close();}catch(e){await w.abort();throw e;}}else{await dbOp('files','put',{id:'local:'+crypto.randomUUID(),name:file.name,blob:file,path:file.webkitRelativePath||'浏览器本地副本'});}count++;}if(copyToFolder)await scanFolder();await refreshCache();toast(`已导入 ${count} 篇文献${copyToFolder?'到本地文件夹':'到浏览器本地库'}`);}
$('fileInput').onchange=guard(async e=>{await importFiles(e.target.files);e.target.value='';});
$('folderInput').onchange=guard(async e=>{await importFiles(e.target.files,true);e.target.value='';toast('此浏览器使用文件夹副本模式，内容已保存到浏览器本地库。');});
$('librarySearch').oninput=renderLibrary;
for(const id of ['libraryButton','readerLibrary'])$(id).onclick=()=>{libraryFilter='all';history.replaceState(null,'',location.pathname);showLibrary();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
function updatePageUI(){$('pageNumber').value=page;$('pageNumber').max=total;$('pageTotal').textContent='/ '+total;$('prevPage').disabled=page<=1;$('nextPage').disabled=page>=total;$('zoomLabel').textContent=Math.round(zoom*100)+'%';$('documentTitle').textContent=current.name.replace(/\.(pdf|txt|md)$/i,'');$('readerTabTitle').textContent=$('documentTitle').textContent;$('documentSubtitle').textContent=current.kind==='demo'?'交互导读 · 内置示例':(current.path||'本地文献');positions[current.id]=page;saveLocal('jianwei-positions',positions);}
let textPages=[],openToken=0,documentIndex=null,documentReady=false;
function getDocumentIndex(){
 if(!documentReady)throw new Error("文献仍在打开，请加载完成后再发送。");
 if(documentIndex?.id===current.id)return documentIndex;
 const token=openToken,doc=pdf,entry={...current},plain=[...textPages],count=total;
 documentIndex=createDocumentIndex({id:entry.id,name:entry.name,total:count,readPage:async number=>{
  if(token!==openToken)throw new DOMException('文献已切换','AbortError');
  if(entry.kind==='demo')return new DOMParser().parseFromString(demoPages[number-1].replace(/<br\s*\/?>(?:\s*)|<\/(?:p|div|h1|h2)>/gi,'\n'),'text/html').body.textContent;
  if(!doc)return plain[number-1]||'';
  const p=await doc.getPage(number),content=await p.getTextContent();
  if(token!==openToken)throw new DOMException('文献已切换','AbortError');
  return content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');
 }});return documentIndex;
}
function showDocumentContext(context){
 const box=$('sourceContext');box.hidden=!context;box.replaceChildren();if(!context)return;
 const pages=[...new Set(context.excerpts.map(e=>e.page))],summary=document.createElement('summary');summary.textContent='参考原文 · '+(pages.length?'第 '+pages.join('、')+' 页':'未提取到文字');box.append(summary);
 const info=document.createElement('p');info.textContent='已在《'+context.name+'》中检索 '+context.scanned+' 页，只将相关段落用于这次解读。'+(context.failedPages.length?'其中 '+context.failedPages.length+' 页读取失败。':'');box.append(info);
 for(const number of pages){const button=document.createElement('button');button.textContent='第 '+number+' 页 ↗';button.onclick=()=>{if(current.id===context.documentId)guard(()=>changePage(number,{keepConversation:true}))();};box.append(button);}
}

async function openDocument(entry){if(!entry)return;endConversation();documentIndex=null;documentReady=false;textPages=[];showReader();recent[entry.id]=Date.now();saveLocal('jianwei-recent',recent);const token=++openToken;renderToken++;selected=null;pageText='';$('documentContent').innerHTML='<div class="loading">正在打开文献…</div>';const previous=pdf;pdf=null;current=entry;page=positions[entry.id]||1;zoom=1;total=1;updatePageUI();try{if(previous)await previous.loadingTask.destroy();if(entry.kind==='demo'){total=2;}else{const file=entry.handle?await entry.handle.getFile():entry.blob;if(/\.pdf$/i.test(entry.name)){pdfLib??=await import('/vendor/build/pdf.mjs');pdfLib.GlobalWorkerOptions.workerSrc='/vendor/build/pdf.worker.mjs';const loaded=await pdfLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'}).promise;if(token!==openToken){await loaded.loadingTask.destroy();return;}pdf=loaded;total=pdf.numPages;}else{const text=await file.text();textPages=text.match(/[\s\S]{1,4200}/g)||['（空文档）'];total=textPages.length;}}if(token!==openToken)return;page=Math.max(1,Math.min(page,total));await renderPage();if(token===openToken)documentReady=true;renderLibrary();}catch(e){if(token!==openToken)return;$('documentContent').innerHTML='<div class="empty-state">无法打开此文献。<br>请检查文件是否仍在原位置、是否加密，或重新授权文件夹。</div>';pageText='';toast(e.message||'文献打开失败');}}
async function renderPage(){const token=++renderToken;selected=null;pageText='';updatePageUI();$('readerViewport').scrollTop=0;const content=$('documentContent');content.innerHTML='';if(current.kind==='demo'){content.innerHTML=`<article class="paper reading-selection" style="font-size:${16*zoom}px">${demoPages[page-1]}</article>`;pageText=content.innerText;content.querySelectorAll('[data-experiment]').forEach(b=>b.onclick=()=>{visualizeSelection({text:b.dataset.experiment==='derived'?'S3 可解群导出列':'置换群',name:current.name,id:current.id,page,builtin:true});});$('readerStatus').textContent='选中文字，点击「引用选段」或拖到右侧';annotations.mount();return;}if(!pdf){const article=document.createElement('article');article.className='paper plain-text';article.style.fontSize=14*zoom+'px';article.textContent=textPages[page-1]||'';content.append(article);pageText=article.textContent;$('readerStatus').textContent='文本按段长度分页 · 支持选段引用';annotations.mount();return;}const doc=pdf;content.innerHTML='<div class="loading">正在渲染这一页…</div>';const p=await doc.getPage(page);if(token!==renderToken)return;const natural=p.getViewport({scale:1});const width=Math.max(260,$('readerViewport').clientWidth-60);const scale=Math.min(width/natural.width,1.5)*zoom;const viewport=p.getViewport({scale});const wrap=document.createElement('div');wrap.className='pdf-page';wrap.style.width=viewport.width+'px';wrap.style.height=viewport.height+'px';wrap.style.setProperty('--scale-factor',scale);wrap.style.setProperty('--total-scale-factor',scale);const canvas=document.createElement('canvas');const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(viewport.width*dpr);canvas.height=Math.floor(viewport.height*dpr);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';const textLayer=document.createElement('div');textLayer.className='textLayer';wrap.append(canvas,textLayer);content.replaceChildren(wrap);await p.render({canvasContext:canvas.getContext('2d'),viewport,transform:dpr===1?null:[dpr,0,0,dpr,0,0]}).promise;if(token!==renderToken)return;const textContent=await p.getTextContent();if(token!==renderToken)return;pageText=textContent.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');await new pdfLib.TextLayer({textContentSource:textContent,container:textLayer,viewport}).render();$('readerStatus').textContent=pageText.trim()?'选中文字，点击「引用选段」或拖到右侧':'此页没有可提取的文字（扫描件）；本版尚未接入 OCR。';annotations.mount();}
async function changePage(p,{keepConversation=false}={}){const next=Math.max(1,Math.min(total,Number(p)||1));if(next!==page&&!keepConversation)endConversation();page=next;await renderPage();}
$('prevPage').onclick=guard(()=>changePage(page-1));$('nextPage').onclick=guard(()=>changePage(page+1));$('pageNumber').onchange=guard(e=>changePage(e.target.value));
for(const [id,delta]of [['zoomIn',.1],['zoomOut',-.1]])$(id).onclick=guard(async()=>{zoom=Math.max(.6,Math.min(2,Math.round((zoom+delta)*10)/10));await renderPage();});
$('bookmarkButton').onclick=()=>{positions[current.id]=page;saveLocal('jianwei-positions',positions);toast('已记住第 '+page+' 页，下次打开会回到这里。');};
document.addEventListener('selectionchange',()=>{const s=getSelection();if(s&&s.toString().trim()&&$('documentContent').contains(s.anchorNode)&&$('documentContent').contains(s.focusNode))selected={text:s.toString().trim().slice(0,16000),name:current.name,id:current.id,page};});
function setQuote(q){quote=q;$('quote').hidden=!q;if(q){$('quoteSource').textContent=sourceLabel(q);$('quoteText').textContent=q.text;$('prompt').focus();}}
$('citeSelection').onmousedown=e=>e.preventDefault();$('citeSelection').onclick=()=>selected?visualizeSelection({...selected}):toast('先在左侧选中一段文字。');$('clearQuote').onclick=()=>endConversation();
$('learning').ondragover=e=>{e.preventDefault();$('learning').classList.add('drag-over');};$('learning').ondragleave=e=>{if(!$('learning').contains(e.relatedTarget))$('learning').classList.remove('drag-over');};$('learning').ondrop=guard(async e=>{e.preventDefault();$('learning').classList.remove('drag-over');if(e.dataTransfer.files.length){await importFiles(e.dataTransfer.files);showLibrary();return;}const text=e.dataTransfer.getData('text/plain').trim();if(text){const same=selected&&selected.text===text;visualizeSelection(same?{...selected}:{text:text.slice(0,16000),name:'拖入的文字',id:null,page:'—'});}});
$('documentContent').ondragstart=e=>{const s=getSelection()?.toString().trim();if(s)e.dataTransfer.setData('text/plain',s);};
function setTab(tab){document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));for(const t of ['chat','lab','notes','visual'])$(t+'Panel').hidden=t!==tab;if(tab==='notes')renderNotes();}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function settingsToForm(){$('baseUrl').value=settings.baseUrl;$('modelName').value=settings.model;$('apiKey').value=settings.apiKey;$('thinkingMode').checked=settings.thinking;}
function readSettingsForm(){return {baseUrl:$('baseUrl').value.trim().replace(/\/$/,''),model:$('modelName').value.trim(),apiKey:$('apiKey').value.trim(),thinking:$('thinkingMode').checked};}
function updateModel(){$('modelStatus').textContent=(settings.model==='deepseek-flash'?'DeepSeek Flash':settings.model)+(hasKey()?(language()==='en'?' · Connected':' · 已配置'):(language()==='en'?' · Not connected':' · 未连接'));}
for(const id of ['settingsButton','modelButton'])$(id).onclick=()=>{settingsToForm();$('settingsDialog').showModal();};
async function saveSettings(){
 const next=readSettingsForm();
 if(window.folioDesktop){
  if(!/^https:\/\/api\.deepseek\.com(?:\/v1)?\/?$/.test(next.baseUrl))throw new Error('桌面版密钥仅用于 DeepSeek 官方地址。');
  desktopKey=await window.folioDesktop.saveKey(next.apiKey,$('rememberKey').checked);next.apiKey='';$('apiKey').value='';
 }
 settings=next;const {apiKey,...persist}=settings;saveLocal('jianwei-settings',persist);updateModel();
}
$('settingsForm').onsubmit=async e=>{e.preventDefault();if(document.querySelector('[data-pref-panel=ai]').hidden)return;try{await saveSettings();$('settingsDialog').close();toast(window.folioDesktop?(desktopKey.persisted?'密钥已在本机加密保存。':'密钥仅在本次应用运行有效。'):serverKey?'设置已保存；密钥仍由本机服务托管。':'密钥仅在当前页面有效。');}catch(error){$('connectionResult').textContent=error.message;}};
async function askAPI(config,messages,signal){
 if(config.responseFormat==='json')config={...config,answerLanguage:readLocal('folio-answer-language','auto')};

 if(window.folioDesktop){
  if(signal?.aborted)throw new DOMException('已停止','AbortError');
  const id=crypto.randomUUID();const cancel=()=>window.folioDesktop.cancelAI(id).catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});
  try{return await window.folioDesktop.requestAI({id,config:{baseUrl:config.baseUrl,model:config.model,thinking:config.thinking,responseFormat:config.responseFormat,answerLanguage:config.answerLanguage},messages});}
  finally{signal?.removeEventListener('abort',cancel);}
 }
 const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...config,messages}),signal});const data=await res.json();if(!res.ok)throw new Error(data.error||'请求失败');return data.content;
}
$('testConnection').onclick=async()=>{const button=$('testConnection');button.disabled=true;$('connectionResult').textContent='正在连接模型…';try{if(window.folioDesktop)await saveSettings();const answer=await askAPI(readSettingsForm(),[{role:'user',content:'只回复“连接成功”。'}]);$('connectionResult').textContent=t('连接成功')+' · '+answer.slice(0,70);}catch(e){$('connectionResult').textContent=e.message;}finally{button.disabled=false;}};
$('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chatForm').requestSubmit();}};
function addNote(text,source){notes.unshift({id:crypto.randomUUID(),text,source,date:new Date().toLocaleString('zh-CN')});saveLocal('jianwei-notes',notes);renderNotes();toast('已存入笔记');}
function renderNotes(){if(typeof notebook!=='undefined')notebook.render();$('globalNoteCount').textContent=notes.length;$('noteCount').textContent=notes.length;$('notesList').innerHTML=notes.length?'':'<div class="empty-state">还没有笔记。<br>把一次回答或实验保存下来，慢慢形成自己的理解。</div>';for(const note of notes){const card=document.createElement('article');card.className='note-card';const meta=document.createElement('div');meta.className='note-meta';meta.textContent=note.date+(note.question?' · '+note.question:'');const p=document.createElement('p');p.textContent=note.text;card.append(meta,p);if(note.source?.id){const source=document.createElement('button');source.className='note-source';source.textContent='↗ '+sourceLabel(note.source);source.onclick=guard(async()=>{const e=entries().find(x=>x.id===note.source.id);if(!e){toast('请先重新连接这篇文献所在的文件夹。');return;}await openDocument(e);await changePage(note.source.page);if(note.source.annotationId)await annotations.revealId(note.source.annotationId);});card.append(source);}const actions=document.createElement('div');actions.className='note-actions';const edit=document.createElement('button');edit.textContent='编辑';edit.onclick=()=>{if(p.contentEditable==='true'){note.text=p.textContent;saveLocal('jianwei-notes',notes);p.contentEditable='false';edit.textContent='编辑';}else{p.contentEditable='true';p.focus();edit.textContent='保存';}};const del=document.createElement('button');del.textContent='删除';del.onclick=()=>{notes.splice(notes.findIndex(n=>n.id===note.id),1);saveLocal('jianwei-notes',notes);renderNotes();};actions.append(edit,del);card.append(actions);$('notesList').append(card);}}
$('exportNotes').onclick=()=>{if(!notes.length){toast('还没有可以导出的笔记。');return;}const text='# Folio · 学习笔记\n\n'+notes.map(n=>'## '+n.date+'\n\n'+n.text+'\n\n'+(n.source?'来源：'+sourceLabel(n.source)+'\n':'')).join('\n---\n\n');const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Folio-学习笔记.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let perm=identity(3),word='e',steps=0;const sigma=[1,2,0],tau=[1,0,2];
function drawPerm(){const colors=['#95a5ff','#cf9fea','#6bbdd4'],xs=[65,170,275];$('permutationFigure').innerHTML=`<svg class="perm-svg" viewBox="0 0 340 185" role="img" aria-label="${esc(perm.map((x,i)=>`${i+1} 映到 ${x+1}`).join('，'))}"><defs>${colors.map((c,i)=>`<marker id="arrow${i}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="${c}"/></marker>`).join('')}</defs>${perm.map((x,i)=>`<path class="arrow" d="M${xs[i]} 48 C${xs[i]} 85 ${xs[x]} 98 ${xs[x]} 132" stroke="${colors[i]}" stroke-width="2" fill="none" marker-end="url(#arrow${i})" opacity=".7"/>`).join('')}${xs.map((x,i)=>`<circle cx="${x}" cy="30" r="19" fill="${colors[i]}"/><text x="${x}" y="36" text-anchor="middle" fill="white" font-size="18">${i+1}</text><circle cx="${x}" cy="155" r="19" fill="#252c40" stroke="#435074"/><text x="${x}" y="161" text-anchor="middle" fill="#bccaf1" font-size="18">${i+1}</text>`).join('')}</svg>`;$('permutationResult').textContent=word+' = '+cycles(perm)+(steps?'　· '+steps+' 次作用':'');}
function applyPerm(p,label){perm=compose(p,perm);word=word==='e'?label:label+word;steps++;if(word.length>18)word='当前置换';drawPerm();}
$('applySigma').onclick=()=>applyPerm(sigma,'σ');$('applyTau').onclick=()=>applyPerm(tau,'τ');$('resetPermutation').onclick=()=>{perm=identity(3);word='e';steps=0;drawPerm();};
for(const [id,a,b,label]of [['compareST',sigma,tau,'στ'],['compareTS',tau,sigma,'τσ']])$(id).onclick=()=>{perm=compose(a,b);word=label;steps=2;drawPerm();$('compareResult').textContent=label+' = '+cycles(perm)+'。'+perm.map((x,i)=>`${i+1} ↦ ${x+1}`).join('，')+'。比较另一种顺序，观察 1 的去向。';};
let n=3,layers=[permutations(3)],layerIndex=0,finished=false;
function groupLabel(group){if(group.length===1)return '{e}';if(group.length===({3:6,4:24,5:120}[n]))return 'S'+({3:'₃',4:'₄',5:'₅'}[n]);if(group.length===({3:3,4:12,5:60}[n]))return 'A'+({3:'₃',4:'₄',5:'₅'}[n]);if(n===4&&group.length===4)return 'V₄';return '|G|='+group.length;}
function renderDerived(){const group=layers[layerIndex];$('derivedChain').innerHTML=layers.map((g,i)=>`${i?'<span class="chain-arrow">→</span>':''}<button class="chain-node ${i===layerIndex?'active':''}" data-layer="${i}">${groupLabel(g)}<small>${g.length} 个元素</small></button>`).join('');$('derivedChain').querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{layerIndex=Number(b.dataset.layer);renderDerived();});$('groupElements').innerHTML=group.map(p=>'<span>'+cycles(p)+'</span>').join('');for(const id of ['elementA','elementB'])$(id).innerHTML=group.map((p,i)=>`<option value="${i}">${id==='elementA'?'a':'b'} = ${cycles(p)}</option>`).join('');$('elementA').value=Math.min(1,group.length-1);$('elementB').value=Math.min(2,group.length-1);showCommutator();$('deriveNext').disabled=finished;$('derivedExplanation').textContent=finished?(layers.at(-1).length===1?'导出列到达平凡群，因此这个群可解。':'导出子群与上一层相同，且不是平凡群。继续取导出子群不会再改变，所以这个群不可解。'):'下一步：计算末层中所有 a、b 的交换子，再求它们生成的子群。点击链上的节点可回看任意一层。';}
function showCommutator(){const g=layers[layerIndex],a=g[Number($('elementA').value)],b=g[Number($('elementB').value)];$('commutatorResult').textContent='[a, b] = '+cycles(commutator(a,b));}
$('elementA').onchange=showCommutator;$('elementB').onchange=showCommutator;
$('deriveNext').onclick=()=>{const prev=layers.at(-1),result=derived(prev);layers.push(result.group);layerIndex=layers.length-1;finished=result.group.length===1||result.group.length===prev.length;renderDerived();};
function resetDerived(){n=Number($('groupSelect').value);layers=[permutations(n)];layerIndex=0;finished=false;renderDerived();}
$('groupSelect').onchange=resetDerived;$('resetDerived').onclick=resetDerived;
function setLab(lab){activeLab=lab;$('permutationLab').hidden=lab!=='permutation';$('derivedLab').hidden=lab!=='derived';document.querySelectorAll('[data-lab]').forEach(b=>b.classList.toggle('active',b.dataset.lab===lab));}
document.querySelectorAll('[data-lab]').forEach(b=>b.onclick=()=>visualizeSelection({text:b.dataset.lab==='derived'?'S3 可解群导出列':'置换群',name:'内置示例',id:'demo',page:b.dataset.lab==='derived'?2:1,builtin:true}));
$('saveExperiment').onclick=()=>addNote(activeLab==='permutation'?'置换实验（右侧先作用）\n'+word+' = '+cycles(perm)+'\n'+perm.map((x,i)=>`${i+1} ↦ ${x+1}`).join('，'):'导出列实验\n'+layers.map(g=>groupLabel(g)+'（'+g.length+' 个元素）').join(' → ')+'\n'+$('derivedExplanation').textContent,{id:'demo',name:'置换群与可解群',page:activeLab==='permutation'?1:2});
let resize=false;$('divider').onpointerdown=e=>{resize=true;$('divider').setPointerCapture(e.pointerId);document.body.classList.add('resize-active');};$('divider').onpointermove=e=>{if(resize)document.documentElement.style.setProperty('--left',Math.max(30,Math.min(65,(innerWidth-e.clientX)/innerWidth*100))+'%');};$('divider').onpointerup=guard(async()=>{resize=false;document.body.classList.remove('resize-active');if(pdf)await renderPage();});$('divider').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const cur=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--left'));document.documentElement.style.setProperty('--left',Math.max(30,Math.min(65,cur+(e.key==='ArrowLeft'?2:-2)))+'%');}};
const notebook=setupNotebook({notes,entries,renderMath,memoryEnabled:()=>rememberConversations,onMemoryChange:enabled=>{rememberConversations=enabled;saveLocal('folio-remember-conversations',enabled);updateMemoryUI();},onChanged:()=>{saveLocal('jianwei-notes',notes);renderNotes();},onOpenSource:guard(async note=>{const entry=entries().find(e=>e.id===note.source?.id);if(!entry){toast('原文未连接，笔记和对话仍保留。请在文献库重新连接原文件夹。');return;}await openDocument(entry);if(note.source.page)await changePage(note.source.page);if(note.source.annotationId)await annotations.revealId(note.source.annotationId);})});
function updateMemoryUI(){$('memoryShortcut').textContent=t('自动整理：'+(rememberConversations?'开启':'关闭'));}
function endConversation(){
 requestController?.abort();requestController=null;conversations.reset();setBusy(false);clearScene();setQuote(null);$('conversationContext').hidden=true;$('conversationTopic').textContent='';$('prompt').value='';selected=null;getSelection()?.removeAllRanges();
 document.querySelectorAll('.reading-answer').forEach(e=>e.remove());$('messages').replaceChildren();
 perm=identity(3);word='e';steps=0;drawPerm();$('compareResult').textContent='点击任意顺序，看它将 1、2、3 分别送到哪里。';$('groupSelect').value='3';resetDerived();setLab('permutation');resetVisual();setTab('visual');
}
function routeNotes(){if(!location.hash.startsWith('#/notes'))return;libraryFilter='notes';showLibrary();const value=location.hash.slice('#/notes'.length).replace(/^\//,'');let id=null;try{id=value?decodeURIComponent(value):null;}catch{}notebook.select(id);}
$('globalNotesButton').onclick=()=>{if(location.hash==='#/notes')routeNotes();else location.hash='/notes';};
$('memoryShortcut').onclick=()=>{$('globalNotesButton').click();};
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#/notes'))routeNotes();else if(libraryFilter==='notes'){libraryFilter='all';showLibrary();}});
window.addEventListener('pagehide',()=>conversations.archive());
updateMemoryUI();
async function init(){enhanceSelects();hydrateIcons();if(!window.folioDesktop){try{serverKey=(await (await fetch('/api/status')).json()).configured===true;if(serverKey){$('apiKey').placeholder='本机服务已托管密钥，无需填写';$('keyPrivacy').textContent='密钥由本机服务在内存中托管，不返回页面、不写入浏览器存储，仅用于 DeepSeek 官方地址。原始密钥文件仍保留在你的设备上。';}}catch{}}updateModel();drawPerm();renderDerived();renderNotes();try{await refreshCache();folder=await dbOp('meta','get','folder');if(folder&&await folder.queryPermission({mode:'readwrite'})==='granted')await scanFolder();updateFolderUI();}catch{toast('本地库暂时不可用，请检查浏览器存储权限。');}renderLibrary();}
init().then(()=>{resetVisual();setTab('visual');routeNotes();});

let disposeScene=null;
function clearScene(){disposeScene?.();disposeScene=null;}
function showScene(data,source){clearScene();setTab('visual');disposeScene=mountScene($('visualStage'),{...data,source:sourceLabel(source),onSave:text=>addNote(text,source)});}
function resetVisual(){
 clearScene();$('analysisSummary').hidden=true;showDocumentContext(null);
 $('visualStage').innerHTML='<div class="canvas-empty"><svg class="canvas-sketch" viewBox="0 0 220 140" aria-hidden="true"><path class="connection" d="M110 40V70H45V96M110 70H175V96"/><rect class="node" x="75" y="10" width="70" height="32" rx="7"/><text x="110" y="31" text-anchor="middle">原文</text><rect class="node" x="10" y="96" width="70" height="32" rx="7"/><text x="45" y="117" text-anchor="middle">概念</text><rect class="node" x="140" y="96" width="70" height="32" rx="7"/><text x="175" y="117" text-anchor="middle">关系</text></svg><h2>拖入一段原文</h2><p>选中左侧文字，拖到这里。<br>把定义、关系与步骤展开来看。</p><div class="canvas-examples"><button data-example="置换群">置换群</button><button data-example="S3 可解群导出列">可解群</button><button data-example="正四面体 3D 旋转">3D 旋转</button></div></div>';
 $('visualStage').querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>visualizeSelection({text:b.dataset.example,name:'内置示例',id:'demo',page:/可解/.test(b.dataset.example)?2:1,builtin:true}));
}
async function renderConceptGraph(data,source,signal){
 const cleanup=await mountConcept($('visualStage'),data,source,text=>addNote(text,source),renderMath,signal);
 if(signal?.aborted)cleanup?.();else disposeScene=cleanup;
}
let requestTimer=null;
function setPhase(text){$('requestPhase').textContent=t(text);}
function setBusy(busy){
 $('learning').classList.toggle('is-thinking',busy);$('learning').setAttribute('aria-busy',String(busy));$('toggleAI').classList.toggle('is-thinking',busy);$('sendButton').hidden=busy;$('stopButton').hidden=!busy;$('requestStatus').hidden=!busy;
 clearInterval(requestTimer);requestTimer=null;
 if(busy){const started=Date.now();setPhase('正在理解选段与运算约定');$('requestTime').textContent='0s';requestTimer=setInterval(()=>{$('requestTime').textContent=Math.floor((Date.now()-started)/1000)+'s';},1000);}
}
function setCanvasFocus(active){document.body.classList.toggle('canvas-focus',active);$('focusCanvas').setAttribute('aria-pressed',String(active));$('focusCanvas').setAttribute('aria-label',active?'返回分栏阅读':'展开画布');$('focusCanvas').title=active?'返回分栏阅读':'展开画布';}
$('focusCanvas').onclick=()=>{const active=!document.body.classList.contains('canvas-focus');if(active)setAICollapsed(false);setCanvasFocus(active);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('canvas-focus'))setCanvasFocus(false);});
function describePlan(plan){const box=$('analysisSummary');box.hidden=false;box.replaceChildren();const badge=document.createElement('span');badge.textContent=['permutation','derived','tetrahedron'].includes(plan.kind)?'本地计算':plan.kind==='clarify'?'待补充':plan.kind==='unsupported'?'暂不支持':'AI 解读';const text=document.createElement('span');text.textContent=plan.object;text.title=plan.reason;box.append(badge,text);}
function renderPlan(plan,source){
 describePlan(plan);
 if(plan.kind==='permutation'){setTab('visual');mountPermutation($('visualStage'),plan,text=>addNote(text,source));}
 else if(plan.kind==='derived'){setTab('lab');setLab('derived');$('groupSelect').value=String(plan.n);$('groupSelect').dispatchEvent(new Event('change',{bubbles:true}));resetDerived();}
 else if(plan.kind==='tetrahedron')showScene({operation:plan.operation,explanation:plan.reason,generated:!source.builtin},source);
 else if(['clarify','unsupported'].includes(plan.kind)){$('visualStage').innerHTML='<div class="visual-error"><h2>'+esc(plan.kind==='clarify'?'需要补充一点信息':'这个实验还未支持')+'</h2><p>'+esc(plan.reason)+'</p><p>可以在下方补充说明，原文引用仍然保留。</p></div>';}
}
async function visualizeSelection(source,forceQuestion=false,{followup=false,question=source.text}={}){
 if(!followup||!conversations.current||conversations.current.source.id!==source.id){endConversation();conversations.begin(source,question);}
 const sessionToken=conversations.current.id;$('conversationContext').hidden=false;$('conversationTopic').textContent='当前问题：'+conversations.current.question;$('conversationTopic').title=conversations.current.question;
 requestController?.abort();requestController=null;setBusy(false);setAICollapsed(false);
 clearScene();document.querySelectorAll('.reading-answer').forEach(e=>e.remove());showDocumentContext(null);setQuote(source.text?source:null);setTab('visual');$('visualPanel').scrollTop=0;$('analysisSummary').hidden=true;
 if(source.builtin&&!forceQuestion){
  const plan=source.text==='置换群'?{kind:'permutation',n:3,sigma:[1,2,0],tau:[1,0,2],order:'right-first',object:'S₃ · σ=(1 2 3)，τ=(1 2)',reason:'内置示例'}:source.text.includes('可解')?{kind:'derived',n:3,object:'S₃ 导出列',reason:'内置示例'}:{kind:'tetrahedron',operation:'vertex',object:'正四面体旋转群 A₄',reason:'绕顶点轴旋转120°，其他三个顶点循环置换。'};
  renderPlan(plan,source);conversations.complete(sessionToken,question,{title:plan.object,paragraphs:[{text:plan.reason==='内置示例'?plan.object+'。可操作实验在本机计算。':plan.reason,sources:[]}]},plan);conversations.setArtifact(sessionToken,plan);return;
 }
 if(!hasKey()&&!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(settings.baseUrl)){$('visualStage').innerHTML='<div class="visual-error"><h2>连接模型后分析这段原文</h2><p>你的选段已保留。内置示例可离线使用。</p><button id="connectForGraph">连接模型</button></div>';$('connectForGraph').onclick=()=>$('settingsButton').click();return;}
 const controller=new AbortController();requestController=controller;setBusy(true);$('visualStage').innerHTML='<div class="visual-loading" role="status"><span>正在理解这段内容</span><small>识别对象、参数与运算约定</small></div>';
 try{
  let context=null;
  if($('includePage').checked&&(!source.id||source.id===current.id)){
   setPhase('正在查阅原文');
   context=await getDocumentIndex().retrieve((source.text||'')+'\n'+question,Number(source.page)||page,{signal:controller.signal,onProgress:(done,count)=>setPhase('正在查阅原文 · '+done+' / '+count+' 页')});
   context.anchorPage=Number(source.page)||page;
  }
  if(controller.signal.aborted)return;showDocumentContext(context);setPhase('正在结合原文解释选段');
  const ask=messages=>askAPI({...settings,responseFormat:'json'},messages,controller.signal);
  const response=await requestStructured(ask,requestReading(source.text,context,{question,history:conversations.history(),answerLanguage:readLocal('folio-answer-language','auto')}),raw=>parseReading(raw,context?.excerpts||[]),{signal:controller.signal,onRepair:()=>setPhase('正在整理回答格式')});if(controller.signal.aborted||!conversations.isCurrent(sessionToken))return;let plan=response.plan;
  try{plan=verifyPlanAgainstSource(plan,source.text+'\n'+response.parameterEvidence.map(e=>e.quote).join('\n'));}catch{plan={kind:'explain',object:response.answer.title,reason:'已展示原文解读，参数存在不同定义，暂不混合计算。'};}
  if(plan.kind==='permutation'&&/平方|立方|σ[²³]|σ\s*\^\s*[2-9]/.test(question))plan={kind:'concept',object:response.answer.title,reason:'解释幂运算及其循环结构。'};
  conversations.complete(sessionToken,question,response.answer,plan);conversations.setArtifact(sessionToken,plan);
  describePlan(plan);
  $('visualStage').replaceChildren();
  if(['permutation','derived','tetrahedron'].includes(plan.kind))renderPlan(plan,source);
  const answerHost=plan.kind==='derived'?$('labPanel').querySelector('.lab-scroll'):$('visualStage');
  const explanation=mountReadingAnswer(answerHost,response.answer,{onSave:text=>addNote(text,source),onPage:number=>{if(context&&current.id===context.documentId)guard(()=>changePage(number,{keepConversation:true}))();}});renderMath(explanation);
  if(plan.kind==='concept'){
   setPhase('解读已完成，正在整理关系图');
   try{
    const data=await requestStructured(ask,requestGraph(source.text+'\n用户问题：'+question,context?.text||'',plan.object),raw=>parseGraph(raw,source.text+'\n'+(context?.text||'')),{signal:controller.signal,onRepair:()=>setPhase('正在整理关系图格式')});
    if(!controller.signal.aborted&&conversations.isCurrent(sessionToken)){conversations.setArtifact(sessionToken,data);await renderConceptGraph(data,source,controller.signal);}
   }catch(error){if(controller.signal.aborted)return;const note=document.createElement('p');note.className='muted';note.textContent='这次关系图未能完成，原文解读已保留。';$('visualStage').append(note);}
  }

 }catch(e){if(controller.signal.aborted)return;$('visualStage').innerHTML='<div class="visual-error"><h2>暂时无法可靠生成</h2><p>'+esc(e instanceof SyntaxError?'模型返回的格式仍不完整，请重新生成。':e.message)+'</p><button id="retryGraph">重新分析选段</button></div>';$('retryGraph').onclick=()=>visualizeSelection(source,true,{followup:true,question});}
 finally{if(requestController===controller){requestController=null;setBusy(false);}}
}
$('chatForm').onsubmit=e=>{e.preventDefault();if(requestController)return;const text=$('prompt').value.trim();if(!text)return;$('prompt').value='';const source=quote?{...quote,builtin:false}:conversations.current?{...conversations.current.source,builtin:false}:{text:'',name:current.name,id:current.id,page};visualizeSelection(source,true,{followup:Boolean(conversations.current),question:text});};
$('stopButton').onclick=()=>{requestController?.abort();requestController=null;setBusy(false);if($('visualStage').querySelector('.reading-answer')){$('visualStage').querySelector('.concept-artifact')?.remove();const note=document.createElement('p');note.className='muted';note.textContent='已停止生成关系图，原文解读已保留。';$('visualStage').append(note);}else $('visualStage').innerHTML='<div class="visual-error">已停止生成。选段仍保留，可以重新发送。</div>';};
$('newChat').onclick=$('startQuestion').onclick=()=>{endConversation();$('prompt').focus();};

// Capture an already-selected passage so dragging is consistent across HTML and PDF text layers.
let passageDrag=null;
$('documentContent').addEventListener('pointerdown',e=>{
 const selection=getSelection();if(e.button!==0||!selection?.rangeCount||!selection.toString().trim())return;
 const range=selection.getRangeAt(0);if(!$('documentContent').contains(range.commonAncestorContainer))return;
 if(![...range.getClientRects()].some(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom))return;
 e.preventDefault();passageDrag={x:e.clientX,y:e.clientY,moved:false,source:{text:selection.toString().trim().slice(0,16000),name:current.name,id:current.id,page}};
 $('documentContent').setPointerCapture(e.pointerId);
});
$('documentContent').addEventListener('pointermove',e=>{
 if(!passageDrag)return;if(Math.hypot(e.clientX-passageDrag.x,e.clientY-passageDrag.y)>8)passageDrag.moved=true;
 if(passageDrag.moved){$('learning').classList.add('drag-over');document.body.style.cursor='grabbing';}
});
$('documentContent').addEventListener('pointerup',e=>{
 if(!passageDrag)return;const drag=passageDrag;passageDrag=null;$('learning').classList.remove('drag-over');document.body.style.cursor='';
 const r=$('learning').getBoundingClientRect();if(drag.moved&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){getSelection()?.removeAllRanges();visualizeSelection(drag.source);}else if(!drag.moved)getSelection()?.removeAllRanges();
});
$('documentContent').addEventListener('pointercancel',()=>{passageDrag=null;$('learning').classList.remove('drag-over');document.body.style.cursor='';});
// Desktop messages expose UI commands only; no Node or filesystem access in the page.
if(window.folioDesktop){
 document.body.classList.add('desktop-app');
 window.folioDesktop.onWindowState(state=>{
  document.body.classList.toggle('window-maximized',state.maximized||state.fullscreen);
 });
 window.folioDesktop.onCommand(command=>{
  window.dispatchEvent(new CustomEvent('folio-command',{detail:command}));
 });
}

if(window.folioDesktop){
 $('desktopKeyOptions').hidden=false;
 $('apiKey').placeholder='输入新密钥；留空保留已配置密钥';
 $('keyPrivacy').textContent='密钥交给桌面主进程使用，保存后立即清空输入框。默认只在本次运行有效；勾选本机保存后使用 Windows 加密。只向 DeepSeek 官方地址发送。提问时发送选段；启用“自动参考原文”时发送当前文献的相关段落。自动整理的笔记只保存在本机。';
 window.folioDesktop.keyStatus().then(status=>{desktopKey=status;$('rememberKey').checked=status.persisted;updateModel();});
 $('importKey').onclick=async()=>{try{desktopKey=await window.folioDesktop.importKey($('rememberKey').checked);$('apiKey').value='';updateModel();$('connectionResult').textContent=desktopKey.configured?'密钥已导入，可点击测试连接。':'未导入密钥。';}catch(e){$('connectionResult').textContent=e.message;}};
 $('forgetKey').onclick=async()=>{desktopKey=await window.folioDesktop.forgetKey();$('apiKey').value='';$('rememberKey').checked=false;updateModel();$('connectionResult').textContent='已清除密钥。';};
}
$('settingsDialog').addEventListener('close',()=>{$('apiKey').value='';});

let pdfResizeTimer,lastReaderWidth=0;
new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width===lastReaderWidth)return;lastReaderWidth=width;clearTimeout(pdfResizeTimer);if(pdf&&!$('readingWorkspace').hidden)pdfResizeTimer=setTimeout(()=>{if(pdf&&!$('readingWorkspace').hidden)guard(renderPage)();},180);}).observe($('readerViewport'));
$('divider').addEventListener('pointercancel',()=>{resize=false;document.body.classList.remove('resize-active');});

function setAICollapsed(collapsed){if(collapsed)setCanvasFocus(false);document.body.classList.toggle('ai-collapsed',collapsed);$('toggleAI').setAttribute('aria-expanded',String(!collapsed));$('toggleAI').setAttribute('aria-label',collapsed?'展开 AI 辅助':'收起 AI 辅助');$('toggleAI').title=collapsed?'展开 AI 辅助':'收起 AI 辅助';saveLocal('folio-ai-collapsed',collapsed);}
$('toggleAI').onclick=()=>setAICollapsed(!document.body.classList.contains('ai-collapsed'));
setAICollapsed(readLocal('folio-ai-collapsed',false));
const annotations=setupAnnotations({getDocument:()=>current,getPage:()=>page,goPage:changePage,read:readLocal,save:saveLocal,addNote,visualize:visualizeSelection,toast});

setupShell({selection:()=>selected?.text,fit:()=>{zoom=1;guard(renderPage)();},closeDocument,hasDocument:()=>!$('readerTabGroup').hidden});
window.addEventListener('folio-language',()=>{updateModel();updateMemoryUI();updateFolderUI();renderLibrary();});

function closeDocument(){
 if($('readerTabGroup').hidden)return;
 // Invalidate loading/rendering work before releasing this document.
 openToken++;renderToken++;documentReady=false;documentIndex=null;
 const previous=pdf;pdf=null;textPages=[];pageText='';
 showLibrary();$('readerTabGroup').hidden=true;$('documentContent').replaceChildren();
 previous?.loadingTask.destroy().catch(()=>{});
 $('libraryButton').focus();
}
