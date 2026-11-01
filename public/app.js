import {enhancePDFSelection} from './pdf-selection.js';
import {layoutText,plainLayout,blockContext,REFLOW_VERSION} from './reflow-layout.js';
import {selectionReview,dropFeedback,cropSource} from './reflow-view.js';
import {snapshotFile,readDocumentFile,fileReadMessage} from './document-file.js';
import {openStudyNote} from './study-note-dialog.js';
import {learningRequest} from './learning-actions.js';
import {renderNoteMarkdown,mountNoteEditor,exportNotesMarkdown} from './note-renderer.js';
import {noteTitle,noteBody} from './note-markdown.js';
import {setupModelSettings} from './model-settings.js';
import {normalizeEndpoint} from './model-providers.js';
import {createArtifactWorkspace} from './artifact-workspace.js';
import {mountDisplay} from './display-view.js';
import {mountGeometry} from './geometry-view.js';
import {mountDerived} from './derived-view.js';
import {setupWorkspaceManager} from './workspace-manager.js';
import {ui,node,button,modal} from './workspace-ui.js';
import {compareVersions,validateRelease} from './release-info.js';
import {setupReaderNavigation} from './reader-navigation.js';
import {openWorkspace,DATA_KEYS} from './workspace-store.js';
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
import {contextBelongsToSource} from './selection-source.js';
import {validatePermutationSnapshot} from './permutation-state.js';
import {setupAnnotations} from './annotations.js';
import {requestUnderstanding,parseUnderstanding} from './understanding.js';
import {mountPermutation} from './permutation-view.js';
import {enhanceSelects} from './select-menu.js';
import {mountScene} from './scene-view.js';
import {parseGraph,requestGraph} from './graph-schema.js';
import {icon,hydrateIcons} from './icons.js';
import {cycles,permutations,derived,commutator} from './groups.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readLocal=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
function saveLocal(k,v){try{localStorage.setItem(k,JSON.stringify(v));if(DATA_KEYS.includes(k))workspace.put('state',{id:k,value:v}).catch(()=>toast('本地工作区写入失败，请导出备份。'));}catch{toast('浏览器存储空间不足，本次更改尚未保存。');}}
let toastTimer;function toast(message){$('toast').textContent=t(message);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function guard(fn){return (...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>{if(e.name!=='AbortError')toast(e.message||'操作失败，请重试。');});}
const workspace=openWorkspace();
try{await workspace.migrate(localStorage);}catch(error){const {body}=modal(ui('工作区迁移未完成','Workspace migration could not finish'));body.append(node('p',error.message),node('p',ui('原始记录已保留。关闭其他 Folio 窗口后重试；不要清除浏览器数据。','Original records are preserved. Close other Folio windows and retry; do not clear browser data.')),button(ui('重试','Retry'),()=>location.reload()));throw error;}
const dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('jianwei-library',1);r.onupgradeneeded=()=>{r.result.createObjectStore('meta');r.result.createObjectStore('files',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function dbOp(store,method,...args){const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction(store,method==='get'||method==='getAll'?'readonly':'readwrite');const req=tx.objectStore(store)[method](...args);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
let folder=null,folderGranted=false,folderEntries=[],cachedEntries=[];
let current={id:'',name:'',kind:'file'},page=1,total=1,zoom=1,pdf=null,pdfLib=null,renderToken=0,pageText='',selected=null,quote=null,pageReady=false;
const positions=readLocal('jianwei-positions',{}),notes=readLocal('jianwei-notes',[]);
let requestController=null;
let rememberConversations=readLocal('folio-remember-conversations',false)===true;
const conversations=createConversations({enabled:()=>rememberConversations,save:note=>{const index=notes.findIndex(n=>n.id===note.id);if(index>=0)notes[index]=note;else notes.unshift(note);saveLocal('jianwei-notes',notes);renderNotes();}});
let desktopKey={configured:false,persisted:false},serverKey=false;
const hasKey=()=>Boolean(settings.apiKey||desktopKey.configured||(serverKey&&normalizeEndpoint(settings.baseUrl)==='https://api.deepseek.com'));
let settings={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',thinking:false,...readLocal('jianwei-settings',{}),apiKey:''};
let mathRenderer=null;
import('/katex/contrib/auto-render.mjs').then(m=>{mathRenderer=m.default;document.querySelectorAll('.reading-answer,.notebook-prose,#notebookDetail details').forEach(renderMath);}).catch(()=>{});
function renderMath(el){if(mathRenderer)mathRenderer(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false,trust:false,strict:'ignore'});}
function entries(){return [...new Map([...folderEntries,...cachedEntries].map(entry=>[entry.id,entry])).values()];}
function supports(name){return /\.(pdf|txt|md)$/i.test(name);}

let libraryFilter='all',libraryDisplay=readLocal('folio-display','list'),selectedDocument=null;
const favorites=new Set(readLocal('jianwei-favorites',[])),recent=readLocal('jianwei-recent',{});
function showLibrary(){navigation.stop();endConversation();setCanvasFocus(false);document.body.dataset.view='library';$('libraryHome').hidden=false;$('readingWorkspace').hidden=true;$('viewTitle').textContent='Library';$('libraryButton').classList.add('active');$('readerTab').classList.remove('active');renderLibrary();}
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
  const type=e.name.split('.').pop().toUpperCase(),title=e.name.replace(/\.(pdf|txt|md)$/i,''),location=e.handle?(e.path.split('/').slice(0,-1).join('/')||folder?.name||'本地文件夹'):t('本地副本');
  return '<article class="document-card" data-document-row="'+esc(e.id)+'"><button class="document-open" data-doc="'+esc(e.id)+'" aria-label="'+(language()==='en'?'Select ':'选择 ')+esc(title)+'" title="'+(language()==='en'?'Double-click to read ':'双击阅读 ')+esc(title)+'"><span class="document-name">'+icon('file')+'<span>'+esc(title)+'</span></span><span class="document-type">'+esc(type)+'</span><span class="document-location" title="'+esc(location)+'">'+esc(location)+'</span><span class="document-recent">'+formatReadTime(recent[e.id])+'</span></button><button class="favorite-button '+(favorites.has(e.id)?'saved':'')+'" data-favorite="'+esc(e.id)+'" aria-label="'+(language()==='en'?(favorites.has(e.id)?'Unfavorite ':'Favorite '):(favorites.has(e.id)?'取消收藏 ':'收藏 '))+esc(title)+'">'+icon('star')+'</button></article>';
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
function updateFolderUI(){$('folderName').textContent=folder?folder.name:t('本地文献库');$('folderDescription').textContent=folder?(folderGranted?'已连接 · 文件保存在本机':'点击刷新以重新授权'):'文件只保存在你的设备上';$('storageHint').textContent=folder?'导入文献将复制到所选文件夹':'';renderFolders();}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.filter;history.replaceState(null,'',location.pathname);renderLibrary();});
for(const [id,view]of [['gridView','grid'],['listView','list']])$(id).onclick=()=>{libraryDisplay=view;saveLocal('folio-display',view);renderLibrary();};
$('sortLibrary').onchange=renderLibrary;
$('homeBrand').onclick=()=>{libraryFilter='all';history.replaceState(null,'',location.pathname);showLibrary();};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();showLibrary();$('librarySearch').focus();}});
async function scanFolder(){if(!folder)return;const found=[];async function walk(dir,prefix=''){for await(const [name,handle]of dir.entries()){if(name.startsWith('.'))continue;if(found.length>=2000)throw new Error('文件夹中超过 2000 篇文献，请选择更小的子文件夹。');const relative=prefix+name;if(handle.kind==='directory')await walk(handle,relative+'/');else if(supports(name))found.push({id:'folder:'+folder.name+':'+relative,name,handle,path:relative,kind:'file'});}}await walk(folder);folderEntries=found.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));folderGranted=true;updateFolderUI();renderLibrary();}
$('chooseFolder').onclick=async()=>{try{if(!window.showDirectoryPicker){$('folderInput').click();return;}const h=await window.showDirectoryPicker({id:'jianwei-library',mode:'read'});folder=h;await dbOp('meta','put',folder,'folder');await scanFolder();toast('已连接本地文献库');}catch(e){if(e.name!=='AbortError')toast(e.message);}};
$('refreshLibrary').onclick=async()=>{try{if(!folder){await refreshCache();return;}if(await folder.requestPermission({mode:'read'})!=='granted'){toast('需要文件夹访问权限才能重新读取文献。');return;}await scanFolder();toast('文献库已刷新');}catch(e){toast(e.message);}};
async function refreshCache(){cachedEntries=(await dbOp('files','getAll')).map(f=>({...f,kind:'file'}));renderLibrary();}
$('importFiles').onclick=()=>$('fileInput').click();
async function importFiles(files,forceCache=false){const valid=[...files].filter(f=>supports(f.name));if(!valid.length){toast('请选择 PDF、TXT 或 Markdown 文件。');return;}let copyToFolder=folder&&!forceCache;if(copyToFolder&&await folder.requestPermission({mode:'readwrite'})!=='granted'){toast('未获得文件夹写入权限，没有导入文件。');return;}let count=0;for(const file of valid){if(file.size>200*1024*1024){toast(file.name+' 超过 200 MB，已跳过。');continue;}if(copyToFolder){let name=file.name,i=1;while(true){try{await folder.getFileHandle(name);const dot=file.name.lastIndexOf('.');name=file.name.slice(0,dot)+` (${i++})`+file.name.slice(dot);}catch(e){if(e.name==='NotFoundError')break;throw e;}}const h=await folder.getFileHandle(name,{create:true});const w=await h.createWritable();try{await w.write(file);await w.close();}catch(e){await w.abort();throw e;}}else{await dbOp('files','put',{id:'local:'+crypto.randomUUID(),name:file.name,blob:await snapshotFile(file),path:file.webkitRelativePath||'浏览器本地副本'});}count++;}if(copyToFolder)await scanFolder();await refreshCache();toast(`已导入 ${count} 篇文献${copyToFolder?'到本地文件夹':'到浏览器本地库'}`);}
$('fileInput').onchange=guard(async e=>{await importFiles(e.target.files);e.target.value='';});
$('folderInput').onchange=guard(async e=>{await importFiles(e.target.files,true);e.target.value='';toast('此浏览器使用文件夹副本模式，内容已保存到浏览器本地库。');});
$('librarySearch').oninput=renderLibrary;
for(const id of ['libraryButton','readerLibrary'])$(id).onclick=()=>{libraryFilter='all';history.replaceState(null,'',location.pathname);showLibrary();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
function updatePageUI(){$('pageNumber').value=page;$('pageNumber').max=total;$('pageTotal').textContent='/ '+total;$('prevPage').disabled=page<=1;$('nextPage').disabled=page>=total;$('zoomLabel').textContent=Math.round(zoom*100)+'%';$('documentTitle').textContent=current.name.replace(/\.(pdf|txt|md)$/i,'');$('readerTabTitle').textContent=$('documentTitle').textContent;$('documentSubtitle').textContent=current.path||'本地文献';positions[current.id]=page;saveLocal('jianwei-positions',positions);}
let textPages=[],openToken=0,documentIndex=null,documentReady=false;
function getDocumentIndex(){
 if(!documentReady)throw new Error("文献仍在打开，请加载完成后再发送。");
 if(documentIndex?.id===current.id)return documentIndex;
 const token=openToken,doc=pdf,entry={...current},plain=[...textPages],count=total;
 documentIndex=createDocumentIndex({id:entry.id,name:entry.name,total:count,loadPages:async()=>(await workspace.all('pages')).filter(p=>p.documentId===(entry.documentId||entry.id)&&p.revision===entry.revision&&(p.ocr||p.indexVersion===REFLOW_VERSION)),savePage:async p=>workspace.put('pages',{...await workspace.get('pages',entry.id+':'+entry.revision+':'+p.page),...p,indexVersion:REFLOW_VERSION,id:entry.id+':'+entry.revision+':'+p.page,documentId:entry.documentId||entry.id,revision:entry.revision}),readPage:async number=>{
  if(token!==openToken)throw new DOMException('文献已切换','AbortError');
  if(!doc)return plain[number-1]||'';
  const p=await doc.getPage(number),content=await p.getTextContent();
  if(token!==openToken)throw new DOMException('文献已切换','AbortError');
  return layoutText(content.items,p.getViewport({scale:1}),number).text;
 }});return documentIndex;
}
const navigation=setupReaderNavigation({getState:()=>({entry:{...current},page,pdf,ready:documentReady&&pageReady,index:getDocumentIndex}),goPage:p=>changePage(p,{keepConversation:true}),store:workspace,addNote,visualize:visualizeSelection,onContextChanged:()=>{documentIndex=null;guard(()=>renderPage())();}});
function showDocumentContext(context){
 const box=$('sourceContext');box.hidden=!context;box.replaceChildren();if(!context)return;
 const pages=[...new Set(context.excerpts.map(e=>e.page))],summary=document.createElement('summary');summary.textContent='参考原文 · '+(pages.length?'第 '+pages.join('、')+' 页':'未提取到文字');box.append(summary);
 const info=document.createElement('p');info.textContent='已在《'+context.name+'》中检索 '+context.scanned+' 页，只将相关段落用于这次解读。'+(context.failedPages.length?'其中 '+context.failedPages.length+' 页读取失败。':'');box.append(info);
 for(const number of pages){const button=document.createElement('button');button.textContent='第 '+number+' 页 ↗';button.onclick=()=>{if(current.id===context.documentId)guard(()=>changePage(number,{keepConversation:true}))();};box.append(button);}
}

async function openDocument(entry){if(!entry)return;navigation.stop();pageReady=false;$('selectRegion').disabled=true;endConversation();documentIndex=null;documentReady=false;textPages=[];showReader();recent[entry.id]=Date.now();saveLocal('jianwei-recent',recent);const token=++openToken;renderToken++;selected=null;pageText='';$('documentContent').innerHTML='<div class="loading">正在打开文献…</div>';const previous=pdf;pdf=null;current=entry;page=positions[entry.id]||1;zoom=1;total=1;updatePageUI();try{const file=await readDocumentFile(entry);if(previous)await previous.loadingTask.destroy();if(token!==openToken)return;{const identity=await workspace.identify(entry,file);if(token!==openToken)return;current={...entry,revision:identity.revision,documentId:identity.id};if(/\.pdf$/i.test(entry.name)){pdfLib??=await import('/vendor/build/pdf.mjs');pdfLib.GlobalWorkerOptions.workerSrc='/vendor/build/pdf.worker.mjs';const loaded=await pdfLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'}).promise;if(token!==openToken){await loaded.loadingTask.destroy();return;}pdf=loaded;total=pdf.numPages;}else{const text=await file.text();textPages=text.match(/[\s\S]{1,4200}/g)||['（空文档）'];total=textPages.length;}}if(token!==openToken)return;page=Math.max(1,Math.min(page,total));await renderPage();if(token===openToken)documentReady=true;renderLibrary();}catch(e){if(token!==openToken)return;if(previous)await previous.loadingTask.destroy().catch(()=>{});const box=node('div',undefined,{className:'empty-state'});box.append(node('p',fileReadMessage(e,language()==='en')),button(ui('重试','Retry'),()=>openDocument(entry)));const picker=document.createElement('input');picker.type='file';picker.accept='.pdf,.txt,.md';picker.hidden=true;box.append(button(ui('重新选择文件','Locate file'),()=>picker.click()),picker);picker.onchange=guard(async()=>{const chosen=picker.files[0];if(!chosen)return;const copy=await snapshotFile(chosen);if(token!==openToken)return;const replacement={id:entry.id,name:chosen.name,path:entry.path||'',blob:copy,kind:'file'};await dbOp('files','put',replacement);folderEntries=folderEntries.filter(item=>item.id!==entry.id);await refreshCache();if(token===openToken)await openDocument(replacement);});$('documentContent').replaceChildren(box);pageText='';}}
let activeLayout=null;
async function renderPage(){navigation.stop();activeLayout=null;document.querySelector('.selection-dock')?.remove();pageReady=false;$('selectRegion').disabled=true;const token=++renderToken;selected=null;pageText='';updatePageUI();$('readerViewport').scrollTop=0;const content=$('documentContent');content.innerHTML='';if(!pdf){const article=document.createElement('article');article.className='paper plain-text';article.style.fontSize=14*zoom+'px';article.textContent=textPages[page-1]||'';content.append(article);pageText=article.textContent;activeLayout=plainLayout(pageText,page);$('readerStatus').textContent='';pageReady=true;$('selectRegion').disabled=false;annotations.mount();return;}const doc=pdf;content.innerHTML='<div class="loading">正在渲染这一页…</div>';const p=await doc.getPage(page);if(token!==renderToken)return;const natural=p.getViewport({scale:1});const width=Math.max(260,$('readerViewport').clientWidth-60);const scale=Math.min(width/natural.width,1.5)*zoom;const viewport=p.getViewport({scale});const wrap=document.createElement('div');wrap.className='pdf-page';wrap.style.width=viewport.width+'px';wrap.style.height=viewport.height+'px';wrap.style.setProperty('--scale-factor',scale);wrap.style.setProperty('--total-scale-factor',scale);const canvas=document.createElement('canvas');const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(viewport.width*dpr);canvas.height=Math.floor(viewport.height*dpr);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';const textLayer=document.createElement('div');textLayer.className='textLayer';wrap.append(canvas,textLayer);content.replaceChildren(wrap);await p.render({canvasContext:canvas.getContext('2d'),viewport,transform:dpr===1?null:[dpr,0,0,dpr,0,0]}).promise;if(token!==renderToken)return;const textContent=await p.getTextContent();if(token!==renderToken)return;pageText=textContent.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');const nativeText=new pdfLib.TextLayer({textContentSource:textContent,container:textLayer,viewport});await nativeText.render();if(token!==renderToken)return;activeLayout=layoutText(textContent.items,natural,page);pageText=activeLayout.text;enhancePDFSelection({layer:textLayer,textDivs:nativeText.textDivs,items:textContent.items,layout:activeLayout,viewport:natural,wrap,onSelect:blocks=>{const ids=blocks.map(b=>b.id);acceptBlockSelection({...readingSource(),text:blocks.map(b=>b.text).join('\n\n'),blockIds:ids,rect:blocks[0]?.rect,selectionMethod:'blocks',blockContext:blockContext(activeLayout,ids),...(blocks.length===1&&['formula','table'].includes(blocks[0].kind)?{image:cropSource(canvas,blocks[0].rect)}:{})});}});$('readerStatus').textContent=pageText.trim()?'':'此页没有可提取的文字（扫描件）；可从工具菜单运行本页 OCR。';pageReady=true;$('selectRegion').disabled=false;annotations.mount();}
async function changePage(p,{keepConversation=false}={}){const next=Math.max(1,Math.min(total,Number(p)||1));if(next!==page&&!keepConversation)endConversation();page=next;await renderPage();}
$('prevPage').onclick=guard(()=>changePage(page-1));$('nextPage').onclick=guard(()=>changePage(page+1));$('pageNumber').onchange=guard(e=>changePage(e.target.value));
for(const [id,delta]of [['zoomIn',.1],['zoomOut',-.1]])$(id).onclick=guard(async()=>{zoom=Math.max(.6,Math.min(2,Math.round((zoom+delta)*10)/10));await renderPage();});
$('bookmarkButton').onclick=()=>{positions[current.id]=page;saveLocal('jianwei-positions',positions);toast('已记住第 '+page+' 页，下次打开会回到这里。');};
document.addEventListener('selectionchange',()=>{const s=getSelection();if(s?.rangeCount&&!s.isCollapsed&&s.toString().trim()&&$('documentContent').contains(s.anchorNode)&&$('documentContent').contains(s.focusNode)){selected={text:s.toString().trim().slice(0,16000),...readingSource()};if(activeLayout){const range=s.getRangeAt(0),blocks=[...$('documentContent').querySelectorAll('.semantic-block[data-block]')].filter(el=>range.intersectsNode(el)).map(el=>el.dataset.block);selected={...selected,selectionMethod:'blocks',blockIds:blocks,blockContext:blockContext(activeLayout,blocks),rect:activeLayout.blocks.find(b=>b.id===blocks[0])?.rect};}showSelectionDock();}else{clearSelectionDock();}});
function setQuote(q){quote=q;$('quote').hidden=!q;if(q){$('quoteSource').textContent=sourceLabel(q);$('quoteText').textContent=q.text;$('prompt').focus();}}
$('citeSelection').onmousedown=e=>e.preventDefault();$('selectRegion').onclick=guard(()=>navigation.region());
$('citeSelection').onclick=()=>selected?reviewSelection({...selected}):toast('先在左侧选中一段文字。');$('clearQuote').onclick=()=>endConversation();
$('learning').ondragover=e=>{e.preventDefault();$('learning').classList.add('drag-over');};$('learning').ondragleave=e=>{if(!$('learning').contains(e.relatedTarget))$('learning').classList.remove('drag-over');};$('learning').ondrop=guard(async e=>{e.preventDefault();$('learning').classList.remove('drag-over');if(e.dataTransfer.files.length){await importFiles(e.dataTransfer.files);dropFeedback($('learning'),e);showLibrary();return;}const text=e.dataTransfer.getData('text/plain').trim();if(text){const same=readerDrag&&e.dataTransfer.getData('application/x-folio-selection')===readerDrag.token&&readerDrag.source.text===text&&readerDrag.source.id===current.id;setAICollapsed(false);dropFeedback($('learning'),e);visualizeSelection(same?{...readerDrag.source}:{text:text.slice(0,16000),name:'拖入的文字',id:null,page:'—',external:true});readerDrag=null;}});
let readerDrag=null;
$('documentContent').ondragstart=e=>{const s=getSelection()?.toString().trim().slice(0,16000);if(s){readerDrag={token:crypto.randomUUID(),source:{...(selected?.text===s?selected:readingSource()),text:s}};e.dataTransfer.setData('text/plain',s);e.dataTransfer.setData('application/x-folio-selection',readerDrag.token);}};
$('documentContent').ondragend=()=>{readerDrag=null;};
function setTab(tab){document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));for(const t of ['chat','lab','notes','visual'])$(t+'Panel').hidden=t!==tab;if(tab==='notes')renderNotes();}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function updateModel(){$('modelStatus').textContent=(settings.model==='deepseek-flash'?'DeepSeek Flash':settings.model)+(hasKey()?(language()==='en'?' · Configured':' · 已配置'):(language()==='en'?' · Not connected':' · 未连接'));}
const modelSettings=setupModelSettings({getSettings:()=>settings,onSaved:next=>{settings=next;const {apiKey,...persist}=next;saveLocal('jianwei-settings',persist);updateModel();},onStatus:status=>{desktopKey=status;updateModel();}});
for(const id of ['settingsButton','modelButton'])$(id).onclick=()=>{modelSettings.open();$('settingsDialog').showModal();};
const keyReady=modelSettings.ready().catch(()=>{});
async function askAPI(config,messages,signal){
 if(config.responseFormat==='json')config={...config,answerLanguage:readLocal('folio-answer-language','auto')};

 if(window.folioDesktop){
  await keyReady;
  if(signal?.aborted)throw new DOMException('已停止','AbortError');
  const id=crypto.randomUUID();const cancel=()=>window.folioDesktop.cancelAI(id).catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});
  try{return await window.folioDesktop.requestAI({id,config:{baseUrl:config.baseUrl,model:config.model,thinking:config.thinking,responseFormat:config.responseFormat,answerLanguage:config.answerLanguage},messages});}
  finally{signal?.removeEventListener('abort',cancel);}
 }
 const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...config,messages}),signal});const data=await res.json();if(!res.ok)throw new Error(data.error||'请求失败');return data.content;
}
$('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chatForm').requestSubmit();}};
function addNote(text,source,artifact){notes.unshift({id:crypto.randomUUID(),text,source,format:'markdown',...(artifact?{artifact:structuredClone(artifact)}:{}),date:new Date().toLocaleString('zh-CN')});saveLocal('jianwei-notes',notes);renderNotes();toast('已存入笔记');}
function renderNotes(){
 if(typeof notebook!=='undefined')notebook.render();$('globalNoteCount').textContent=notes.length;$('noteCount').textContent=notes.length;const list=$('notesList');list.replaceChildren();
 if(!notes.length)list.append(node('p',ui('还没有笔记。','No notes yet.'),{className:'empty-state'}));
 for(const note of notes){const card=node('article',undefined,{className:'note-card'}),title=node('h3',noteTitle(note)),content=node('div',undefined,{className:'notebook-prose'});renderNoteMarkdown(content,noteBody(note),renderMath);card.append(title,content);if(note.source?.id)card.append(button(sourceLabel(note.source),()=>openSource(note.source)));const actions=node('div',undefined,{className:'note-actions'});actions.append(button(ui('编辑','Edit'),()=>{card.replaceChildren();mountNoteEditor(card,note,{renderMath,onCancel:renderNotes,onSave:changes=>{Object.assign(note,changes);saveLocal('jianwei-notes',notes);renderNotes();}});}),button(ui('导出 Markdown','Export Markdown'),()=>exportNotesMarkdown([note],id=>workspace.get('regions',id))),button(ui('删除','Delete'),()=>{notes.splice(notes.findIndex(n=>n.id===note.id),1);saveLocal('jianwei-notes',notes);renderNotes();}));card.append(actions);list.append(card);}
}
$('exportNotes').onclick=guard(()=>exportNotesMarkdown(notes,id=>workspace.get('regions',id),{bundle:true}));
let n=3,layers=[permutations(3)],layerIndex=0,finished=false;
function groupLabel(group){if(group.length===1)return '{e}';if(group.length===({3:6,4:24,5:120}[n]))return 'S'+({3:'₃',4:'₄',5:'₅'}[n]);if(group.length===({3:3,4:12,5:60}[n]))return 'A'+({3:'₃',4:'₄',5:'₅'}[n]);if(n===4&&group.length===4)return 'V₄';return '|G|='+group.length;}
function renderDerived(){const group=layers[layerIndex];$('derivedChain').innerHTML=layers.map((g,i)=>`${i?'<span class="chain-arrow">→</span>':''}<button class="chain-node ${i===layerIndex?'active':''}" data-layer="${i}">${groupLabel(g)}<small>${g.length} 个元素</small></button>`).join('');$('derivedChain').querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{layerIndex=Number(b.dataset.layer);renderDerived();});$('groupElements').innerHTML=group.map(p=>'<span>'+cycles(p)+'</span>').join('');for(const id of ['elementA','elementB'])$(id).innerHTML=group.map((p,i)=>`<option value="${i}">${id==='elementA'?'a':'b'} = ${cycles(p)}</option>`).join('');$('elementA').value=Math.min(1,group.length-1);$('elementB').value=Math.min(2,group.length-1);showCommutator();$('deriveNext').disabled=finished;$('derivedExplanation').textContent=finished?(layers.at(-1).length===1?'导出列到达平凡群，因此这个群可解。':'导出子群与上一层相同，且不是平凡群。继续取导出子群不会再改变，所以这个群不可解。'):'下一步：计算末层中所有 a、b 的交换子，再求它们生成的子群。点击链上的节点可回看任意一层。';}
function showCommutator(){const g=layers[layerIndex],a=g[Number($('elementA').value)],b=g[Number($('elementB').value)];$('commutatorResult').textContent='[a, b] = '+cycles(commutator(a,b));}
$('elementA').onchange=showCommutator;$('elementB').onchange=showCommutator;
$('deriveNext').onclick=()=>{const prev=layers.at(-1),result=derived(prev);layers.push(result.group);layerIndex=layers.length-1;finished=result.group.length===1||result.group.length===prev.length;renderDerived();};
function resetDerived(){n=Number($('groupSelect').value);layers=[permutations(n)];layerIndex=0;finished=false;renderDerived();}
$('groupSelect').onchange=resetDerived;$('resetDerived').onclick=resetDerived;
$('saveExperiment').onclick=()=>addNote('导出列实验\n'+layers.map(g=>groupLabel(g)+'（'+g.length+' 个元素）').join(' → ')+'\n'+$('derivedExplanation').textContent,conversations.current?.source||{id:current.id,name:current.name,page});
let resize=false;$('divider').onpointerdown=e=>{resize=true;$('divider').setPointerCapture(e.pointerId);document.body.classList.add('resize-active');};$('divider').onpointermove=e=>{if(resize)document.documentElement.style.setProperty('--left',Math.max(30,Math.min(65,(innerWidth-e.clientX)/innerWidth*100))+'%');};$('divider').onpointerup=guard(async()=>{resize=false;document.body.classList.remove('resize-active');if(pdf)await renderPage();});$('divider').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const cur=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--left'));document.documentElement.style.setProperty('--left',Math.max(30,Math.min(65,cur+(e.key==='ArrowLeft'?2:-2)))+'%');}};
const notebook=setupNotebook({notes,entries,renderMath,getRegion:id=>workspace.get('regions',id),onRestoreArtifact:restoreArtifact,memoryEnabled:()=>rememberConversations,onMemoryChange:enabled=>{rememberConversations=enabled;saveLocal('folio-remember-conversations',enabled);updateMemoryUI();},onChanged:()=>{saveLocal('jianwei-notes',notes);renderNotes();},onOpenSource:guard(async note=>{await openSource(note.source);if(note.source.annotationId&&current.revision===note.source.revision)await annotations.revealId(note.source.annotationId);})});
const artifacts=createArtifactWorkspace({store:workspace,host:$('visualStage'),onSave:record=>openStudyNote(record,{ask:hasKey()?((messages,signal)=>askAPI({...settings,responseFormat:'json'},messages,signal)):null,answerLanguage:readLocal('folio-answer-language','auto'),renderMath,onSave:(draft,snapshot)=>addNote(draft.title+'\n\n'+draft.text,snapshot.source,{kind:'folio-artifact',record:snapshot})}),onSource:openSource,onOpen:activateArtifact,onRequestView:kind=>{const source=artifacts.current?.source;if(source)return visualizeSelection(source,true,{followup:true,question:learningRequest(kind)});},render:async(host,version,source,onState)=>{
 setAICollapsed(false);setTab('visual');const answer=mountReadingAnswer(host,version.answer,{onPage:number=>openSource({...source,page:number})});renderMath(answer);const stage=document.createElement('div');stage.className='artifact-renderer';host.append(stage);const p=version.plan,options={saved:version.interaction,onState,renderMath};
 if(p.kind==='permutation')return mountPermutation(stage,p,(text,snapshot)=>{onState(snapshot);addNote(text,source,{kind:'folio-artifact',record:artifacts.current});},version.interaction?.kind==='permutation-state'?version.interaction:undefined,onState);
 if(p.kind==='derived')return mountDerived(stage,p,options);
 if(p.kind==='geometry')return mountGeometry(stage,p,options);
 if(p.kind==='tetrahedron')return mountGeometry(stage,{...p,shape:'tetrahedron',axis:p.operation==='vertex'?[1,1,1]:[1,0,0],angle:p.operation==='vertex'?120:180},options);
 if(['comparison','derivation','process'].includes(p.kind))return mountDisplay(stage,p,options);
 if(p.kind==='concept'&&version.visual)return mountConcept(stage,version.visual,source,text=>addNote(text,source,{kind:'folio-artifact',record:artifacts.current}),renderMath,null,options);
 return ()=>{};
}});
async function activateArtifact(record){endConversation();const entry=entries().find(e=>e.id===record.source?.id);if(entry&&(current.id!==entry.id||!documentReady)){await openDocument(entry);if(!record.source.revision||record.source.revision===current.revision)await changePage(record.source.page||1,{keepConversation:true});}else if(!entry&&!documentReady){$('documentContent').replaceChildren(node('p',ui('原文未连接，作品仍可使用。点击「回到原文」重新定位。','Source not connected. The artifact remains available; use Source to relink.')));}const v=record.versions[record.cursor];conversations.begin(record.source,v.answer.title);conversations.complete(conversations.current.id,v.answer.title,v.answer,v.plan);setAICollapsed(false);showReader();setQuote(record.source);await artifacts.show(record);}
async function openSource(source){if(!source?.id){toast('这段内容没有关联本地文献。');return;}let entry=entries().find(e=>e.id===source.id);if(!entry&&source.documentId){const doc=await workspace.get('documents',source.documentId);entry=entries().find(e=>doc?.aliases.includes(e.id));}if(!entry)entry=await manager.relink(source);if(!entry)return;const preserved=artifacts.current;if(current.id!==entry.id||!documentReady){await openDocument(entry);if(preserved)await activateArtifact(preserved);}else showReader();if(source.revision&&source.revision!==current.revision){toast('原文内容已变化，旧引用仍保留，未跳转到可能错误的位置。');return;}await changePage(source.page||1,{keepConversation:true});if(source.rect){const page=document.querySelector('.pdf-page');if(page){const marker=document.createElement('div');marker.className='source-region';Object.assign(marker.style,{left:source.rect[0]*100+'%',top:source.rect[1]*100+'%',width:source.rect[2]*100+'%',height:source.rect[3]*100+'%'});page.append(marker);}}}
function updateMemoryUI(){$('memoryShortcut').textContent=t('自动整理：'+(rememberConversations?'开启':'关闭'));}
function endConversation(){
 artifacts.clear();
 requestController?.abort();requestController=null;conversations.reset();setBusy(false);clearScene();setQuote(null);$('conversationContext').hidden=true;$('conversationTopic').textContent='';$('prompt').value='';selected=null;getSelection()?.removeAllRanges();
 document.querySelectorAll('.reading-answer').forEach(e=>e.remove());$('messages').replaceChildren();
 document.querySelector('[data-tab=lab]').hidden=true;resetVisual();setTab('visual');
}
function routeNotes(){if(!location.hash.startsWith('#/notes'))return;libraryFilter='notes';showLibrary();const value=location.hash.slice('#/notes'.length).replace(/^\//,'');let id=null;try{id=value?decodeURIComponent(value):null;}catch{}notebook.select(id);}
async function restoreArtifact(note){try{
 if(note.artifact?.kind==='folio-artifact'){await activateArtifact(note.artifact.record);return;}

 const artifact=validatePermutationSnapshot(note.artifact),entry=entries().find(e=>e.id===note.source?.id);
 if(!entry){toast('请先重新连接原文，再恢复交互实验。');return;}
 await openDocument(entry);if(note.source.page)await changePage(note.source.page);
 if(!documentReady)return;
 setAICollapsed(false);setQuote(note.source);clearScene();setTab('visual');
 disposeScene=mountPermutation($('visualStage'),artifact.plan,(text,snapshot)=>addNote(text,note.source,snapshot),artifact);

}catch(error){toast(error.message);}}
$('globalNotesButton').onclick=()=>{if(location.hash==='#/notes')routeNotes();else location.hash='/notes';};
$('memoryShortcut').onclick=()=>{$('globalNotesButton').click();};
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#/notes'))routeNotes();else if(libraryFilter==='notes'){libraryFilter='all';showLibrary();}});
window.addEventListener('pagehide',()=>conversations.archive());
updateMemoryUI();
async function init(){enhanceSelects();hydrateIcons();if(!window.folioDesktop){try{serverKey=(await (await fetch('/api/status')).json()).configured===true;modelSettings.setServerKey(serverKey);}catch{}}updateModel();renderNotes();try{await refreshCache();folder=await dbOp('meta','get','folder');if(folder&&await folder.queryPermission({mode:'read'})==='granted')await scanFolder();updateFolderUI();}catch{toast('本地库暂时不可用，请检查浏览器存储权限。');}renderLibrary();}
init().then(()=>{resetVisual();setTab('visual');routeNotes();});

const manager=setupWorkspaceManager({store:workspace,dbOp,entries,refresh:refreshCache,notes,saveNotes:()=>{saveLocal('jianwei-notes',notes);renderNotes();},openDocument});
const zoteroButton=button('Zotero',()=>manager.importedLibrary());zoteroButton.className='connect-folder';document.querySelector('.library-sidebar').insertBefore(zoteroButton,document.querySelector('.sidebar-bottom'));
async function checkUpdates(){const {body}=modal(ui('软件更新','Software updates'));const info=await (await fetch('/api/version')).json();body.append(node('p',ui('当前版本：','Current version: ')+info.version));const release=validateRelease(await (await fetch('/api/release')).json());body.append(node('p',compareVersions(release.version,info.version)>0?ui('发现新版本：','New version: ')+release.version:ui('当前已是最新可用版本。','You have the latest available version.')));const id=info.platform==='win32'?'win-x64':info.platform==='darwin'?'mac-'+info.arch:'linux-'+info.arch;const files=release.downloads.filter(d=>!window.folioDesktop||d.id===id);for(const file of files)body.append(button(file.platform+' · '+file.format,async()=>{if(window.folioDesktop)await window.folioDesktop.openDownload(file.url);else window.open(file.url,'_blank','noopener');}));body.append(node('p',ui('下载后关闭 Folio 并运行安装程序。个人文献与笔记保留。','Close Folio before running the downloaded installer. Your documents and notes are retained.')));}
window.addEventListener('folio-feature',e=>{const action={artifacts:()=>artifacts.browse(),backup:manager.exportBackup,restore:manager.importBackup,rollback:manager.rollback,zotero:manager.zotero,updates:checkUpdates}[e.detail];if(action)guard(action)();});
let disposeScene=null;
function clearScene(){disposeScene?.();disposeScene=null;}
function showScene(data,source){clearScene();setTab('visual');disposeScene=mountScene($('visualStage'),{...data,source:sourceLabel(source),onSave:text=>addNote(text,source)});}
function resetVisual(){
 clearScene();showDocumentContext(null);
 $('visualStage').innerHTML='<div class="canvas-empty"><svg class="canvas-sketch" viewBox="0 0 220 140" aria-hidden="true"><path class="connection" d="M110 40V70H45V96M110 70H175V96"/><rect class="node" x="75" y="10" width="70" height="32" rx="7"/><text x="110" y="31" text-anchor="middle">原文</text><rect class="node" x="10" y="96" width="70" height="32" rx="7"/><text x="45" y="117" text-anchor="middle">概念</text><rect class="node" x="140" y="96" width="70" height="32" rx="7"/><text x="175" y="117" text-anchor="middle">关系</text></svg><h2>拖入一段原文</h2><p>选中左侧文字，拖到这里。</p></div>';
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
function renderPlan(plan,source){

 if(plan.kind==='permutation'){setTab('visual');disposeScene=mountPermutation($('visualStage'),plan,(text,artifact)=>addNote(text,source,artifact));}
 else if(plan.kind==='derived'){document.querySelector('[data-tab=lab]').hidden=false;setTab('lab');$('groupSelect').value=String(plan.n);$('groupSelect').dispatchEvent(new Event('change',{bubbles:true}));resetDerived();}
 else if(plan.kind==='tetrahedron')showScene({operation:plan.operation,explanation:plan.reason,generated:!source.builtin},source);
 else if(['clarify','unsupported'].includes(plan.kind)){$('visualStage').innerHTML='<div class="visual-error"><h2>'+esc(plan.kind==='clarify'?'需要补充一点信息':'这个实验还未支持')+'</h2><p>'+esc(plan.reason)+'</p><p>可以在下方补充说明，原文引用仍然保留。</p></div>';}
}
async function visualizeSelection(source,forceQuestion=false,{followup=false,question=source.text}={}){
 await keyReady;
 if(!followup||!conversations.current||conversations.current.source.id!==source.id){endConversation();conversations.begin(source,question);}
 const baseArtifact=followup?artifacts.current:null;artifacts.suspend();
 const sessionToken=conversations.current.id;$('conversationContext').hidden=false;$('conversationTopic').textContent='当前问题：'+conversations.current.question;$('conversationTopic').title=conversations.current.question;
 requestController?.abort();requestController=null;setBusy(false);setAICollapsed(false);
 clearScene();document.querySelectorAll('.reading-answer').forEach(e=>e.remove());showDocumentContext(null);setQuote(source.text?source:null);setTab('visual');$('visualPanel').scrollTop=0;
 if(!hasKey()&&!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(settings.baseUrl)){$('visualStage').innerHTML='<div class="visual-error"><h2>连接模型后分析这段原文</h2><p>你的选段已保留，请在设置中连接模型服务。</p><button id="connectForGraph">连接模型</button></div>';$('connectForGraph').onclick=()=>$('settingsButton').click();return;}
 const controller=new AbortController();requestController=controller;setBusy(true);$('visualStage').innerHTML='<div class="visual-loading" role="status"><span>正在理解这段内容</span></div>';
 try{
  let context=null;
  if(($('includePage').checked||source.selectionMethod==='blocks')&&contextBelongsToSource(source,current)){
   setPhase('正在查阅原文');
   context=await getDocumentIndex().retrieve((source.text||'')+'\n'+question,Number(source.page)||page,{signal:controller.signal,onProgress:(done,count)=>setPhase('正在查阅原文 · '+done+' / '+count+' 页')});
   context.anchorPage=Number(source.page)||page;context.selectionAnchor=source.blockContext;if(source.blockContext?.text){context.excerpts.unshift({page:source.blockContext.page,text:source.blockContext.text});context.text='[选段所在章节与相邻段落]\n'+source.blockContext.heading+'\n'+source.blockContext.text+'\n'+context.text;}
  }
  if(controller.signal.aborted)return;showDocumentContext(context);setPhase('正在结合原文解释选段');
  const ask=messages=>askAPI({...settings,responseFormat:'json'},messages,controller.signal);
  const response=await requestStructured(ask,requestReading(source.text,context,{question,history:conversations.history(),artifact:baseArtifact?baseArtifact.versions[baseArtifact.cursor]:null,answerLanguage:readLocal('folio-answer-language','auto')}),(raw,{attempt})=>parseReading(raw,context?.excerpts||[],{strictPlan:attempt===0,question}),{signal:controller.signal,onRepair:()=>setPhase('正在整理回答格式')});if(controller.signal.aborted||!conversations.isCurrent(sessionToken))return;let plan=response.plan;
  try{plan=verifyPlanAgainstSource(plan,source.text+'\n'+response.parameterEvidence.map(e=>e.quote).join('\n'));}catch{plan={kind:'explain',object:response.answer.title,reason:'已展示原文解读，参数存在不同定义，暂不混合计算。'};}
  conversations.complete(sessionToken,question,response.answer,plan);conversations.setArtifact(sessionToken,plan);

  await artifacts.accept(source,plan,response.answer,null,baseArtifact);
  conversations.setArtifact(sessionToken,{kind:'folio-artifact',record:artifacts.current});
  if(plan.kind==='concept'){
   setPhase('解读已完成，正在整理关系图');
   try{
    const data=await requestStructured(ask,requestGraph(source.text+'\n用户问题：'+question,context?.text||'',plan.object),raw=>parseGraph(raw,source.text+'\n'+(context?.text||'')),{signal:controller.signal,onRepair:()=>setPhase('正在整理关系图格式')});
    if(!controller.signal.aborted&&conversations.isCurrent(sessionToken)){await artifacts.setVisual(data);conversations.setArtifact(sessionToken,{kind:'folio-artifact',record:artifacts.current});}
   }catch(error){if(controller.signal.aborted)return;const note=document.createElement('p');note.className='muted';note.textContent='这次关系图未能完成，原文解读已保留。';$('visualStage').append(note);}
  }

 }catch(e){if(controller.signal.aborted)return;$('visualStage').innerHTML='<div class="visual-error"><h2>暂时无法可靠生成</h2><p>'+esc(e instanceof SyntaxError?'模型返回的格式仍不完整，请重新生成。':e.message)+'</p><button id="retryGraph">重新分析选段</button></div>';$('retryGraph').onclick=()=>visualizeSelection(source,true,{followup:true,question});}
 finally{if(requestController===controller){requestController=null;setBusy(false);}}
}
$('chatForm').onsubmit=e=>{e.preventDefault();if(requestController)return;const text=$('prompt').value.trim();if(!text)return;$('prompt').value='';const source=quote?{...quote,builtin:false}:conversations.current?{...conversations.current.source,builtin:false}:{text:'',name:current.name,id:current.id,documentId:current.documentId,revision:current.revision,page};visualizeSelection(source,true,{followup:Boolean(conversations.current),question:text});};
$('stopButton').onclick=()=>{requestController?.abort();requestController=null;setBusy(false);if($('visualStage').querySelector('.reading-answer')){$('visualStage').querySelector('.concept-artifact')?.remove();const note=document.createElement('p');note.className='muted';note.textContent='已停止生成关系图，原文解读已保留。';$('visualStage').append(note);}else $('visualStage').innerHTML='<div class="visual-error">已停止生成。选段仍保留，可以重新发送。</div>';};
$('newChat').onclick=$('startQuestion').onclick=()=>{endConversation();$('prompt').focus();};

// Capture an already-selected passage so dragging is consistent across HTML and PDF text layers.
let passageDrag=null;
$('documentContent').addEventListener('pointerdown',e=>{
 const selection=getSelection();if(e.button!==0||!selection?.rangeCount||!selection.toString().trim())return;
 const range=selection.getRangeAt(0);if(!$('documentContent').contains(range.commonAncestorContainer))return;
 if(![...range.getClientRects()].some(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom))return;
 e.preventDefault();passageDrag={x:e.clientX,y:e.clientY,moved:false,source:{text:selection.toString().trim().slice(0,16000),name:current.name,id:current.id,documentId:current.documentId,revision:current.revision,page}};
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
 document.body.classList.add('desktop-'+window.folioDesktop.platform);
 window.folioDesktop.onWindowState(state=>{
  document.body.classList.toggle('window-maximized',state.maximized||state.fullscreen);
 });
 window.folioDesktop.onCommand(command=>{
  window.dispatchEvent(new CustomEvent('folio-command',{detail:command}));
 });
}

let pdfResizeTimer,lastReaderWidth=0;
new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width===lastReaderWidth)return;lastReaderWidth=width;clearTimeout(pdfResizeTimer);if(pdf&&!$('readingWorkspace').hidden)pdfResizeTimer=setTimeout(()=>{if(pdf&&!$('readingWorkspace').hidden)guard(renderPage)();},180);}).observe($('readerViewport'));
$('divider').addEventListener('pointercancel',()=>{resize=false;document.body.classList.remove('resize-active');});

function setAICollapsed(collapsed){if(collapsed)setCanvasFocus(false);document.body.classList.toggle('ai-collapsed',collapsed);$('toggleAI').setAttribute('aria-expanded',String(!collapsed));$('toggleAI').setAttribute('aria-label',collapsed?'展开 AI 辅助':'收起 AI 辅助');$('toggleAI').title=collapsed?'展开 AI 辅助':'收起 AI 辅助';saveLocal('folio-ai-collapsed',collapsed);}
$('toggleAI').onclick=()=>setAICollapsed(!document.body.classList.contains('ai-collapsed'));
setAICollapsed(readLocal('folio-ai-collapsed',false));
const annotations=setupAnnotations({getDocument:()=>current,getPage:()=>page,getMode:()=> 'original',goPage:changePage,read:readLocal,save:saveLocal,addNote,visualize:visualizeSelection,toast});

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

window.addEventListener('folio-feature',e=>{const action={navigation:()=>navigation.open(),ocr:()=>navigation.recognize()}[e.detail];if(action)guard(action)();});

function readingSource(){return {id:current.id,documentId:current.documentId,revision:current.revision,name:current.name,page,view:'original'};}
async function openOriginalSource(source){await openSource(source);}
function acceptBlockSelection(source){selected=source;showSelectionDock();}
function clearSelectionDock(){selected=null;document.querySelector('.selection-dock')?.remove();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.selection-dock')&&!document.querySelector('dialog[open]')){getSelection()?.removeAllRanges();clearSelectionDock();}});
function showSelectionDock(){if(!selected?.text&&!selected?.image)return;let dock=document.querySelector('.selection-dock');if(dock)return;dock=node('div',undefined,{className:'selection-dock'});dock.onmousedown=e=>e.preventDefault();for(const [zh,en,kind]of [['解释','Explain','explain'],['分步','Steps','steps'],['可视化','Visualize','visual'],['记笔记','Add note','note']])dock.append(button(ui(zh,en),()=>selected&&reviewSelection({...selected},kind)));$('readerViewport').append(dock);}
async function persistSelection(source){if(!source.image)return source;const id=crypto.randomUUID(),{image,...safe}=source;await workspace.put('regions',{id,source:safe,image});return {...safe,regionId:id};}
function reviewSelection(source,preferred){const token=openToken;getSelection()?.removeAllRanges();clearSelectionDock();return selectionReview(source,{preferred,isCurrent:()=>source.external||token===openToken,onSource:openOriginalSource,onNote:async q=>{const saved=await persistSelection(q);addNote(q.text,saved);dropFeedback($('learning'));},onSend:async(q,kind)=>{const saved=await persistSelection(q);if(!q.external&&token!==openToken)return;dropFeedback($('learning'));const request=kind==='steps'?ui('请根据原文分步推导并解释：','Explain step by step using the source: '):kind==='visual'?ui('请选择适合原文的交互可视化帮助理解：','Choose a suitable interactive visualization of the source: '):ui('请解释这段原文：','Explain this passage: ');await visualizeSelection(saved,true,{question:request+q.text});}});}
