import MarkdownIt from '/note-vendor/markdown.js';
import {createNoteMarkdown,normalizeLatex,exportNoteMarkdown,noteTitle,noteBody,safeNoteFilename} from './note-markdown.js';
import {download,ui,node,button} from './workspace-ui.js';
import {language} from './i18n.js';
let parser;
export function mountNoteEditor(host,note,{renderMath,onSave,onCancel}){
 const wrap=node('section',undefined,{className:'note-edit-workspace'}),title=node('input',undefined,{value:noteTitle(note),className:'note-title-input'}),editor=node('textarea',undefined,{value:noteBody(note),className:'note-editor'}),preview=node('div',undefined,{className:'notebook-prose',hidden:true}),bar=node('div',undefined,{className:'note-edit-actions'});
 title.setAttribute('aria-label',ui('笔记标题','Note title'));editor.setAttribute('aria-label',ui('Markdown 正文','Markdown body'));editor.spellcheck=false;
 const toggle=button(ui('预览','Preview'),()=>{preview.hidden=!preview.hidden;editor.hidden=!preview.hidden;if(!preview.hidden)renderNoteMarkdown(preview,editor.value,renderMath);toggle.textContent=preview.hidden?ui('预览','Preview'):ui('编辑','Edit');});
 bar.append(toggle,button(ui('取消','Cancel'),onCancel),button(ui('保存修改','Save changes'),()=>onSave({title:title.value.trim()||noteTitle(note),text:normalizeLatex(editor.value),format:'markdown'})));
 wrap.append(title,bar,editor,preview);host.append(wrap);editor.focus();return wrap;
}
export function renderNoteMarkdown(host,text,renderMath=()=>{}){
 parser??=createNoteMarkdown(MarkdownIt);
 host.classList.add('notebook-prose');host.innerHTML=parser.render(normalizeLatex(text));
 for(const quote of host.querySelectorAll('blockquote')){
  const first=quote.firstElementChild,child=first?.firstChild;if(child?.nodeType!==3)continue;const match=child.textContent.match(/^\[!([a-z]+)\]([+-])?\s*([^\n]*)\n?/i);if(!match)continue;
  const kind=match[1].toLowerCase(),title=document.createElement('strong');title.className='note-callout-title';title.textContent=match[3]||kind;child.textContent=child.textContent.slice(match[0].length);quote.className='note-callout';quote.dataset.kind=['note','tip','warning','example','quote','cite','question','info'].includes(kind)?kind:'note';quote.prepend(title);if(!first.textContent.trim())first.remove();
 }
 for(const a of host.querySelectorAll('a')){a.target='_blank';a.rel='noopener noreferrer';const href=a.getAttribute('href')||'';if(!/^https?:\/\//i.test(href)){a.removeAttribute('href');a.removeAttribute('target');}}
 renderMath(host);
}
export async function exportNotesMarkdown(notes,getRegion,{bundle=false}={}){
 if(!notes.length)throw Error(ui('还没有可以导出的笔记。','There are no notes to export.'));
 const {zipSync,strToU8}=await import('/note-vendor/fflate.js'),files={},used=new Set();
 for(const [index,note]of notes.entries()){
  let name=safeNoteFilename(noteTitle(note)),base=name,n=1;while(used.has(name.toLowerCase()))name=base+'-'+(++n);used.add(name.toLowerCase());
  let attachment;
  if(note.source?.regionId&&getRegion){const region=await getRegion(note.source.regionId);if(!region?.image)throw Error(ui('选区附件缺失，请先恢复附件再导出。','The source image is missing. Restore it before exporting.'));const match=region.image.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);if(!match)throw Error('Invalid source attachment');attachment='attachments/region-'+(index+1)+'.png';files[attachment]=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));}
  const text=exportNoteMarkdown(note,{attachment,english:language()==='en'});files[name+'.md']=strToU8(text);
  if(notes.length===1&&!bundle&&!attachment){download(name+'.md',text,'text/markdown;charset=utf-8');return;}
 }
 download('Folio-notes.zip',new Blob([zipSync(files,{level:3})],{type:'application/zip'}));
}
