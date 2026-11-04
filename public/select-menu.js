import {ui} from './workspace-ui.js';
import {t} from './i18n.js';

// Native values/events remain the source of truth, including in dynamic dialogs.
let initialized=false,nextId=0;
export function enhanceSelects() {
 if(initialized)return;initialized=true;
 const controls=new Map(),selector='select:not([data-native]):not([multiple])';
 function enhance(select){
  if(controls.has(select)||!select.isConnected)return;
  const trigger=document.createElement('button'),label=document.createElement('span'),menu=document.createElement('div');
  const id=select.id||`folio-select-${++nextId}`;
  select.id||=id;
  trigger.type='button';trigger.className='select-trigger';trigger.dataset.selectFor=id;
  label.className='select-value';trigger.append(label);
  trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  menu.className='select-menu';menu.popover='auto';menu.id=id+'-menu';menu.setAttribute('role','listbox');
  trigger.setAttribute('aria-controls',menu.id);
  select.hidden=true;select.after(trigger);(select.closest('dialog')||document.body).append(menu);
  const isOpen=()=>menu.isConnected&&menu.matches(':popover-open');
  function close(restore=false){if(isOpen())menu.hidePopover();if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});}
  function sync(){
   const title=select.getAttribute('aria-label')||[...(select.labels?.[0]?.childNodes||[])].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||ui('选择','Choose');
   const value=select.selectedOptions[0]?.textContent||ui('请选择','Choose an option');
   if(label.textContent!==value)label.textContent=value;
   trigger.disabled=select.disabled;trigger.setAttribute('aria-label',title+': '+value);menu.setAttribute('aria-label',title);
   if(isOpen())for(const item of menu.querySelectorAll('[role=option]'))item.setAttribute('aria-selected',String(Number(item.dataset.index)===select.selectedIndex));
  }
  function choose(index){
   const option=select.options[index];if(!option||option.disabled||option.parentElement.disabled)return;
   const changed=select.selectedIndex!==index;select.selectedIndex=index;sync();close(true);
   if(changed){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  function open(){
   if(trigger.disabled||isOpen())return;sync();menu.replaceChildren();
   const heading=document.createElement('div');heading.className='select-menu-heading';heading.setAttribute('aria-hidden','true');heading.textContent=menu.getAttribute('aria-label');menu.append(heading);
   [...select.options].forEach((option,index)=>{
    const item=document.createElement('button'),copy=document.createElement('span'),title=document.createElement('span');
    item.type='button';item.className='select-option';item.tabIndex=-1;item.disabled=option.disabled||Boolean(option.parentElement.disabled);item.dataset.index=String(index);
    item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));
    copy.className='select-option-copy';title.className='select-option-title';title.textContent=option.textContent;copy.append(title);
    if(option.dataset.description){const detail=document.createElement('span');detail.className='select-option-description';detail.textContent=t(option.dataset.description);copy.append(detail);}
    item.append(copy);item.onclick=()=>choose(index);menu.append(item);
   });
   menu.showPopover();const rect=trigger.getBoundingClientRect();
   menu.style.minWidth=Math.min(innerWidth-16,Math.max(select.id==='readingModeSelect'?248:200,rect.width))+'px';
   menu.style.maxWidth='calc(100vw - 16px)';menu.style.maxHeight=Math.min(360,innerHeight-24)+'px';
   menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,rect.left))+'px';
   menu.style.top=(rect.bottom+menu.offsetHeight+12<innerHeight?rect.bottom+8:Math.max(8,rect.top-menu.offsetHeight-8))+'px';
   const selected=menu.querySelector('[aria-selected=true]:not(:disabled)')||menu.querySelector('button:not(:disabled)');
   selected?.focus({preventScroll:true});selected?.scrollIntoView({block:'nearest'});
  }
  let search='',searchTimer;
  trigger.onclick=()=>isOpen()?close(true):open();
  trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}};
  menu.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(isOpen())));
  menu.onkeydown=e=>{
   const options=[...menu.querySelectorAll('button:not(:disabled)')],index=options.indexOf(document.activeElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
    e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options[next]?.focus({preventScroll:true});options[next]?.scrollIntoView({block:'nearest'});
   }else if(e.key==='Enter'||e.key===' '){const option=document.activeElement.closest('[role=option]');if(option&&menu.contains(option)){e.preventDefault();choose(Number(option.dataset.index));}}
   else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}
   else if(e.key==='Tab')close(true);
   else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key!==' '){
    e.preventDefault();clearTimeout(searchTimer);search+=e.key.toLocaleLowerCase();searchTimer=setTimeout(()=>search='',600);
    const ordered=[...options.slice(index+1),...options.slice(0,index+1)];ordered.find(b=>b.querySelector('.select-option-title').textContent.toLocaleLowerCase().startsWith(search))?.focus();
   }
  };
  const observer=new MutationObserver(()=>{sync();if(isOpen())close();});observer.observe(select,{childList:true,subtree:true,attributes:true,characterData:true});
  select.addEventListener('change',sync);select.addEventListener('input',sync);
  controls.set(select,{sync,close,menu,dispose(){observer.disconnect();clearTimeout(searchTimer);select.removeEventListener('change',sync);select.removeEventListener('input',sync);close();trigger.remove();menu.remove();}});sync();
 }
 function scan(root){if(root.nodeType!==1&&root!==document)return;if(root.matches?.(selector))enhance(root);root.querySelectorAll(selector).forEach(enhance);}
 scan(document);
 new MutationObserver(records=>{
  for(const record of records)for(const added of record.addedNodes)scan(added);
  for(const [select,control] of controls)if(!select.isConnected){control.dispose();controls.delete(select);}
 }).observe(document.body,{childList:true,subtree:true});
 const syncAll=()=>controls.forEach(control=>control.sync());
 document.addEventListener('click',()=>queueMicrotask(syncAll));
 window.addEventListener('folio-language',()=>queueMicrotask(syncAll));
 window.addEventListener('resize',()=>controls.forEach(control=>control.close()));
 document.addEventListener('scroll',event=>controls.forEach(control=>{if(!control.menu.contains(event.target))control.close();}),true);
}
