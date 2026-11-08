import {DOCUMENT_ACCEPT,supportsDocument,documentTitle,readTextDocument} from './document-formats.js';
import {setupPromptComposer} from './prompt-composer.js';
import {createPDFOCR,needsOCR,recognizeImage} from './pdf-ocr.js';
import {mountArtifactVisual} from './artifact-renderer.js';
import {mountNoteArtifact} from './note-artifact.js';
import {requestsArtifactEdit} from './reading-intent.js';
import {createReaderView,readerMode} from './continuous-reader.js';
import {setupLibraryItems} from './library-items-ui.js';
import {documentKey,sourceEntry,notesForDocument,inCollection,validateCollections,sourceScopeRoute,validateItems,itemFor,libraryRows,notesInScope,libraryKey,collectionPath} from './library-organization.js';
import {setupCollections} from './collections-ui.js';
import {enhancePDFSelection} from './pdf-selection.js';
import {layoutText,plainLayout,blockContext,REFLOW_VERSION} from './reflow-layout.js';
import {selectionReview,dropFeedback,cropSource} from './reflow-view.js';
import {snapshotFile,readDocumentFile,fileReadMessage} from './document-file.js';
import {scanDirectory,restoredCatalog} from './library-folder.js';
import {chooseImportDestination} from './import-permission.js';
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
import {setupUpdates} from './updates.js';
import {setupReaderNavigation} from './reader-navigation.js';
import {openWorkspace,DATA_KEYS} from './workspace-store.js';
import {setupShell} from './shell.js';
import {t,language} from './i18n.js';
import {createConversations,CHAT_STATE_KEY} from './conversations.js';
import {captureDroppedItems,readDroppedFiles} from './file-drop.js';
import {estimateTokens,assertContextFits} from './chat-context.js';
import {usesVision,isImageFile,imageFromFile,imageFromPDF,withImages} from './vision-input.js';
import {mountSelfCheck,quizPrompt,parseQuiz} from './self-check.js';
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
import {enhanceSegments} from './segmented-control.js';
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
let documentRecords=await workspace.all('documents');
const collections=validateCollections(readLocal('folio-collections',[]));
const libraryItems=validateItems(readLocal('folio-library-items',[]));
const expandedItems=new Set();let selectedTag='';
let current={id:'',name:'',kind:'file'},page=1,total=1,zoom=1,pdf=null,pdfLib=null,renderToken=0,pageText='',selected=null,quote=null,pageReady=false;
const positions=readLocal('jianwei-positions',{}),notes=readLocal('jianwei-notes',[]);
let readingMode=readerMode(readLocal('folio-reading-mode','continuous')),readerView=null;
const readerOffsets=readLocal('folio-reader-offsets',{});
let requestController=null,chatEpoch=0;
let rememberConversations=readLocal('folio-remember-conversations',false)===true;
let chatSave=Promise.resolve();
const conversations=createConversations({onChange:value=>{chatSave=chatSave.catch(()=>{}).then(()=>workspace.put('state',{id:CHAT_STATE_KEY,value}));chatSave.catch(()=>toast(ui('聊天保存失败，请检查本机存储空间。','Chat could not be saved. Check local storage.')));},enabled:()=>rememberConversations,save:note=>{const index=notes.findIndex(n=>n.id===note.id);if(index>=0)notes[index]=note;else notes.unshift(note);saveLocal('jianwei-notes',notes);renderNotes();}});
try{const saved=await workspace.get('state',CHAT_STATE_KEY);if(saved)conversations.restore(saved.value);}catch{toast(ui('无法恢复聊天，请保留工作区并重试。','Could not restore the chat. Keep the workspace and retry.'));}
let desktopKey={configured:false,persisted:false},serverKey=false;
const hasKey=()=>Boolean(settings.apiKey||desktopKey.configured||(serverKey&&normalizeEndpoint(settings.baseUrl)==='https://api.deepseek.com'));
let settings={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',thinking:false,...readLocal('jianwei-settings',{}),apiKey:''};
let mathRenderer=null;
import('/katex/contrib/auto-render.mjs').then(m=>{mathRenderer=m.default;document.querySelectorAll('.reading-answer,.notebook-prose,#notebookDetail details,.anatomy-view,.step-view,.concept-artifact').forEach(renderMath);}).catch(()=>{});
function renderMath(el){if(mathRenderer)mathRenderer(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false,trust:false,strict:'ignore'});}
function entries(){return [...new Map([...folderEntries.filter(entry=>!hiddenDocuments.has(entry.id)),...cachedEntries].map(entry=>[entry.id,entry])).values()];}
const supports=supportsDocument;

let libraryFilter='all',libraryDisplay=readLocal('folio-display','list'),selectedDocument=null;
const favorites=new Set(readLocal('jianwei-favorites',[])),recent=readLocal('jianwei-recent',{});
const hiddenDocuments=new Set(readLocal('folio-hidden-documents',[]));
function showLibrary(){navigation.stop();conversations.archive();setCanvasFocus(false);document.body.dataset.view='library';$('libraryHome').hidden=false;$('readingWorkspace').hidden=true;$('viewTitle').textContent='Library';$('libraryButton').classList.add('active');$('readerTab').classList.remove('active');renderLibrary();}
function showReader(){if(location.hash.startsWith('#/notes'))history.replaceState(null,'',location.pathname);document.body.dataset.view='reader';$('libraryHome').hidden=true;$('readingWorkspace').hidden=false;$('viewTitle').textContent='Reader';$('libraryButton').classList.remove('active');$('readerTab').classList.add('active');$('readerTabGroup').hidden=false;}
function folderDot(path){const colors=['#e6b85c','#61c5a3','#729fe0','#ce82ab','#a88cdb'];const hash=[...path].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);return '<i class="folder-dot" style="--dot:'+colors[hash%colors.length]+'" aria-hidden="true"></i>';}
function renderFolders(){const paths=new Set();for(const e of [...folderEntries,...cachedEntries.filter(e=>e.importedPath)]){const pieces=e.path.split('/');pieces.pop();for(let i=1;i<=pieces.length;i++)paths.add(pieces.slice(0,i).join('/'));}let content=folder?'<button data-folder="folder:" class="'+(libraryFilter==='folder:'?'active':'')+'">'+folderDot(folder.name)+'<span>'+esc(folder.name)+'</span></button>':paths.size?'':'<div class="folder-placeholder">尚未连接</div>';for(const p of [...paths].sort())content+='<button data-folder="'+esc('folder:'+p)+'" style="padding-left:'+Math.min(35,19+p.split('/').length*7)+'px" class="'+(libraryFilter==='folder:'+p?'active':'')+'">'+folderDot(p)+'<span>'+esc(p.split('/').at(-1))+'</span></button>';$('folderTree').innerHTML=content;$('folderTree').querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.folder;history.replaceState(null,'',location.pathname);renderLibrary();});}
function formatReadTime(value){return value?new Intl.DateTimeFormat(language(),{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(value):'—';}
function selectDocument(id){
 selectedDocument=id;
 document.querySelectorAll('[data-document-row]').forEach(row=>{const active=row.dataset.documentRow===id;row.classList.toggle('selected',active);row.querySelector('[data-doc]').setAttribute('aria-pressed',String(active));});
 $('openSelected').disabled=!id;$('editLibraryItem').disabled=!id;
 $('assignCollection').disabled=!id;$('assignCollection').dataset.document=id||'';
}
function requestRemoveDocument(entry){
 if(!entry)return;
 const {root,body}=modal(ui('从文献库移除','Remove from library'));root.dataset.removeDocument=entry.id;
 body.append(node('p',entry.name),node('p',ui('移除 Folio 中的条目和导入副本。磁盘上的原文件、笔记与批注会保留。','Remove the library entry and imported copy. Original files on disk, notes and annotations are kept.')));
 const actions=node('div',undefined,{className:'workspace-actions'});
 const cancel=button(ui('取消','Cancel'),()=>root.close());cancel.dataset.removeCancel='';
 const confirm=button(ui('移除','Remove'),async()=>{
  await dbOp('files','delete',entry.id);
  if(folderEntries.some(item=>item.id===entry.id)){hiddenDocuments.add(entry.id);saveLocal('folio-hidden-documents',[...hiddenDocuments]);}
  cachedEntries=cachedEntries.filter(item=>item.id!==entry.id);
  favorites.delete(entry.id);delete recent[entry.id];delete positions[entry.id];
  saveLocal('jianwei-favorites',[...favorites]);saveLocal('jianwei-recent',recent);saveLocal('jianwei-positions',positions);
  if(current.id===entry.id)closeDocument();
  selectedDocument=null;renderLibrary();root.close();toast(ui('已从文献库移除','Removed from the library'));
 });confirm.dataset.removeConfirm='';actions.append(cancel,confirm);body.append(actions);cancel.focus();
}
function renderLibrary(){
 collectionUI.render();$('noteSourceTree').hidden=libraryFilter!=='notes';$('collectionNotes').hidden=!libraryFilter.startsWith('collection:');
 const isNotes=libraryFilter==='notes';$('libraryDocuments').hidden=isNotes;$('notesHome').hidden=!isNotes;$('globalNotesButton').classList.toggle('active',isNotes);if(isNotes){document.querySelectorAll('[data-filter]').forEach(b=>b.classList.remove('active'));notebook.render();return;}
 const q=$('librarySearch').value.toLowerCase();
 const status=$('libraryStatus').value;
 const tags=[...new Set(libraryItems.flatMap(i=>i.tags))].sort((a,b)=>a.localeCompare(b));
 const tagBox=$('libraryTags');tagBox.replaceChildren();tagBox.hidden=!tags.length;for(const tag of tags){const b=button(tag,()=>{selectedTag=selectedTag===tag?'':tag;renderLibrary();});b.className='library-tag'+(selectedTag===tag?' active':'');b.dataset.tag=tag;b.setAttribute('aria-pressed',String(selectedTag===tag));tagBox.append(b);}if(selectedTag&&!tags.includes(selectedTag))selectedTag='';
 let groups=libraryRows(entries(),libraryItems,documentRecords).filter(group=>{
  const item=group.item,members=group.entries,match=members.some(e=>(e.name+' '+(e.path||'')).toLowerCase().includes(q))||[item?.title,item?.authors,item?.year,item?.doi,...(item?.tags||[])].join(' ').toLowerCase().includes(q);
  if(!match||selectedTag&&!item?.tags.includes(selectedTag))return false;
  if(libraryFilter==='recent'&&!members.some(e=>recent[e.id]))return false;
  if(libraryFilter==='starred'&&!members.some(e=>favorites.has(e.id)))return false;
  if(libraryFilter.startsWith('collection:')&&!members.some(e=>inCollection(e,collections.find(c=>c.id===libraryFilter.slice(11)),documentRecords,libraryItems,collections)))return false;
  if(libraryFilter.startsWith('folder:')){const prefix=libraryFilter.slice(7);if(!members.some(e=>(e.handle||e.importedPath)&&(!prefix||e.path.startsWith(prefix+'/'))))return false;}
  if(status==='unfiled'&&members.some(e=>collections.some(c=>inCollection(e,c,documentRecords,libraryItems))))return false;
  if(status==='notes'&&!members.some(e=>notesForDocument(notes,e,documentRecords).length))return false;
  const reading=item?.readStatus||(members.some(e=>recent[e.id])?'reading':'unread');
  return !['unread','reading','read'].includes(status)||status===reading;
 });
 groups.sort($('sortLibrary').value==='name'?(a,b)=>(a.item?.title||a.entry.name).localeCompare(b.item?.title||b.entry.name):(a,b)=>Math.max(0,...b.entries.map(e=>recent[e.id]||0))-Math.max(0,...a.entries.map(e=>recent[e.id]||0)));
 let list=groups.flatMap(g=>expandedItems.has(g.item?.id)?g.entries:[g.entry]);
 if(!list.some(e=>e.id===selectedDocument))selectedDocument=null;
 $('libraryCount').textContent=libraryRows(entries(),libraryItems,documentRecords).length;
 $('resultCount').textContent=language()==='en'?groups.length+(groups.length===1?' document':' documents'):groups.length+' 篇文献';
 $('collectionTitle').textContent=libraryFilter==='all'?ui('全部文献','All documents'):libraryFilter==='recent'?ui('最近阅读','Recently read'):libraryFilter==='starred'?ui('已收藏','Favorites'):libraryFilter.startsWith('collection:')?collectionPath(libraryFilter.slice(11),collections):libraryFilter.slice(7).split('/').at(-1)||folder?.name||ui('本地文件夹','Local folders');
 document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===libraryFilter));
 $('libraryList').classList.toggle('list-mode',libraryDisplay==='list');
 $('listColumns').hidden=libraryDisplay!=='list';
 $('gridView').classList.toggle('active',libraryDisplay==='grid');
 $('listView').classList.toggle('active',libraryDisplay==='list');
 function card(e,group,child=false){
  const item=group.item,type=e.name.split('.').pop().toUpperCase(),title=!child&&item?item.title:documentTitle(e.name),location=(e.handle||e.importedPath)?(e.path.split('/').slice(0,-1).join('/')||folder?.name||ui('本地文件夹','Local folder')):ui('本地副本','Local copy');
  const disclosure=!child&&group.entries.length>1?'<button class="attachment-toggle" data-expand-item="'+esc(item.id)+'" aria-label="'+ui('展开或收起附件','Expand or collapse attachments')+'" aria-expanded="'+expandedItems.has(item.id)+'">'+(expandedItems.has(item.id)?'⌄':'›')+'</button>':'';
  return '<article class="document-card'+(child?' document-attachment':'')+'" data-document-row="'+esc(e.id)+'">'+disclosure+'<button class="document-open" data-doc="'+esc(e.id)+'" aria-label="'+ui('选择 ','Select ')+esc(title)+'" title="'+ui('双击阅读 ','Double-click to read ')+esc(title)+'"><span class="document-name">'+icon('file')+'<span>'+esc(title)+(!child&&item?.tags.length?'<small class="document-tags">'+esc(item.tags.join(' · '))+'</small>':'')+'</span></span><span class="document-type">'+(!child&&group.entries.length>1?group.entries.length+' '+ui('附件','files'):esc(type))+'</span><span class="document-location" title="'+esc(location)+'">'+esc(!child&&item?.authors?item.authors+(item.year?' · '+item.year:''):location)+'</span><span class="document-recent">'+formatReadTime(recent[e.id])+'</span></button><button class="favorite-button '+(favorites.has(e.id)?'saved':'')+'" data-favorite="'+esc(e.id)+'" aria-label="'+ui('收藏 ','Favorite ')+esc(title)+'">'+icon('star')+'</button></article>';
 }
 $('libraryList').innerHTML=groups.length?groups.map(g=>card(g.entry,g)+(expandedItems.has(g.item?.id)?g.entries.filter(e=>e.id!==g.entry.id).map(e=>card(e,g,true)).join(''):'')).join(''):'<div class="empty-state">'+ui('没有匹配的文献。','No matching documents.')+'</div>';
 $('libraryList').querySelectorAll('[data-expand-item]').forEach(b=>b.onclick=()=>{expandedItems.has(b.dataset.expandItem)?expandedItems.delete(b.dataset.expandItem):expandedItems.add(b.dataset.expandItem);renderLibrary();});
 $('libraryList').querySelectorAll('[data-document-row]').forEach(row=>{
  const entry=list.find(item=>item.id===row.dataset.documentRow);
  const remove=button(ui('移除','Remove'),()=>requestRemoveDocument(entry));
  remove.className='document-remove';remove.dataset.removeDoc=entry.id;remove.title=ui('移除此文件，保留笔记','Remove this file; keep its notes');remove.setAttribute('aria-label',remove.title+' '+entry.name);row.append(remove);
  row.oncontextmenu=e=>{e.preventDefault();selectDocument(entry.id);requestRemoveDocument(entry);};
  row.addEventListener('keydown',e=>{if(e.key==='Delete'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();requestRemoveDocument(entry);}});
 });
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
function updateFolderUI(){$('folderName').textContent=folder?folder.name:t('本地文献库');$('folderDescription').textContent=folder?(folderGranted?ui('已连接 · 文件保存在本机','Connected · Files stay on this device'):folderEntries.length?ui('已恢复目录 · 打开文献时确认访问','Catalog restored · Confirm access when opening'):ui('文件夹暂不可用 · 可刷新重试','Folder unavailable · Refresh to retry')):t('文件只保存在你的设备上');$('storageHint').textContent=folder?t('导入文献将复制到所选文件夹'):'';renderFolders();}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.filter;history.replaceState(null,'',location.pathname);renderLibrary();});
for(const [id,view]of [['gridView','grid'],['listView','list']])$(id).onclick=()=>{libraryDisplay=view;saveLocal('folio-display',view);renderLibrary();};
$('sortLibrary').onchange=renderLibrary;$('libraryStatus').onchange=renderLibrary;
$('homeBrand').onclick=()=>{libraryFilter='all';history.replaceState(null,'',location.pathname);showLibrary();};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();showLibrary();$('librarySearch').focus();}});
async function scanFolder(){const target=folder;if(!target)return;const found=await scanDirectory(target,supports);if(folder!==target)return;await dbOp('meta','put',{version:1,folder:target,entries:found},'folder-catalog');if(folder!==target)return;folderEntries=found;folderGranted=true;updateFolderUI();renderLibrary();}
$('chooseFolder').onclick=async()=>{try{if(!window.showDirectoryPicker){$('folderInput').click();return;}const h=await window.showDirectoryPicker({id:'jianwei-library',mode:'read'});await dbOp('meta','put',h,'folder');folder=h;folderEntries=[];folderGranted=false;updateFolderUI();renderLibrary();await scanFolder();toast('已连接本地文献库');}catch(e){if(e.name!=='AbortError')toast(e.message);}};
$('refreshLibrary').onclick=async()=>{try{if(!folder){await refreshCache();return;}if(await folder.requestPermission({mode:'read'})!=='granted'){toast('需要文件夹访问权限才能重新读取文献。');return;}await scanFolder();toast('文献库已刷新');}catch(e){toast(e.message);}};
async function refreshCache(){documentRecords=await workspace.all('documents');cachedEntries=(await dbOp('files','getAll')).map(f=>({...f,kind:'file'}));renderLibrary();}
$('importFiles').onclick=()=>$('fileInput').click();
let importPending=false;
async function importFiles(files,forceCache=false){
 if(importPending)return;
 const valid=[...files].map(f=>f.file?f:{file:f,path:f.webkitRelativePath||''}).filter(r=>supports(r.file.name));
 if(!valid.length){toast('请选择 PDF、DOCX、TXT 或 Markdown 文件。');return;}
 importPending=true;$('importFiles').disabled=true;
 try{
  const destination=await chooseImportDestination(forceCache?null:folder);
  if(!destination)return;
  const target=destination.kind==='folder'?destination.handle:null;
  let count=0;
  let failed=0;for(const record of valid){const {file}=record;try{
   if(file.size>200*1024*1024){toast(file.name+' 超过 200 MB，已跳过。');continue;}
   if(target){
    let name=file.name,i=1;
    while(true){try{await target.getFileHandle(name);const dot=file.name.lastIndexOf('.');name=file.name.slice(0,dot)+` (${i++})`+file.name.slice(dot);}catch(e){if(e.name==='NotFoundError')break;throw e;}}
    const h=await target.getFileHandle(name,{create:true});const w=await h.createWritable();
    try{await w.write(file);await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}
   }else{
    await dbOp('files','put',{id:'local:'+crypto.randomUUID(),name:file.name,blob:await snapshotFile(file),path:record.path||'浏览器本地副本',importedPath:Boolean(record.path?.includes('/'))});
   }
   count++;
  }catch(error){failed++;console.warn('Import failed:',file.name,error.name);}}
  if(count){libraryFilter='all';$('librarySearch').value='';history.replaceState(null,'',location.pathname);}
  if(target&&target===folder)await scanFolder();
  await refreshCache();
  toast(ui(`已导入 ${count} 篇文献${target?'到本地文件夹':'到本机库'}${failed?'；'+failed+' 篇读取失败':''}`,`Imported ${count} documents${failed?'; '+failed+' failed':''}`));return {count,failed};
 }finally{importPending=false;$('importFiles').disabled=false;}
}
for(const [id,forceCache]of [['fileInput',false],['folderInput',true]]){
 $(id).onchange=guard(async e=>{const input=e.target;try{await importFiles([...input.files],forceCache);}finally{input.value='';}});
}
$('librarySearch').oninput=renderLibrary;
for(const id of ['libraryButton','readerLibrary'])$(id).onclick=()=>{libraryFilter='all';history.replaceState(null,'',location.pathname);showLibrary();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
function updatePageUI(){$('pageNumber').value=page;$('pageNumber').max=total;$('pageTotal').textContent='/ '+total;$('prevPage').disabled=page<=1;$('nextPage').disabled=page>=total;$('zoomLabel').textContent=Math.round(zoom*100)+'%';$('documentTitle').textContent=documentTitle(current.name);$('readerTabTitle').textContent=$('documentTitle').textContent;$('documentSubtitle').textContent=/\.docx$/i.test(current.name)?ui('DOCX · 文字阅读，页码按重排分段','DOCX · Text reading, pages follow reflow'):(current.path||'本地文献');if(positions[current.id]!==page){positions[current.id]=page;saveLocal('jianwei-positions',positions);}}
let textPages=[],openToken=0,documentIndex=null,documentReady=false,pdfOCR=null,draftSource=null,composer=null;
function getDocumentIndex(){
 if(!documentReady)throw new Error("文献仍在打开，请加载完成后再发送。");
 if(documentIndex?.id===current.id)return documentIndex;
 const token=openToken,doc=pdf,recognizer=pdfOCR,entry={...current},plain=[...textPages],count=total;
 documentIndex=createDocumentIndex({id:entry.id,name:entry.name,total:count,loadPages:async()=>(await workspace.all('pages')).filter(p=>p.documentId===(entry.documentId||entry.id)&&p.revision===entry.revision&&(p.ocr||p.indexVersion===REFLOW_VERSION)),savePage:async p=>{const id=entry.id+':'+entry.revision+':'+p.page,previous=await workspace.get('pages',id);if(previous?.ocr)return;await workspace.put('pages',{...previous,...p,indexVersion:REFLOW_VERSION,id,documentId:entry.documentId||entry.id,revision:entry.revision});},readPage:async number=>{
  if(token!==openToken)throw new DOMException('文献已切换','AbortError');
  if(!doc)return plain[number-1]||'';
  const p=await doc.getPage(number),content=await p.getTextContent();
  if(token!==openToken)throw new DOMException('文献已切换','AbortError');
  if(needsOCR(content.items)){const saved=await recognizer?.cached(number);if(saved?.ocr)return saved.text;}
  return layoutText(content.items,p.getViewport({scale:1}),number).text;
 }});return documentIndex;
}
const navigation=setupReaderNavigation({getState:()=>({entry:{...current},page,pdf,ready:documentReady&&pageReady,index:getDocumentIndex,ocr:pdfOCR}),goPage:p=>changePage(p,{keepConversation:true}),store:workspace,addNote,visualize:visualizeSelection,stageSource,onContextChanged:()=>{documentIndex=null;guard(()=>renderPage())();}});
function showDocumentContext(context){
 const box=$('sourceContext');box.hidden=!context;box.replaceChildren();if(!context)return;
 const pages=[...new Set(context.excerpts.map(e=>e.page))],summary=document.createElement('summary');summary.textContent='参考原文 · '+(pages.length?'第 '+pages.join('、')+' 页':'未提取到文字');box.append(summary);
 const info=document.createElement('p');info.textContent='已在《'+context.name+'》中检索 '+context.scanned+' 页，只将相关段落用于这次解读。'+(context.failedPages.length?'其中 '+context.failedPages.length+' 页读取失败。':'');box.append(info);
 for(const number of pages){const button=document.createElement('button');button.textContent='第 '+number+' 页 ↗';button.onclick=()=>{if(current.id===context.documentId)guard(()=>changePage(number,{keepConversation:true}))();};box.append(button);}
}

async function openDocument(entry){if(!entry)return;pdfOCR?.destroy();pdfOCR=null;readerView?.destroy();readerView=null;selectionControls?.destroy();selectionControls=null;navigation.stop();pageReady=false;$('selectRegion').disabled=true;if(!draftSource)setQuote(null);documentIndex=null;documentReady=false;textPages=[];showReader();recent[entry.id]=Date.now();saveLocal('jianwei-recent',recent);const token=++openToken;renderToken++;selected=null;pageText='';$('documentContent').innerHTML='<div class="loading">正在打开文献…</div>';const previous=pdf;pdf=null;current={...entry};renderNotes();page=positions[entry.id]||1;zoom=1;total=1;updatePageUI();try{const file=await readDocumentFile(entry);if(previous)await previous.loadingTask.destroy();if(token!==openToken)return;{const identity=await workspace.identify(entry,file);if(token!==openToken)return;documentRecords=documentRecords.filter(d=>d.id!==identity.id).concat(identity);current={...entry,revision:identity.revision,documentId:identity.id};renderNotes();if(/\.pdf$/i.test(entry.name)){pdfLib??=await import('/vendor/build/pdf.mjs');pdfLib.GlobalWorkerOptions.workerSrc='/vendor/build/pdf.worker.mjs';const loaded=await pdfLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'}).promise;if(token!==openToken){await loaded.loadingTask.destroy();return;}pdf=loaded;total=pdf.numPages;pdfOCR=createPDFOCR({pdf,entry:{...current},store:workspace,onPage:()=>{if(token===openToken)documentIndex=null;}});}else{textPages=await readTextDocument(file);total=textPages.length;}}if(token!==openToken)return;page=Math.max(1,Math.min(page,total));await renderPage();if(token===openToken)documentReady=true;renderLibrary();}catch(e){if(token!==openToken)return;if(previous)await previous.loadingTask.destroy().catch(()=>{});const box=node('div',undefined,{className:'empty-state'});box.append(node('p',fileReadMessage(e,language()==='en')),button(ui('重试','Retry'),()=>openDocument(entry)));const picker=document.createElement('input');picker.type='file';picker.accept=DOCUMENT_ACCEPT;picker.hidden=true;box.append(button(ui('重新选择文件','Locate file'),()=>picker.click()),picker);picker.onchange=guard(async()=>{const chosen=picker.files[0];if(!chosen)return;const copy=await snapshotFile(chosen);if(token!==openToken)return;const replacement={id:entry.id,name:chosen.name,path:entry.path||'',blob:copy,kind:'file'};await dbOp('files','put',replacement);folderEntries=folderEntries.filter(item=>item.id!==entry.id);await refreshCache();if(token===openToken)await openDocument(replacement);});$('documentContent').replaceChildren(box);pageText='';}}
let activeLayout=null,selectionControls=null;
async function renderPage(){
 if($('readerViewport').clientWidth<100||!$('readerViewport').clientHeight)return;
 const saved=readerView?.position()||readerOffsets[current.id]||{page,offset:0};readerView?.destroy();readerView=null;
 selectionControls?.destroy();selectionControls=null;navigation.stop();activeLayout=null;clearSelectionDock();pageReady=false;$('selectRegion').disabled=true;
 const token=++renderToken;selected=null;pageText='';updatePageUI();
 const view=createReaderView({host:$('documentContent'),viewport:$('readerViewport'),pdf,pdfLib,textPages,zoom,mode:readingMode,ocr:pdfOCR,onOCRReview:async number=>{await changePage(number,{keepConversation:true});await navigation.recognize();},
  onActive:r=>{if(token!==renderToken)return;page=r.number;pageReady=r.ready;pageText=r.layout?.text||'';activeLayout=r.layout;updatePageUI();$('selectRegion').disabled=!r.ready;$('readerStatus').textContent=r.ready&&!pageText.trim()?ui('此页可使用本地 OCR','Local OCR is available for this page'):'';},
  onPosition:value=>{if(token!==renderToken)return;readerOffsets[current.id]=value;saveLocal('folio-reader-offsets',readerOffsets);},
  onRendered:()=>{if(token===renderToken)annotations.mount();},
  onSelect:(number,value)=>{if(token===renderToken)acceptBlockSelection({...readingSource(number),...value});}
 });readerView=view;await view.init(page,saved.page===page?saved.offset:0);
}
async function changePage(p,{keepConversation=false}={}){
 const next=Math.max(1,Math.min(total,Number(p)||1));
 if(readingMode==='continuous'&&readerView){getSelection()?.removeAllRanges();clearSelectionDock();await readerView.jump(next);return;}
 readerView?.destroy();readerView=null;page=next;readerOffsets[current.id]={page,offset:0};await renderPage();
}
const modeSelect=$('readingModeSelect');modeSelect.value=readingMode;
modeSelect.onchange=guard(async()=>{readingMode=readerMode(modeSelect.value);saveLocal('folio-reading-mode',readingMode);if(current.id)await renderPage();});
$('prevPage').onclick=guard(()=>changePage(page-1));$('nextPage').onclick=guard(()=>changePage(page+1));$('pageNumber').onchange=guard(e=>changePage(e.target.value));
for(const [id,delta]of [['zoomIn',.1],['zoomOut',-.1]])$(id).onclick=guard(async()=>{zoom=Math.max(.6,Math.min(2,Math.round((zoom+delta)*10)/10));await renderPage();});
$('bookmarkButton').onclick=()=>{positions[current.id]=page;saveLocal('jianwei-positions',positions);toast('已记住第 '+page+' 页，下次打开会回到这里。');};
document.addEventListener('selectionchange',()=>{
 const s=getSelection();if(!s?.rangeCount||s.isCollapsed||!s.toString().trim()||!$('documentContent').contains(s.anchorNode)||!$('documentContent').contains(s.focusNode)){clearSelectionDock();return;}
 const range=s.getRangeAt(0),element=n=>n.nodeType===1?n:n.parentElement,first=element(range.startContainer)?.closest('[data-page]'),last=element(range.endContainer)?.closest('[data-page]');
 const number=Number(first?.dataset.page)||page,layout=readerView?.get(number)?.layout;
 selected={text:s.toString().trim().slice(0,16000),...readingSource(number),...(last&&last!==first?{endPage:Number(last.dataset.page)}:{})};
 if(layout&&first===last){const blocks=[...first.querySelectorAll('.semantic-block[data-block]')].filter(el=>range.intersectsNode(el)).map(el=>el.dataset.block);selected={...selected,selectionMethod:'blocks',blockIds:blocks,blockContext:blockContext(layout,blocks),rect:layout.blocks.find(b=>b.id===blocks[0])?.rect};}
 showSelectionDock();
});
function setQuote(q){$('quote').querySelector('img')?.remove();quote=q;$('quote').hidden=!q;if(q){$('quoteSource').textContent=sourceLabel(q);$('quoteText').textContent=q.text||(q.regionId?ui('已引用图片','Image attached'):'');$('prompt').focus();}}
$('citeSelection').onmousedown=e=>e.preventDefault();$('selectRegion').onclick=guard(()=>navigation.region());
$('citeSelection').onclick=()=>selected?reviewSelection({...selected}):toast('先在左侧选中一段文字。');$('clearQuote').onclick=()=>{draftSource=null;setQuote(null);composer?.staged(false);};
$('learning').ondragover=e=>{if([...e.dataTransfer.types].includes('Files'))return;e.preventDefault();$('learning').classList.add('drag-over');};
$('learning').ondragleave=e=>{if(!$('learning').contains(e.relatedTarget))$('learning').classList.remove('drag-over');};
$('learning').ondrop=e=>{e.preventDefault();$('learning').classList.remove('drag-over');const source=sourceFromTransfer(e.dataTransfer);if(source){setAICollapsed(false);dropFeedback($('learning'),e);guard(()=>visualizeSelection(source))();readerDrag=null;}};

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
  try{return await window.folioDesktop.requestAI({id,config:{baseUrl:config.baseUrl,model:config.model,thinking:config.thinking,workspaceId:config.workspaceId,maxTokens:config.maxTokens,responseFormat:config.responseFormat,answerLanguage:config.answerLanguage},messages});}
  finally{signal?.removeEventListener('abort',cancel);}
 }
 const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...config,messages}),signal});const data=await res.json();if(!res.ok)throw new Error(data.error||'请求失败');return data.content;
}

function addNote(text,source,artifact){source=source?structuredClone(source):null;if(source&&!source.documentId){const key=documentKey(source,documentRecords);if(key&&documentRecords.some(d=>d.id===key))source.documentId=key;}notes.unshift({id:crypto.randomUUID(),text,source,format:'markdown',...(artifact?{artifact:structuredClone(artifact)}:{}),date:new Date().toLocaleString('zh-CN')});saveLocal('jianwei-notes',notes);renderNotes();toast('已存入笔记');}
function currentNotes(){return notesForDocument(notes,current,documentRecords);}
let notePreviewDisposers=[];
function renderNotes(){
 notePreviewDisposers.forEach(dispose=>dispose());notePreviewDisposers=[];
 if(typeof notebook!=='undefined')notebook.render();$('globalNoteCount').textContent=notes.length;const visible=currentNotes();$('noteCount').textContent=visible.length;$('currentNotesSource').textContent=current.name||ui('当前文献','Current document');$('currentNotesSource').title=current.name||'';$('exportNotes').disabled=!visible.length;const list=$('notesList');list.replaceChildren();
 if(!visible.length)list.append(node('p',ui('这篇文献还没有笔记。','No notes for this document yet.'),{className:'empty-state'}));
 for(const note of visible){let disposePreview=()=>{};const card=node('article',undefined,{className:'note-card'}),title=node('h3',noteTitle(note)),content=node('div',undefined,{className:'notebook-prose'});card.dataset.noteId=note.id;renderNoteMarkdown(content,noteBody(note),renderMath);card.append(title,content);if(note.source?.id||note.source?.documentId)card.append(button(sourceLabel(note.source),()=>openSource(note.source)));const actions=node('div',undefined,{className:'note-actions'});actions.append(button(ui('编辑','Edit'),()=>{disposePreview();card.replaceChildren();mountNoteEditor(card,note,{renderMath,onCancel:renderNotes,onSave:changes=>{Object.assign(note,changes);saveLocal('jianwei-notes',notes);renderNotes();}});}),button(ui('导出 Markdown','Export Markdown'),()=>exportNotesMarkdown([note],id=>workspace.get('regions',id))),button(ui('删除','Delete'),()=>{notes.splice(notes.findIndex(n=>n.id===note.id),1);saveLocal('jianwei-notes',notes);renderNotes();}));card.append(actions);list.append(card);disposePreview=mountNoteArtifact(card,note,{renderMath,onChanged:()=>saveLocal('jianwei-notes',notes)});notePreviewDisposers.push(disposePreview);}
}
$('exportNotes').onclick=guard(()=>exportNotesMarkdown(currentNotes(),id=>workspace.get('regions',id),{bundle:true}));
$('openDocumentNotes').onclick=()=>{const key=documentKey(current,documentRecords);location.hash=key?sourceScopeRoute('document',key):'#/notes';};
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
const notebook=setupNotebook({notes,entries,documents:()=>documentRecords,collections:()=>collections,items:()=>libraryItems,renderMath,getRegion:id=>workspace.get('regions',id),onRestoreArtifact:restoreArtifact,onArtifactChanged:()=>saveLocal('jianwei-notes',notes),memoryEnabled:()=>rememberConversations,onMemoryChange:enabled=>{rememberConversations=enabled;saveLocal('folio-remember-conversations',enabled);updateMemoryUI();},onChanged:()=>{saveLocal('jianwei-notes',notes);renderNotes();},onOpenSource:guard(async note=>{await openSource(note.source);if(note.source.annotationId&&current.revision===note.source.revision)await annotations.revealId(note.source.annotationId);})});
const artifacts=createArtifactWorkspace({store:workspace,host:$('visualStage'),renderMath,onExpand:()=>setCanvasFocus(!document.body.classList.contains('canvas-focus')),onSave:record=>openStudyNote(record,{ask:hasKey()?((messages,signal)=>askAPI({...settings,responseFormat:'json'},messages,signal)):null,answerLanguage:readLocal('folio-answer-language','auto'),renderMath,onSave:(draft,snapshot)=>addNote(draft.title+'\n\n'+draft.text,snapshot.source,{kind:'folio-artifact',record:snapshot})}),onSource:openSource,onOpen:activateArtifact,onRequestView:kind=>{const source=artifacts.current?.source;if(source)return visualizeSelection(source,true,{followup:true,question:learningRequest(kind)});},render:async(host,version,source,onState)=>{
 setAICollapsed(false);setTab('visual');const answer=mountReadingAnswer(host,version.answer,{onPage:number=>openSource({...source,page:number})});renderMath(answer);const stage=document.createElement('div');stage.className='artifact-renderer';host.append(stage);return mountArtifactVisual(stage,version,{source,onState,renderMath,onSave:(text,snapshot)=>{if(snapshot)onState(snapshot);addNote(text,source,{kind:'folio-artifact',record:artifacts.current});}});
}});
async function activateArtifact(record){requestController?.abort();const entry=sourceEntry(record.source,entries(),documentRecords);if(entry&&(current.id!==entry.id||!documentReady)){await openDocument(entry);if(!record.source.revision||record.source.revision===current.revision)await changePage(record.source.page||1,{keepConversation:true});}else if(!entry&&!documentReady){$('documentContent').replaceChildren(node('p',ui('原文未连接，作品仍可使用。点击「回到原文」重新定位。','Source not connected. The artifact remains available; use Source to relink.')));}const v=record.versions[record.cursor];conversations.ensure(record.source,v.answer.title);if(!conversations.current.turns.some(t=>t.artifactId===record.id)){conversations.complete(conversations.current.id,v.answer.title,v.answer,v.plan,{source:record.source});conversations.updateTurn(conversations.current.id,conversations.current.turns.at(-1).id,{artifactId:record.id});}renderConversationHistory();setAICollapsed(false);showReader();setQuote(record.source);await artifacts.show(record);showSelfCheck(conversations.current.turns.find(t=>t.artifactId===record.id)||conversations.current.turns.at(-1));}
async function openSource(source){if(!source?.id&&!source?.documentId){toast('这段内容没有关联本地文献。');return;}let entry=sourceEntry(source,entries(),documentRecords);if(!entry)entry=await manager.relink({...source,id:source.id||source.documentId});if(!entry)return;const preserved=artifacts.current;if(current.id!==entry.id||!documentReady){await openDocument(entry);if(preserved&&documentKey(preserved.source,documentRecords)===documentKey(source,documentRecords))await activateArtifact(preserved);}else showReader();if(source.revision&&source.revision!==current.revision){toast('原文内容已变化，旧引用仍保留，未跳转到可能错误的位置。');return;}await changePage(source.page||1,{keepConversation:true});if(source.rect){const page=document.querySelector('[data-page="'+(source.page||1)+'"].pdf-page');if(page){const marker=document.createElement('div');marker.className='source-region';Object.assign(marker.style,{left:source.rect[0]*100+'%',top:source.rect[1]*100+'%',width:source.rect[2]*100+'%',height:source.rect[3]*100+'%'});page.append(marker);}}}
function updateMemoryUI(){$('memoryShortcut').textContent=t('自动整理：'+(rememberConversations?'开启':'关闭'));}
function endConversation(){
 chatEpoch++;historyVisible=20;
 for(const controller of quizControllers)controller.abort();quizControllers.clear();disposeQuiz?.();disposeQuiz=null;$('selfCheck').replaceChildren();$('conversationHistory').replaceChildren();
 draftSource=null;
 artifacts.clear();
 requestController?.abort();requestController=null;conversations.reset();setBusy(false);clearScene();setQuote(null);$('conversationContext').hidden=true;$('conversationTopic').textContent='';$('prompt').value='';composer?.reset();selected=null;getSelection()?.removeAllRanges();
 document.querySelectorAll('.reading-answer').forEach(e=>e.remove());$('messages').replaceChildren();
 document.querySelector('[data-tab=lab]').hidden=true;resetVisual();setTab('visual');
}
function routeNotes(){if(!location.hash.startsWith('#/notes'))return;libraryFilter='notes';showLibrary();const value=location.hash.slice('#/notes'.length).replace(/^\//,'');let id=null;try{id=value?decodeURIComponent(value):null;}catch{}if(value.startsWith('document/')||value.startsWith('collection/')||value.startsWith('item/')){const kind=value.split('/')[0];let key;try{key=decodeURIComponent(value.slice(kind.length+1));}catch{key='';}notebook.scope(kind,key);}else notebook.select(id);}
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
window.addEventListener('pagehide',()=>{conversations.archive();pdfOCR?.destroy();});
updateMemoryUI();
const collectionUI=setupCollections({collections,entries,items:()=>libraryItems,documents:()=>documentRecords,getFilter:()=>libraryFilter,onSelect:filter=>{libraryFilter=filter;history.replaceState(null,'',location.pathname);showLibrary();},onSave:()=>{saveLocal('folio-collections',collections);renderLibrary();renderNotes();}});
const itemUI=setupLibraryItems({items:libraryItems,entries,documents:()=>documentRecords,onOpen:openDocument,notes:item=>notesInScope(notes,{kind:'item',id:item.id},collections,documentRecords,libraryItems),onSave:item=>{const next=libraryItems.filter(i=>i.id!==item.id).concat(item);validateItems(next);libraryItems.splice(0,libraryItems.length,...next);saveLocal('folio-library-items',libraryItems);renderLibrary();renderNotes();},onImport:async files=>{const added=[];for(const file of files){if(!supports(file.name)||file.size>200*1024*1024)throw Error(ui('附件需为不超过 200 MB 的 PDF、DOCX、TXT 或 Markdown。','Use PDF, DOCX, TXT or Markdown attachments up to 200 MB.'));}for(const file of files){const entry={id:'local:'+crypto.randomUUID(),name:file.name,blob:await snapshotFile(file),path:ui('导入附件','Imported attachment')};await dbOp('files','put',entry);added.push(entry);}await refreshCache();return added;}});
$('editLibraryItem').onclick=()=>{const entry=entries().find(e=>e.id===selectedDocument);if(entry)itemUI.edit(entry);};
async function init(){enhanceSelects();enhanceSegments();hydrateIcons();if(!window.folioDesktop){try{serverKey=(await (await fetch('/api/status')).json()).configured===true;modelSettings.setServerKey(serverKey);}catch{}}updateModel();renderNotes();try{await refreshCache();folder=await dbOp('meta','get','folder');folderEntries=await restoredCatalog(folder,await dbOp('meta','get','folder-catalog'));updateFolderUI();renderLibrary();if(folder&&await folder.queryPermission({mode:'read'})==='granted')await scanFolder();}catch(error){toast(folder?fileReadMessage(error,language()==='en'):ui('本地库暂时不可用，请检查浏览器存储权限。','Local library unavailable. Check browser storage permissions.'));}finally{await window.folioDesktop?.finishLibraryRestore?.();}updateFolderUI();renderLibrary();}
init().then(async()=>{const restoreRoute=location.hash;if(conversations.current?.turns.length){const source=conversations.current.source,entry=sourceEntry(source,entries(),documentRecords);if(entry)await openDocument(entry);else{showReader();$('readerTabGroup').hidden=false;}const saved=conversations.current.artifact?.record,record=saved?(await workspace.get('artifacts',saved.id)||saved):null;if(record)await artifacts.show(record);else resetVisual();renderConversationHistory();showSelfCheck(conversations.current.turns.at(-1));scrollToCurrentAnswer();}else resetVisual();setTab('visual');if(restoreRoute.startsWith('#/notes'))history.replaceState(null,'',location.pathname+restoreRoute);routeNotes();}).catch(error=>toast(error.message));

const manager=setupWorkspaceManager({store:workspace,dbOp,entries,refresh:refreshCache,notes,saveNotes:()=>{saveLocal('jianwei-notes',notes);renderNotes();},openDocument});
const zoteroButton=button('Zotero',()=>manager.importedLibrary());zoteroButton.className='connect-folder';document.querySelector('.library-sidebar').insertBefore(zoteroButton,document.querySelector('.sidebar-bottom'));
const updates=setupUpdates({beforeRestart:async()=>{await chatSave;if(document.querySelector('dialog[open]:not(.update-dialog), .note-edit-workspace'))throw Error(ui('请先保存并关闭其他编辑窗口。','Save and close other editing dialogs first.'));document.activeElement?.blur();await workspace.snapshot();await dbOp('files','getAll');}});
const checkUpdates=updates.open;
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
let canvasReadingPosition=null;
function setCanvasFocus(active){const wasActive=document.body.classList.contains('canvas-focus');if(active&&!wasActive)canvasReadingPosition=readerView?.position();document.body.classList.toggle('canvas-focus',active);if(!active&&wasActive&&canvasReadingPosition){const saved=canvasReadingPosition;canvasReadingPosition=null;requestAnimationFrame(()=>readerView?.jump(saved.page,saved.offset).catch(e=>toast(e.message)));}document.querySelectorAll('[data-canvas-toggle]').forEach(b=>b.textContent=active?ui('返回分栏','Return to split view'):ui('展开画布','Expand canvas'));$('focusCanvas').setAttribute('aria-pressed',String(active));$('focusCanvas').setAttribute('aria-label',active?'返回分栏阅读':'展开画布');$('focusCanvas').title=active?'返回分栏阅读':'展开画布';}
$('focusCanvas').onclick=()=>{const active=!document.body.classList.contains('canvas-focus');if(active)setAICollapsed(false);setCanvasFocus(active);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('canvas-focus'))setCanvasFocus(false);});
function renderPlan(plan,source){

 if(plan.kind==='permutation'){setTab('visual');disposeScene=mountPermutation($('visualStage'),plan,(text,artifact)=>addNote(text,source,artifact));}
 else if(plan.kind==='derived'){document.querySelector('[data-tab=lab]').hidden=false;setTab('lab');$('groupSelect').value=String(plan.n);$('groupSelect').dispatchEvent(new Event('change',{bubbles:true}));resetDerived();}
 else if(plan.kind==='tetrahedron')showScene({operation:plan.operation,explanation:plan.reason,generated:!source.builtin},source);
 else if(['clarify','unsupported'].includes(plan.kind)){$('visualStage').innerHTML='<div class="visual-error"><h2>'+esc(plan.kind==='clarify'?'需要补充一点信息':'这个实验还未支持')+'</h2><p>'+esc(plan.reason)+'</p><p>可以在下方补充说明，原文引用仍然保留。</p></div>';}
}
async function visualizeSelection(source,forceQuestion=false,{followup=false,question=source.text,outputMode=null}={}){
 const epoch=chatEpoch;await keyReady;if(epoch!==chatEpoch)return;
 conversations.ensure(source,question);
 const candidate=artifacts.current;const baseArtifact=followup&&candidate&&candidate.source.id===source.id&&candidate.source.text===source.text&&candidate.source.regionId===source.regionId?candidate:null;if(!baseArtifact)artifacts.suspend();
 const sessionToken=conversations.current.id;renderConversationHistory();
 requestController?.abort();requestController=null;setBusy(false);setAICollapsed(false);
 clearScene();showDocumentContext(null);setQuote(source.text?source:null);setTab('visual');$('visualPanel').scrollTop=0;
 if(!hasKey()&&!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(settings.baseUrl)){if(baseArtifact){toast('请在设置中连接模型服务。');return;}$('visualStage').innerHTML='<div class="visual-error"><h2>连接模型后分析这段原文</h2><p>你的选段已保留，请在设置中连接模型服务。</p><button id="connectForGraph">连接模型</button></div>';$('connectForGraph').onclick=()=>$('settingsButton').click();return;}
 const controller=new AbortController();requestController=controller;setBusy(true);const pending=node('div',ui('正在理解这段内容','Reading and preparing the response'),{className:'visual-loading'});pending.setAttribute('role','status');if(!baseArtifact)$('visualStage').replaceChildren();$('visualStage').append(pending);
 try{
  let context=null;
  if(($('includePage').checked||source.selectionMethod==='blocks')&&contextBelongsToSource(source,current)){
   setPhase('正在查阅原文');
   if(pdfOCR){try{await pdfOCR.recognize(Number(source.page)||page,{signal:controller.signal});}catch(error){if(controller.signal.aborted||!usesVision(settings))throw error;}documentIndex=null;}
   context=await getDocumentIndex().retrieve((source.text||'')+'\n'+question,Number(source.page)||page,{signal:controller.signal,onProgress:(done,count)=>setPhase('正在查阅原文 · '+done+' / '+count+' 页')});
   context.anchorPage=Number(source.page)||page;context.selectionAnchor=source.blockContext;if(source.blockContext?.text){context.excerpts.unshift({page:source.blockContext.page,text:source.blockContext.text});context.text='[选段所在章节与相邻段落]\n'+source.blockContext.heading+'\n'+source.blockContext.text+'\n'+context.text;}
  }
  if(controller.signal.aborted)return;showDocumentContext(context);setPhase('正在结合原文解释选段');
  source=await prepareVisionSource(source,question,controller.signal);
  const images=await conversationImages(source,controller.signal);
  const ask=messages=>{assertContextFits(messages);return askAPI({...settings,responseFormat:'json',maxTokens:8192},messages,controller.signal);};
  const response=await requestStructured(ask,withImages(requestReading(source.text||'',context,{question,history:conversations.history(),artifact:baseArtifact?baseArtifact.versions[baseArtifact.cursor]:null,answerLanguage:readLocal('folio-answer-language','auto'),outputMode,hasImages:images.length>0}),images),(raw,{attempt})=>parseReading(raw,context?.excerpts||[],{strictPlan:attempt===0,question,outputMode,artifact:baseArtifact?.versions[baseArtifact.cursor]}),{signal:controller.signal,onRepair:()=>setPhase('正在整理回答格式')});if(controller.signal.aborted||!conversations.isCurrent(sessionToken))return;let plan=response.plan;
  try{if(response.action!=='revise')plan=verifyPlanAgainstSource(plan,baseArtifact&&plan.kind==='permutation'?question:source.text+'\n'+response.parameterEvidence.map(e=>e.quote).join('\n'));}catch{plan={kind:'explain',object:response.answer.title,reason:'已展示原文解读，参数存在不同定义，暂不混合计算。'};}
  conversations.complete(sessionToken,question,response.answer,plan,{source,context});renderConversationHistory();showSelfCheck(conversations.current.turns.at(-1));conversations.setArtifact(sessionToken,plan);

  pending.remove();
  if(baseArtifact&&plan.kind==='explain'&&response.action!=='revise'&&!requestsArtifactEdit(question)){await artifacts.appendDiscussion(question,response.answer,baseArtifact);conversations.setArtifact(sessionToken,{kind:'folio-artifact',record:artifacts.current});conversations.updateTurn(sessionToken,conversations.current.turns.at(-1).id,{artifactId:baseArtifact.id});return;}
  const accepted=await artifacts.accept(source,plan,response.answer,response.visual,baseArtifact);const acceptedVersion=accepted.versions[accepted.cursor].id;conversations.updateTurn(sessionToken,conversations.current.turns.at(-1).id,{artifactId:accepted.id});
  conversations.setArtifact(sessionToken,{kind:'folio-artifact',record:artifacts.current});
  if(plan.kind==='concept'&&!response.visual){
   setPhase('解读已完成，正在整理关系图');
   try{
    const data=await requestStructured(ask,requestGraph(source.text+'\n用户问题：'+question,context?.text||'',plan.object,baseArtifact?.versions[baseArtifact.cursor]?.visual),raw=>parseGraph(raw,source.text+'\n'+(context?.text||'')),{signal:controller.signal,onRepair:()=>setPhase('正在整理关系图格式')});
    if(!controller.signal.aborted&&conversations.isCurrent(sessionToken)){await artifacts.setVisual(data,acceptedVersion);conversations.setArtifact(sessionToken,{kind:'folio-artifact',record:artifacts.current});}
   }catch(error){if(controller.signal.aborted)return;const note=document.createElement('p');note.className='muted';note.textContent='这次关系图未能完成，原文解读已保留。';$('visualStage').append(note);}
  }

 }catch(e){if(controller.signal.aborted)return;pending.remove();const error=node('div',undefined,{className:'visual-error'});error.append(node('h2',ui('暂时无法可靠生成','Could not complete the response')),node('p',e instanceof SyntaxError?ui('模型返回的格式仍不完整，请重试。','The model returned an incomplete response. Try again.'):e.message),button(ui('重试','Retry'),()=>{error.remove();return visualizeSelection(source,true,{followup:true,question,outputMode});}));if(!artifacts.current)$('visualStage').replaceChildren();$('visualStage').append(error);}
 finally{pending.remove();if(requestController===controller){requestController=null;setBusy(false);scrollToCurrentAnswer();}}
}
composer=setupPromptComposer({wrap:document.querySelector('.composer-wrap'),input:$('prompt'),form:$('chatForm'),onDropSource:stageSource,sourceFromTransfer});
function stageSource(source){draftSource={...source};setAICollapsed(false);setQuote(draftSource);composer.staged(true);getSelection()?.removeAllRanges();clearSelectionDock();$('prompt').focus();}
let disposeQuiz=null,historyVisible=20,shownQuizTurn=null;const quizControllers=new Set();
function scrollToCurrentAnswer(){const panel=$('visualPanel'),stage=$('visualStage');if(!panel.hidden)panel.scrollTop+=stage.getBoundingClientRect().top-panel.getBoundingClientRect().top;}
function renderConversationHistory(){
 const turns=conversations.current?.turns||[],host=$('conversationHistory');host.replaceChildren();
 $('conversationContext').hidden=!conversations.current;
 $('conversationTopic').textContent=ui('同一聊天','Same chat')+' · '+turns.length+ui(' 轮',' turns')+' · ≈'+estimateTokens(JSON.stringify(conversations.history())).toLocaleString()+' / 1M tokens';
 $('conversationTopic').title=ui('上下文为估算值；实际模型上限由服务商决定。点击右上角 ＋ 才会新建聊天。','Estimated context; provider limits apply. Only the top-right + starts a new chat.');
 if(!turns.length)return;
 if(turns.length>historyVisible)host.append(button(ui('显示更早的对话','Show earlier turns'),()=>{historyVisible+=20;renderConversationHistory();}));
 for(const turn of turns.slice(-historyVisible)){
  const details=node('details',undefined,{className:'conversation-turn'}),summary=node('summary');summary.title=turn.question||turn.answer.title;summary.append(node('span',turn.question||turn.answer.title),node('small',sourceLabel(turn.source||{})));details.append(summary);details.dataset.turnId=turn.id;
  details.addEventListener('toggle',()=>{if(!details.open||details.dataset.loaded)return;details.dataset.loaded='true';const content=node('div',undefined,{className:'conversation-turn-body'});details.append(content);mountReadingAnswer(content,turn.answer,{onPage:page=>openSource({...turn.source,page})});renderMath(content);
   if(turn.artifactId)content.append(button(ui('打开这轮画布','Open this canvas'),guard(async()=>{const record=await workspace.get('artifacts',turn.artifactId);if(record){setQuote(turn.source);await artifacts.show(record);showSelfCheck(turn);scrollToCurrentAnswer();}})));
  });host.append(details);
 }
}
function showSelfCheck(turn){
 disposeQuiz?.();shownQuizTurn=turn?.id;$('selfCheck').replaceChildren();if(!turn)return;
 const token=conversations.current.id;
 disposeQuiz=mountSelfCheck($('selfCheck'),turn,{renderMath,onAttempt:attempt=>conversations.updateTurn(token,turn.id,{quizAttempt:attempt}),generate:async type=>{
  if(!conversations.isCurrent(token))throw Error(ui('请在当前聊天出题。','Use the current chat.'));
  const controller=new AbortController();quizControllers.add(controller);
  try{const images=await conversationImages(turn.source,controller.signal),prompt=withImages(quizPrompt(turn,type,readLocal('folio-answer-language','auto'))+'\n'+JSON.stringify({conversation:conversations.history()}),images);
   const q=await requestStructured(messages=>{assertContextFits(messages);return askAPI({...settings,responseFormat:'json',maxTokens:2048},messages,controller.signal);},prompt,raw=>parseQuiz(raw,type),{signal:controller.signal});
   if(!conversations.isCurrent(token))throw new DOMException('Stopped','AbortError');conversations.updateTurn(token,turn.id,{quiz:q,quizAttempt:null});requestAnimationFrame(()=>{if(conversations.isCurrent(token)&&shownQuizTurn===turn.id)$('selfCheck').scrollIntoView({block:'nearest'});});return q;
  }finally{quizControllers.delete(controller);}
 }});
}
async function prepareVisionSource(source,question,signal){
 if(signal.aborted)throw new DOMException('Stopped','AbortError');
 if(source.image)source=await persistSelection(source);
 if(!usesVision(settings)){
  if(source.regionId&&!source.text?.trim()){const region=await workspace.get('regions',source.regionId);if(!region)throw Error('引用图片已不可用，请重新拖入。');setPhase(ui('正在识别图片文字','Recognizing image text'));const text=await recognizeImage(region.image,{signal});if(!text.trim())throw Error('本地 OCR 未识别出文字，请选择支持视觉的模型或补充图片内容。');return {...source,text,ocr:true};}
  return source;
 }
 if(source.regionId||!pdf||!contextBelongsToSource(source,current))return source;
 const number=Number(source.page)||page,ocr=await pdfOCR?.cached(number);
 if(!ocr?.ocr&&!source.ocr&&!/图片|图表|图中|图像|公式|figure|image|diagram|formula/i.test(question))return source;
 const pdfAtStart=pdf,entry={...current},rect=source.selectionMethod==='region'?source.rect:undefined,key='vision:'+entry.documentId+':'+entry.revision+':'+number+':'+(rect?.join(',')||'page');
 if(!await workspace.get('regions',key)){const image=await imageFromPDF(pdfAtStart,number,{rect,signal});await workspace.put('regions',{id:key,source:{id:entry.id,documentId:entry.documentId,revision:entry.revision,name:entry.name,page:number,...(rect?{rect}:{})},image});}
 return {...source,regionId:key,vision:true};
}
async function conversationImages(source,signal){
 if(!usesVision(settings))return [];
 const refs=[...(conversations.current?.turns||[]).map((t,i)=>({source:t.source,label:ui('第 '+(i+1)+' 轮引用图片','Image from turn '+(i+1))})),{source,label:ui('本轮引用图片','Image for this question')}],seen=new Set(),images=[];
 for(const ref of refs){if(signal?.aborted)throw new DOMException('Stopped','AbortError');const id=ref.source?.regionId;if(!id||seen.has(id))continue;seen.add(id);const region=await workspace.get('regions',id);if(!region)throw Error('历史引用图片已不可用，请重新导入图片或恢复完整备份。');images.push({image:region.image,label:ref.label+' · '+sourceLabel(ref.source)+' · '+id});}
 return images;
}
async function stageImage(file){
 const epoch=chatEpoch,image=await imageFromFile(file),source=await persistSelection({image,name:file.name,text:'',external:true,id:null});if(epoch!==chatEpoch)return;showReader();$('readerTabGroup').hidden=false;stageSource(source);$('quoteText').textContent=ui('图片已加入，将随问题读取。','Image attached for your question.');
 const preview=node('img',undefined,{src:image,alt:file.name,className:'quote-image-preview'});$('quote').querySelector('img')?.remove();$('quote').append(preview);
}
let fileDropPending=false;
const dropOverlay=node('div',ui('松开导入文件夹或文献','Drop a folder or documents to import'),{className:'file-drop-overlay',hidden:true});document.body.append(dropOverlay);
const fileDrag=e=>[...e.dataTransfer?.types||[]].includes('Files');
document.addEventListener('dragover',e=>{if(!fileDrag(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';dropOverlay.hidden=false;},true);
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)dropOverlay.hidden=true;},true);
window.addEventListener('blur',()=>dropOverlay.hidden=true);document.addEventListener('dragend',()=>dropOverlay.hidden=true);
document.addEventListener('drop',e=>{
 dropOverlay.hidden=true;if(!fileDrag(e))return;e.preventDefault();e.stopImmediatePropagation();
 if(fileDropPending||importPending){toast(ui('正在导入，请完成后再拖入。','Import in progress. Drop again when it finishes.'));return;}
 const captured=captureDroppedItems(e.dataTransfer),plain=[...e.dataTransfer.files];
 fileDropPending=true;
 guard(async()=>{try{if(plain.length===1&&isImageFile(plain[0])){await stageImage(plain[0]);return;}
  $('storageHint').textContent=ui('正在读取文件夹…','Reading folder…');const result=await readDroppedFiles(captured,supports,{onProgress:n=>$('storageHint').textContent=ui('已发现 '+n+' 篇文献','Found '+n+' documents')});
  if(result.files.length){await importFiles(result.files,true);showLibrary();}else toast(ui('未找到 PDF、DOCX、TXT 或 Markdown 文献。','No PDF, DOCX, TXT or Markdown documents found.'));
  $('storageHint').textContent=ui(`已扫描 ${result.files.length} 篇文献；跳过 ${result.skipped} 项${result.errors.length?'；'+result.errors.length+' 项读取失败':''}`,`Scanned ${result.files.length} documents; skipped ${result.skipped}; unreadable ${result.errors.length}`);
 }finally{fileDropPending=false;}})();
},true);
$('prompt').addEventListener('paste',e=>{const file=[...e.clipboardData?.files||[]].find(isImageFile);if(file){e.preventDefault();guard(()=>stageImage(file))();}});
function sourceFromTransfer(transfer){const text=transfer.getData('text/plain').trim();if(!text)return null;const same=readerDrag&&transfer.getData('application/x-folio-selection')===readerDrag.token&&readerDrag.source.text===text&&readerDrag.source.id===current.id;return same?{...readerDrag.source}:{text:text.slice(0,16000),name:ui('拖入的文字','Dropped text'),id:null,external:true};}
$('chatForm').onsubmit=e=>{e.preventDefault();if(requestController)return;const {text,outputMode}=composer.take();if(!text&&!draftSource&&!outputMode)return;const source=draftSource||quote?{...(draftSource||quote),builtin:false}:conversations.current&&(!documentReady||conversations.current.source.id===current.id)?{...conversations.current.source,builtin:false}:{text:'',name:current.name,id:current.id,documentId:current.documentId,revision:current.revision,page};if(!text&&!source.text&&!source.regionId)return;const followup=!draftSource&&Boolean(conversations.current);draftSource=null;$('prompt').value='';composer.reset();visualizeSelection(source,true,{followup,question:text||ui('请解释这段原文。','Explain this passage.'),outputMode});};
$('stopButton').onclick=()=>{requestController?.abort();requestController=null;setBusy(false);$('visualStage').querySelectorAll('.visual-loading').forEach(e=>e.remove());$('visualStage').append(node('p',ui('已停止生成。','Generation stopped.'),{className:'muted'}));};
$('newChat').onclick=()=>{endConversation();$('prompt').focus();};

// Capture an already-selected passage so dragging is consistent across HTML and PDF text layers.
let passageDrag=null;
$('documentContent').addEventListener('pointerdown',e=>{
 const selection=getSelection();if(e.defaultPrevented||e.button!==0||e.detail>1||e.target.closest('.pdf-selection-controls,.quick-paragraph')||!selection?.rangeCount||!selection.toString().trim())return;
 const range=selection.getRangeAt(0);if(!$('documentContent').contains(range.commonAncestorContainer))return;
 if(![...range.getClientRects()].some(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom))return;
 e.preventDefault();passageDrag={x:e.clientX,y:e.clientY,moved:false,source:{...(selected||readingSource()),text:selection.toString().trim().slice(0,16000)}};
 $('documentContent').setPointerCapture(e.pointerId);
});
$('documentContent').addEventListener('pointermove',e=>{
 if(!passageDrag)return;if(Math.hypot(e.clientX-passageDrag.x,e.clientY-passageDrag.y)>8)passageDrag.moved=true;
 if(passageDrag.moved){const composing=composer.containsPoint(e.clientX,e.clientY);composer.hover(composing);$('learning').classList.toggle('drag-over',!composing);document.body.style.cursor='grabbing';}
});
$('documentContent').addEventListener('pointerup',e=>{
 if(!passageDrag)return;const drag=passageDrag;passageDrag=null;$('learning').classList.remove('drag-over');document.body.style.cursor='';
 const composing=composer.containsPoint(e.clientX,e.clientY);composer.hover(false);const r=$('learning').getBoundingClientRect();if(drag.moved&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){getSelection()?.removeAllRanges();if(composing)stageSource(drag.source);else{dropFeedback($('learning'),e);visualizeSelection(drag.source);}}else if(!drag.moved)getSelection()?.removeAllRanges();
});
$('documentContent').addEventListener('pointercancel',()=>{passageDrag=null;composer.hover(false);$('learning').classList.remove('drag-over');document.body.style.cursor='';});
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
new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width<100||width===lastReaderWidth)return;lastReaderWidth=width;clearTimeout(pdfResizeTimer);if(pdf&&!$('readingWorkspace').hidden)pdfResizeTimer=setTimeout(()=>{if(pdf&&!$('readingWorkspace').hidden)guard(renderPage)();},180);}).observe($('readerViewport'));
$('divider').addEventListener('pointercancel',()=>{resize=false;document.body.classList.remove('resize-active');});

function setAICollapsed(collapsed){if(collapsed)setCanvasFocus(false);document.body.classList.toggle('ai-collapsed',collapsed);$('toggleAI').setAttribute('aria-expanded',String(!collapsed));$('toggleAI').setAttribute('aria-label',collapsed?'展开 AI 辅助':'收起 AI 辅助');$('toggleAI').title=collapsed?'展开 AI 辅助':'收起 AI 辅助';saveLocal('folio-ai-collapsed',collapsed);}
$('toggleAI').onclick=()=>setAICollapsed(!document.body.classList.contains('ai-collapsed'));
setAICollapsed(readLocal('folio-ai-collapsed',false));
const annotations=setupAnnotations({getDocument:()=>current,getPage:()=>page,getMode:()=> 'original',goPage:changePage,read:readLocal,save:saveLocal,addNote,visualize:visualizeSelection,toast});

setupShell({exportAllNotes:guard(()=>exportNotesMarkdown(notes,id=>workspace.get('regions',id),{bundle:true})),selection:()=>selected?.text,fit:()=>{zoom=1;guard(renderPage)();},closeDocument,hasDocument:()=>!$('readerTabGroup').hidden});
window.addEventListener('folio-language',()=>{updateModel();updateMemoryUI();updateFolderUI();renderLibrary();renderNotes();});

function closeDocument(){
 pdfOCR?.destroy();pdfOCR=null;navigation.stop();
 readerView?.destroy();readerView=null;
 selectionControls?.destroy();selectionControls=null;
 if($('readerTabGroup').hidden)return;
 // Invalidate loading/rendering work before releasing this document.
 openToken++;renderToken++;documentReady=false;documentIndex=null;
 const previous=pdf;pdf=null;textPages=[];pageText='';
 showLibrary();current={id:'',name:'',kind:'file'};renderNotes();$('readerTabGroup').hidden=true;$('documentContent').replaceChildren();
 previous?.loadingTask.destroy().catch(()=>{});
 $('libraryButton').focus();
}

window.addEventListener('folio-feature',e=>{const action={navigation:()=>navigation.open(),ocr:()=>navigation.recognize()}[e.detail];if(action)guard(action)();});

function readingSource(number=page){return {id:current.id,documentId:current.documentId,revision:current.revision,name:current.name,page:number,view:'original'};}
async function openOriginalSource(source){await openSource(source);}
function acceptBlockSelection(source){selected=source;showSelectionDock();}
function clearSelectionDock(){selected=null;document.querySelector('.selection-dock')?.remove();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.selection-dock')&&!document.querySelector('dialog[open]')){getSelection()?.removeAllRanges();clearSelectionDock();}});
function showSelectionDock(){if(!selected?.text&&!selected?.image)return;let dock=document.querySelector('.selection-dock');if(dock)return;dock=node('div',undefined,{className:'selection-dock'});dock.onmousedown=e=>e.preventDefault();for(const [zh,en,kind]of [['解释','Explain','explain'],['分步','Steps','steps'],['可视化','Visualize','visual'],['记笔记','Add note','note']])dock.append(button(ui(zh,en),()=>selected&&reviewSelection({...selected},kind)));$('readerViewport').append(dock);}
async function persistSelection(source){if(!source.image)return source;const id=crypto.randomUUID(),{image,...safe}=source;await workspace.put('regions',{id,source:safe,image});return {...safe,regionId:id};}
function reviewSelection(source,preferred){const token=openToken;getSelection()?.removeAllRanges();clearSelectionDock();return selectionReview(source,{preferred,isCurrent:()=>source.external||token===openToken,onSource:openOriginalSource,onNote:async q=>{const saved=await persistSelection(q);addNote(q.text,saved);dropFeedback($('learning'));},onSend:async(q,kind)=>{const saved=await persistSelection(q);if(!q.external&&token!==openToken)return;dropFeedback($('learning'));const request=kind==='steps'?ui('请根据原文分步推导并解释：','Explain step by step using the source: '):kind==='visual'?ui('请选择适合原文的交互可视化帮助理解：','Choose a suitable interactive visualization of the source: '):ui('请解释这段原文：','Explain this passage: ');await visualizeSelection(saved,true,{question:request+q.text});}});}
