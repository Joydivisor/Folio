import {ui,node,button,modal} from './workspace-ui.js';
import {ensureItem,itemFor,documentKey,normalizeTags,attachDocument,sourceScopeRoute} from './library-organization.js';

export function setupLibraryItems({items,entries,documents,onSave,onImport,onOpen,notes}){
 function edit(entry){
  const saved=itemFor(entry,items,documents());
  // Work on a draft: dismissing the dialog cannot create or change an item.
  const draft=saved?structuredClone(saved):ensureItem(entry,[],documents());
  const {root,body}=modal(ui('文献资料','Document details'));root.classList.add('item-dialog');
  const fields=node('div',undefined,{className:'item-fields'}),inputs={};
  for(const [key,zh,en] of [['title','标题','Title'],['authors','作者','Authors'],['year','年份','Year'],['doi','DOI','DOI'],['tags','标签（用逗号分隔）','Tags (comma separated)']]){
   const input=node('input',undefined,{value:key==='tags'?draft.tags.join(', '):draft[key]||'',maxLength:key==='tags'?8100:1000});input.dataset.itemField=key;input.id='item-field-'+key;
   const label=node('label',ui(zh,en));label.htmlFor=input.id;fields.append(label,input);inputs[key]=input;
  }
  const status=node('select');status.dataset.itemStatus='';status.id='item-reading-status';for(const [value,zh,en]of [['unread','未读','Unread'],['reading','阅读中','Reading'],['read','已读','Read']])status.append(node('option',ui(zh,en),{value}));status.value=draft.readStatus||'unread';const statusLabel=node('label',ui('阅读状态','Reading status'));statusLabel.htmlFor=status.id;fields.append(statusLabel,status);
  const files=node('div',undefined,{className:'item-attachments'}),head=node('div',undefined,{className:'item-attachment-heading'}),list=node('div');
  head.append(node('strong',ui('附件','Attachments')));
  function paint(){list.replaceChildren();for(const key of draft.attachments){const entry=entries().find(e=>documentKey(e,documents())===documentKey({id:key},documents())),row=node('div',undefined,{className:'item-attachment-row'});
   const label=node('span',entry?.name||documents().find(d=>d.id===key)?.name||ui('未连接的附件','Disconnected attachment'));label.title=entry?.path||'';if(entry?.path&&draft.attachments.some(id=>id!==key&&entries().some(e=>documentKey(e,documents())===documentKey({id},documents())&&e.name===entry.name)))label.append(node('small',entry.path,{className:'document-tags'}));row.append(label);
   const primary=button(draft.primary===key?ui('主文件','Primary'):ui('设为主文件','Set primary'),()=>{draft.primary=key;paint();});primary.dataset.primaryAttachment=key;primary.disabled=draft.primary===key;row.append(primary);
   if(entry)row.append(button(ui('打开','Open'),()=>{root.close();onOpen(entry);}));
   if(draft.attachments.length>1){const detach=button(ui('独立列出','Detach'),()=>{draft.attachments=draft.attachments.filter(id=>id!==key);if(draft.primary===key)draft.primary=draft.attachments[0];paint();});detach.dataset.detachAttachment=key;detach.title=ui('移出此条目，文件和笔记保留','Detach from this item; keep the file and its notes');row.append(detach);}
   list.append(row);
  }}
  function chooseExisting(){const {root:picker,body:b}=modal(ui('添加已有文件','Add existing files'));picker.classList.add('item-dialog');const search=node('input',undefined,{type:'search',placeholder:ui('搜索文件','Search files')}),choices=node('div',undefined,{className:'attachment-choices'}),selected=new Set();b.append(search,choices);
   function render(){choices.replaceChildren();const available=entries().filter(e=>!draft.attachments.some(id=>documentKey({id},documents())===documentKey(e,documents()))&&!itemFor(e,items,documents())&&(e.name+' '+(e.path||'')).toLowerCase().includes(search.value.toLowerCase()));for(const e of available){const check=node('input',undefined,{type:'checkbox',checked:selected.has(e.id)});check.dataset.attachFile=e.id;check.onchange=()=>check.checked?selected.add(e.id):selected.delete(e.id);const label=node('label',undefined,{className:'collection-choice'});label.append(check,node('span',e.name+' · '+(e.path||ui('本地副本','Local copy'))));choices.append(label);}if(!available.length)choices.append(node('p',ui('没有可加入的独立文件。','No available standalone files.')));}search.oninput=render;render();
   const add=button(ui('添加','Add'),()=>{for(const id of selected){const e=entries().find(e=>e.id===id);if(e)attachDocument(draft,e,items.filter(i=>i.id!==draft.id),documents());}paint();picker.close();});add.dataset.addAttachments='';b.append(add);
  }
  const existing=button(ui('添加已有文件','Add existing files'),chooseExisting);existing.dataset.chooseAttachment='';
  const input=node('input',undefined,{type:'file',accept:'.pdf,.docx,.txt,.md,.markdown',multiple:true,hidden:true});input.dataset.importAttachments='';
  input.onchange=async()=>{try{const added=await onImport([...input.files]);for(const e of added)attachDocument(draft,e,items.filter(i=>i.id!==draft.id),documents());paint();}catch(error){errorBox.textContent=error.message;}finally{input.value='';}};
  head.append(existing,button(ui('导入附件','Import attachment'),()=>input.click()));files.append(head,list,input);paint();
  const errorBox=node('p','',{role:'alert'}),actions=node('div',undefined,{className:'item-actions'});
  if(saved)actions.append(button(ui('查看文献笔记','View document notes')+' ('+notes(saved).length+')',()=>{root.close();location.hash=sourceScopeRoute('item',saved.id);}));
  const save=button(ui('保存','Save'),()=>{const title=inputs.title.value.trim(),tags=normalizeTags(inputs.tags.value.split(/[,，;；\n]/));if(!title){errorBox.textContent=ui('请输入标题。','Enter a title.');return;}if(tags.length>100||tags.some(t=>t.length>80)){errorBox.textContent=ui('最多 100 个标签，每个不超过 80 字符。','Use up to 100 tags, each at most 80 characters.');return;}
   const next={...draft,title,tags,readStatus:status.value,authors:inputs.authors.value.trim(),year:inputs.year.value.trim(),doi:inputs.doi.value.trim()};
   for(const id of next.attachments){const owner=itemFor({id},items,documents());if(owner&&owner.id!==next.id)throw Error(ui('附件已属于其它文献，请重新打开资料。','An attachment now belongs to another item. Reopen details.'));}
   onSave(next);root.close();});save.dataset.saveItem='';actions.append(button(ui('取消','Cancel'),()=>root.close()),save);body.append(fields,files,errorBox,actions);
 }
 return {edit};
}
