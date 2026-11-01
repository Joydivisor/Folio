import {ui,node,button,modal} from './workspace-ui.js';
import {renderNoteMarkdown,validateNoteMath} from './note-renderer.js';
import {originalStudyNote,requestStudyNote,parseStudyNote} from './study-note.js';
import {requestStructured} from './structured-response.js';
export function openStudyNote(record,{ask,answerLanguage,renderMath,onSave}){
 // This immutable snapshot keeps a late response attached to the correct book.
 record=structuredClone(record);
 const original=originalStudyNote(record.versions[record.cursor]),{root,body}=modal(ui('整理为学习笔记','Create a study note'));
 root.classList.add('study-note-dialog');
 const controller=new AbortController();root.addEventListener('close',()=>controller.abort());
 const title=node('input',undefined,{value:original.title}),editor=node('textarea',undefined,{value:original.markdown,hidden:true}),preview=node('div',undefined,{className:'notebook-prose'}),status=node('p','',{className:'study-note-status'}),actions=node('div',undefined,{className:'workspace-actions'});
 title.setAttribute('aria-label',ui('笔记标题','Note title'));editor.setAttribute('aria-label',ui('Markdown 正文','Markdown body'));status.setAttribute('role','status');
 const source=record.source||{};
 body.append(node('p',(source.name||ui('外部选段','External passage'))+(source.page?' · '+ui('第 '+source.page+' 页','Page '+source.page):''),{className:'study-note-source'}),title,status,preview,editor,actions);
 let busy=false,closed=false;
 root.addEventListener('close',()=>closed=true);
 const draw=()=>renderNoteMarkdown(preview,editor.value,renderMath);
 const edit=button(ui('编辑 Markdown','Edit Markdown'),()=>{editor.hidden=!editor.hidden;preview.hidden=!editor.hidden;if(editor.hidden)draw();edit.textContent=editor.hidden?ui('编辑 Markdown','Edit Markdown'):ui('预览','Preview');});
 const save=button(ui('保存笔记','Save note'),async()=>{if(busy)return;const value={title:title.value.trim(),text:editor.value.trim()};if(!value.title||!value.text)throw Error(ui('标题和正文不能为空。','A title and body are required.'));await validateNoteMath(value.text);if(!root.open)return;await onSave(value,record);root.close();});
 const restore=button(ui('保留原回答','Use original answer'),()=>{title.value=original.title;editor.value=original.markdown;status.textContent='';draw();});
 const organize=button(ui('重新整理','Organize again'),generate);
 const cancel=button(ui('取消','Cancel'),()=>root.close());
 actions.append(edit,restore,organize,cancel,save);save.classList.add('study-note-save');
 async function generate(){
  if(!ask||busy||closed)return;busy=true;[save,edit,restore,organize].forEach(b=>b.disabled=true);title.disabled=editor.disabled=true;status.textContent=ui('正在整理定义、公式与推导…','Organizing definitions, formulas and reasoning…');root.setAttribute('aria-busy','true');
  try{
   const draft=await requestStructured(messages=>ask(messages,controller.signal),requestStudyNote(record,answerLanguage),parseStudyNote,{signal:controller.signal});
   await validateNoteMath(draft.markdown);if(closed||!root.open)return;
   title.value=draft.title;editor.value=draft.markdown;draw();status.textContent='';
  }catch(error){if(!closed&&error.name!=='AbortError')status.textContent=ui('整理未完成，原回答已保留。','Could not organize the note. The original answer is retained. ')+error.message;}
  finally{busy=false;if(!closed){[save,edit,restore,organize].forEach(b=>b.disabled=false);title.disabled=editor.disabled=false;root.setAttribute('aria-busy','false');}}
 }
 draw();if(ask)generate();else{organize.hidden=true;status.textContent=ui('连接模型后可自动整理；现在可以编辑并保存原回答。','Connect a model to organize this note. You can edit and save the original answer now.');}
 return root;
}
