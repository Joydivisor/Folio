import {mountNoteArtifact} from './note-artifact.js';
import {language} from './i18n.js';
import {noteRoute,noteTrail} from './conversations.js';
import {ui,node,button} from './workspace-ui.js';
import {noteTitle,noteBody} from './note-markdown.js';
import {renderNoteMarkdown,mountNoteEditor,exportNotesMarkdown} from './note-renderer.js';
import {documentKey,groupNotes,notesInScope,sourceEntry,sourceScopeRoute} from './library-organization.js';
export function setupNotebook({notes,entries,documents=()=>[],collections=()=>[],items:libraryItems=()=>[],onOpenSource,onRestoreArtifact,onChanged,onArtifactChanged=onChanged,renderMath,onMemoryChange,memoryEnabled,getRegion}){
 const displayTrail=note=>noteTrail(note).map((part,index)=>language()==='en'?(index===0?'Notes':index===2?part.replace(/^第 (\d+) 页$/,'Page $1'):part):part);
 const $=id=>document.getElementById(id);let selected=null,revision=0,scope={kind:'all'},disposePreview=()=>{};
 function render(){
  disposePreview();disposePreview=()=>{};
  const token=++revision;$('globalNoteCount').textContent=notes.length;$('autoRemember').checked=memoryEnabled();
  const docs=documents();if(scope.kind==='document'&&scope.id!=='unlinked')scope.id=documentKey({id:scope.id},docs)||scope.id;const allGroups=groupNotes(notes,entries(),docs),tree=$('noteSourceTree');tree.replaceChildren();
  for(const group of allGroups){const a=node('a',undefined,{href:sourceScopeRoute('document',group.key),className:'note-source-link'});a.dataset.noteSource=group.key;a.classList.toggle('active',scope.kind==='document'&&scope.id===group.key);const label=node('span',undefined,{className:'note-source-name'});label.append(node('span',group.key==='unlinked'?ui('未关联文献','Unlinked notes'):group.name));if(group.path&&allGroups.filter(g=>g.name===group.name).length>1)label.append(node('small',group.path));a.append(label,node('small',String(group.notes.length)));a.title=[group.name,group.path].filter(Boolean).join(' · ');tree.append(a);}
  tree.hidden=document.body.dataset.view!=='library'||!location.hash.startsWith('#/notes');
  const scoped=notesInScope(notes,scope,collections(),docs,libraryItems()),q=$('notesSearch').value.toLowerCase(),items=scoped.filter(n=>(displayTrail(n).join(' ')+n.text+(n.turns||[]).map(t=>t.question).join(' ')).toLowerCase().includes(q));
  const groupName=scope.id==='unlinked'?ui('未关联文献','Unlinked notes'):allGroups.find(g=>g.key===scope.id)?.name||docs.find(d=>d.id===scope.id)?.name||ui('此文献','This document');
  $('notebookScope').textContent=scope.kind==='document'?groupName:scope.kind==='item'?libraryItems().find(i=>i.id===scope.id)?.title||ui('此文献','This document'):scope.kind==='collection'?collections().find(c=>c.id===scope.id)?.name||ui('分类已删除','Collection removed'):ui('全部笔记','All notes');$('notebookScopeCount').textContent=String(items.length);
  $('allNotesLink').hidden=scope.kind==='all';$('exportNotebookScope').disabled=!items.length;$('exportNotebookScope').onclick=()=>exportNotesMarkdown(items,getRegion,{bundle:true});
  const list=$('notebookList');list.replaceChildren();
  for(const group of groupNotes(items,entries(),docs)){const heading=node('a',group.key==='unlinked'?ui('未关联文献','Unlinked notes'):group.name,{href:sourceScopeRoute('document',group.key),className:'notebook-group-title'});heading.append(node('small',String(group.notes.length)));list.append(heading);for(const note of group.notes){const a=node('a',undefined,{href:noteRoute(note),className:'notebook-item'+(selected===note.id?' active':'')});a.dataset.noteId=note.id;a.append(node('strong',noteTitle(note)),node('span',displayTrail(note).slice(1,-1).join(' / ')),node('small',note.date));list.append(a);}}
  if(!items.length)list.append(node('p',q?ui('没有匹配的笔记。','No matching notes.'):ui('还没有笔记。','No notes yet.'),{className:'empty-state'}));
  const detail=$('notebookDetail');detail.replaceChildren();const note=items.find(n=>n.id===selected);
  if(!note){detail.append(node('p',ui('选择一条笔记','Select a note'),{className:'empty-state'}));return;}
  const breadcrumb=node('nav',undefined,{className:'note-breadcrumb'});breadcrumb.setAttribute('aria-label',ui('笔记来源路径','Note source'));breadcrumb.append(node('a',ui('全部笔记','All notes'),{href:'#/notes'}),node('span',' / '),node('a',note.source?.name||ui('未关联文献','Unlinked notes'),{href:sourceScopeRoute('document',documentKey(note.source,docs)||'unlinked')}));if(Number.isInteger(note.source?.page))breadcrumb.append(node('span',' / '+ui('第 '+note.source.page+' 页','Page '+note.source.page)));
  const title=node('h2',noteTitle(note)),meta=node('p',note.date,{className:'note-date'}),actions=node('div',undefined,{className:'notebook-actions'}),content=node('div',undefined,{className:'notebook-prose'});
  if(['permutation-state','folio-artifact'].includes(note.artifact?.kind)&&onRestoreArtifact)actions.append(button(ui('恢复交互','Restore interaction'),()=>onRestoreArtifact(note)));
  if(note.source?.id||note.source?.documentId){const exists=sourceEntry(note.source,entries(),docs);actions.append(button(exists?ui('原文 ↗','Source ↗'):ui('重新连接原文','Reconnect source'),()=>onOpenSource(note)));}
  actions.append(button(ui('导出 Markdown','Export Markdown'),()=>exportNotesMarkdown([note],getRegion)),button(ui('编辑','Edit'),()=>{disposePreview();detail.replaceChildren(breadcrumb);mountNoteEditor(detail,note,{renderMath,onCancel:render,onSave:changes=>{Object.assign(note,changes);onChanged();render();}});}),button(ui('删除','Delete'),()=>{const index=notes.findIndex(n=>n.id===note.id);if(index<0)return;notes.splice(index,1);onChanged();render();}));
  detail.append(breadcrumb,title,meta,actions,content);renderNoteMarkdown(content,noteBody(note),renderMath);disposePreview=mountNoteArtifact(detail,note,{renderMath,onChanged:onArtifactChanged,open:true});
  if(note.source?.regionId&&getRegion)getRegion(note.source.regionId).then(region=>{if(region&&token===revision){const figure=node('figure',undefined,{className:'note-source-figure'});figure.append(node('img',undefined,{src:region.image,alt:ui('原文选区','Source region')}));content.after(figure);}}).catch(()=>{});
  if(note.source?.text){const quote=node('details'),text=node('div',undefined,{className:'notebook-prose'});quote.append(node('summary',ui('引用原文','Source excerpt')),text);renderNoteMarkdown(text,note.source.text,renderMath);detail.append(quote);}
  if(note.turns?.length){const turns=node('details');turns.append(node('summary',ui('完整对话','Conversation')+' · '+note.turns.length));for(const [i,t]of note.turns.entries()){const section=node('section'),text=node('div',undefined,{className:'notebook-prose'});section.append(node('h3',(i+1)+'. '+t.question),text);renderNoteMarkdown(text,t.answer.paragraphs.map(p=>p.text+(p.sources?.length?'\n\n'+p.sources.map(s=>'> '+ui('第 '+s.page+' 页','Page '+s.page)+': '+s.quote.replace(/\n/g,'\n> ')).join('\n'):'')).join('\n\n'),renderMath);turns.append(section);}detail.append(turns);}
 }
 $('notesSearch').oninput=render;$('autoRemember').onchange=e=>{onMemoryChange(e.target.checked);render();};
 return {render,select(id){selected=id;const note=notes.find(n=>n.id===id);scope=note?{kind:'document',id:documentKey(note.source,documents())||'unlinked'}:{kind:'all'};$('notesSearch').value='';render();},scope(kind,id){scope={kind,id};selected=null;$('notesSearch').value='';render();}};
}
