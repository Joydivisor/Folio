import {language,t} from './i18n.js';
import {noteRoute,noteTrail} from './conversations.js';
export function setupNotebook({notes,entries,onOpenSource,onChanged,renderMath,onMemoryChange,memoryEnabled}){
 const displayTrail=note=>noteTrail(note).map((part,index)=>language()==='en'?(index===0?'Notes':index===2?part.replace(/^第 (\d+) 页$/,'Page $1'):part):part);
 const $=id=>document.getElementById(id);let selected=null;
 const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;return b;};
 function render(){
  $('globalNoteCount').textContent=notes.length;$('autoRemember').checked=memoryEnabled();
  const q=$('notesSearch').value.toLowerCase(),items=notes.filter(n=>(displayTrail(n).join(' ')+n.text+(n.turns||[]).map(t=>t.question).join(' ')).toLowerCase().includes(q));
  const list=$('notebookList');list.replaceChildren();
  for(const note of items){const b=document.createElement('a');b.href=noteRoute(note);b.className='notebook-item'+(selected===note.id?' active':'');const title=document.createElement('strong');title.textContent=note.title||note.text.split('\n')[0].slice(0,80);const trail=document.createElement('span');trail.textContent=displayTrail(note).slice(1,-1).join(' / ');const meta=document.createElement('small');meta.textContent=(language()==='en'?(note.kind==='conversation'?'Conversation · ':'Note · '):(note.kind==='conversation'?'对话整理 · ':'笔记 · '))+note.date;b.append(title,trail,meta);list.append(b);}
  if(!items.length){const p=document.createElement('p');p.className='empty-state';p.textContent=q?'没有匹配的笔记。':'还没有笔记。可以手动保存解读，或开启自动整理。';list.append(p);}
  const detail=$('notebookDetail');detail.replaceChildren();const note=notes.find(n=>n.id===selected);
  if(!note){const p=document.createElement('p');p.className='empty-state';p.textContent=selected?'这条笔记已不存在，其他笔记仍可查看。':'选择一条笔记，查看问题、原文与对话。';detail.append(p);return;}
  const breadcrumb=document.createElement('nav');breadcrumb.className='note-breadcrumb';breadcrumb.setAttribute('aria-label','笔记来源路径');breadcrumb.textContent=displayTrail(note).join(' / ');
  const title=document.createElement('h2');title.textContent=note.title||'阅读笔记';
  const meta=document.createElement('p');meta.className='muted';meta.textContent=note.date+(note.kind==='conversation'?(language()==='en'?' · Local note · '+note.turns.length+' turns':' · 本机整理 · '+note.turns.length+' 轮对话'):'');
  const actions=document.createElement('div');actions.className='notebook-actions';
  if(note.source?.id){const exists=entries().some(e=>e.id===note.source.id);actions.append(button(exists?'打开原文':'重新连接原文',()=>onOpenSource(note)));}
  actions.append(button('导出这条笔记',()=>download(note)),button('编辑笔记',()=>{content.hidden=true;const input=document.createElement('textarea');input.className='note-editor';input.value=note.text;const save=button('保存修改',()=>{note.text=input.value;onChanged();render();});detail.append(input,save);input.focus();}),button('删除笔记',()=>{const index=notes.findIndex(n=>n.id===note.id);if(index<0)return;notes.splice(index,1);onChanged();render();}));
  const content=document.createElement('div');content.className='notebook-prose';content.textContent=note.text;
  detail.append(breadcrumb,title,meta,actions,content);renderMath(content);
  if(note.source?.text){const quote=document.createElement('details');const summary=document.createElement('summary');summary.textContent='引用原文';const p=document.createElement('p');p.textContent=note.source.text;quote.append(summary,p);detail.append(quote);}
  if(note.artifact){const artifact=document.createElement('details');const summary=document.createElement('summary');summary.textContent='可视化记录';const pre=document.createElement('pre');const a=note.artifact;pre.textContent=a.nodes?a.nodes.map(n=>n.label+'：'+n.detail).join('\n\n')+'\n\n'+a.edges.map(e=>a.nodes.find(n=>n.id===e.from)?.label+' → '+a.nodes.find(n=>n.id===e.to)?.label+'：'+e.label).join('\n'):JSON.stringify(a,null,2);artifact.append(summary,pre);detail.append(artifact);}
  if(note.turns?.length){const turns=document.createElement('details');const summary=document.createElement('summary');summary.textContent=(language()==='en'?'Full conversation · '+note.turns.length+' turns':'完整对话 · '+note.turns.length+' 轮');turns.append(summary);for(const [i,t]of note.turns.entries()){const section=document.createElement('section'),h=document.createElement('h3');h.textContent=(i+1)+'. '+t.question;section.append(h);for(const p of t.answer.paragraphs){const el=document.createElement('p');el.textContent=p.text;section.append(el);if(p.sources?.length){const cite=document.createElement('small');cite.textContent=p.sources.map(s=>'第 '+s.page+' 页：'+s.quote).join('\n');section.append(cite);}}turns.append(section);renderMath(section);}detail.append(turns);}
 }
 function download(note){const text='# '+(note.title||'Folio 笔记')+'\n\n'+displayTrail(note).join(' / ')+'\n\n'+note.text+(note.turns?.length?'\n\n## 完整对话\n'+note.turns.map(t=>'### '+t.question+'\n\n'+t.answer.paragraphs.map(p=>p.text+(p.sources?.length?'\n'+p.sources.map(s=>'第 '+s.page+' 页：'+s.quote).join('\n'):'')).join('\n\n')).join('\n\n'):'');const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Folio-笔记.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 $('notesSearch').oninput=render;$('autoRemember').onchange=e=>{onMemoryChange(e.target.checked);render();};
 return {render,select(id){selected=id;render();}};
}
