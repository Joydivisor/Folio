// Keep native select values/events, render the popup in the app's visual language.
export function enhanceSelects() {
  const syncers=[];
  for (const select of document.querySelectorAll('select:not([data-native])')) {
    const trigger=document.createElement('button');
    trigger.type='button';trigger.className='select-trigger';
    trigger.setAttribute('aria-label',select.getAttribute('aria-label')||'选择');
    trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');menu.className='select-menu';menu.popover='auto';menu.id=select.id+'-menu';
    menu.setAttribute('role','listbox');menu.setAttribute('aria-label',trigger.getAttribute('aria-label'));
    trigger.setAttribute('aria-controls',menu.id);
    select.hidden=true;select.after(trigger);(select.closest('dialog')||document.body).append(menu);
    const sync=()=>{trigger.textContent=select.selectedOptions[0]?.textContent||'选择';trigger.disabled=select.disabled;};
    syncers.push(sync);sync();new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true});
    select.addEventListener('change',sync);
    window.addEventListener('folio-language',()=>queueMicrotask(sync));
    const close=()=>{menu.hidePopover();trigger.focus();};
    const open=()=>{
      menu.replaceChildren();
      for(const option of select.options){
        const button=document.createElement('button');button.type='button';button.tabIndex=-1;button.disabled=option.disabled;
        button.textContent=option.textContent;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.selected));
        button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close();};
        menu.append(button);
      }
      menu.showPopover();const r=trigger.getBoundingClientRect();
      menu.style.minWidth=Math.max(160,r.width)+'px';
      menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,r.right-menu.offsetWidth))+'px';
      menu.style.top=(r.bottom+menu.offsetHeight+8<innerHeight?r.bottom+6:Math.max(8,r.top-menu.offsetHeight-6))+'px';
      (menu.querySelector('[aria-selected="true"]')||menu.querySelector('button'))?.focus();
    };
    trigger.onclick=()=>menu.matches(':popover-open')?close():open();
    trigger.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open();}};
    menu.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
    menu.onkeydown=e=>{
      const options=[...menu.querySelectorAll('button:not(:disabled)')];let index=options.indexOf(document.activeElement);
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();index=e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[index]?.focus();}
      if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab')close();
    };
    window.addEventListener('resize',()=>{if(menu.matches(':popover-open'))menu.hidePopover();});
  }
  document.addEventListener('click',()=>queueMicrotask(()=>syncers.forEach(sync=>sync())));
}
