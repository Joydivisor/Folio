import {ui,node,button,modal} from './workspace-ui.js';
import {collectionColors,inCollection,setMembership,sourceScopeRoute,descendants,collectionPath,libraryRows} from './library-organization.js';
export function setupCollections({collections,entries,documents,items=()=>[],onSave,onSelect,getFilter}){
 const $=id=>document.getElementById(id);
 const collapsed=new Set();
 function edit(collection,parentId=null){
  const {root,body}=modal(collection?ui('编辑分类','Edit collection'):ui('新建分类','New collection'));root.classList.add('collection-dialog');
  const name=node('input',undefined,{value:collection?.name||'',maxLength:120,placeholder:ui('例如：代数、蛋白质研究','e.g. Algebra, Protein research')});name.setAttribute('aria-label',ui('分类名称','Collection name'));name.dataset.collectionName='';
  const colors=node('div',undefined,{className:'collection-colors'});let color=collection?.color||collectionColors[collections.length%collectionColors.length];
  function paint(){colors.replaceChildren();for(const c of collectionColors){const b=button('',()=>{color=c;paint();});b.style.setProperty('--dot',c);b.setAttribute('aria-label',c);b.setAttribute('aria-pressed',String(color===c));colors.append(b);}}paint();
  const parent=node('select');parent.dataset.collectionParent='';parent.setAttribute('aria-label',ui('上级分类','Parent collection'));parent.append(node('option',ui('无上级分类','No parent collection'),{value:''}));const excluded=collection?descendants(collection.id,collections):new Set();for(const c of collections.filter(c=>!excluded.has(c.id)))parent.append(node('option',collectionPath(c.id,collections),{value:c.id}));parent.value=collection?.parentId||parentId||'';
  const error=node('p','',{role:'alert'}),actions=node('div',undefined,{className:'collection-actions'});
  const save=button(ui('保存','Save'),()=>{const text=name.value.trim();if(!text){error.textContent=ui('请输入分类名称。','Enter a collection name.');return;}if(collections.some(c=>c!==collection&&(c.parentId||'')===parent.value&&c.name.toLocaleLowerCase()===text.toLocaleLowerCase())){error.textContent=ui('已有同名分类。','A collection with this name already exists.');return;}if(!collection&&collections.length>=500){error.textContent=ui('分类数量已达上限。','Collection limit reached.');return;}if(collection)Object.assign(collection,{name:text,color,parentId:parent.value||null});else collections.push({id:crypto.randomUUID(),name:text,color,parentId:parent.value||null,members:[]});onSave();root.close();});save.dataset.saveCollection='';actions.append(button(ui('取消','Cancel'),()=>root.close()),save);
  if(collection)actions.prepend(button(ui('删除分类','Delete collection'),()=>{const {root:confirm,body:b}=modal(ui('删除此分类？','Delete this collection?'));b.append(node('p',ui('保留文献和笔记，子分类会移至上一级。','Documents and notes are kept. Subcollections move up one level.')),button(ui('取消','Cancel'),()=>confirm.close()),button(ui('删除分类','Delete collection'),()=>{for(const c of collections)if(c.parentId===collection.id)c.parentId=collection.parentId||null;collections.splice(collections.indexOf(collection),1);onSave();if(getFilter()==='collection:'+collection.id)onSelect('all');if(location.hash===sourceScopeRoute('collection',collection.id))location.hash='/notes';confirm.close();root.close();}));}));
  if(collection)actions.prepend(button(ui('新建子分类','New subcollection'),()=>{root.close();edit(null,collection.id);}));body.append(name,parent,colors,error,actions);name.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save.click();}};name.focus();
 }
 function render(){
  const tree=$('collectionTree');tree.replaceChildren();
  function branch(parentId=null,depth=0){for(const c of collections.filter(c=>(c.parentId||null)===parentId)){
   const row=node('div',undefined,{className:'collection-row'});row.style.setProperty('--depth',depth);
   const children=collections.some(x=>x.parentId===c.id),toggle=button(collapsed.has(c.id)?'›':'⌄',()=>{collapsed.has(c.id)?collapsed.delete(c.id):collapsed.add(c.id);render();});toggle.className='collection-toggle';toggle.disabled=!children;toggle.setAttribute('aria-label',ui('展开或收起子分类','Expand or collapse subcollections'));toggle.setAttribute('aria-expanded',String(!collapsed.has(c.id)));
   const b=button('',()=>onSelect('collection:'+c.id)),dot=node('i',undefined,{className:'folder-dot'}),name=node('span',c.name,{className:'collection-name'}),count=node('span',String(libraryRows(entries().filter(e=>inCollection(e,c,documents(),items(),collections)),items(),documents()).length),{className:'nav-count'});
   b.className='collection-select';dot.style.setProperty('--dot',c.color);b.dataset.collection=c.id;b.classList.toggle('active',getFilter()==='collection:'+c.id);b.title=collectionPath(c.id,collections);b.append(dot,name,count);
   const more=button('···',()=>edit(c));more.className='collection-more';more.setAttribute('aria-label',ui('编辑分类 ','Edit collection ')+c.name);row.append(toggle,b,more);row.oncontextmenu=e=>{e.preventDefault();edit(c);};tree.append(row);if(!collapsed.has(c.id))branch(c.id,depth+1);
  }}branch();
 }
 function assign(entry){if(!entry)return;const {root,body}=modal(ui('加入分类','Add to collections'));root.classList.add('collection-dialog');body.append(node('p',entry.name));const choices=new Map();for(const c of collections){const check=node('input',undefined,{type:'checkbox',checked:inCollection(entry,c,documents(),items())}),label=node('label',undefined,{className:'collection-choice'});check.dataset.memberCollection=c.id;label.append(check,node('span',collectionPath(c.id,collections)));body.append(label);choices.set(c,check);}if(!collections.length)body.append(node('p',ui('先在左侧新建一个分类。','Create a collection in the sidebar first.')));body.append(button(ui('完成','Done'),()=>{for(const [c,check]of choices)setMembership(c,entry,check.checked,documents(),items());onSave();root.close();}));}
 $('newCollection').onclick=()=>edit();$('assignCollection').onclick=()=>assign(entries().find(e=>e.id===$('assignCollection').dataset.document));
 $('collectionNotes').onclick=()=>{const id=getFilter().slice('collection:'.length);location.hash=sourceScopeRoute('collection',id);};
 return {render};
}
