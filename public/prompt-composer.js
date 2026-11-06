import {ui} from './workspace-ui.js';
import {icon} from './icons.js';
import {commandMatches,slashQuery,outputCommand,parseOutputCommand} from './output-commands.js';

export function setupPromptComposer({wrap,input,form,onDropSource,sourceFromTransfer}){
 let mode=null,query=null,matches=[],active=0,dismissed=false,buttonMenu=false;
 const menu=document.createElement('div'),list=document.createElement('div'),heading=document.createElement('div'),chip=document.createElement('button'),hint=document.createElement('div'),shortcut=document.createElement('button');
 menu.id='outputCommands';menu.className='output-commands';menu.hidden=true;
 heading.className='output-command-heading';heading.textContent=ui('输出方式','Output format');list.className='output-command-list';list.id='outputCommandList';list.setAttribute('role','listbox');list.setAttribute('aria-label',heading.textContent);menu.append(heading,list);
 chip.type='button';chip.className='output-command-chip';chip.hidden=true;chip.onclick=()=>{setMode(null);input.focus();};
 hint.className='composer-drop-hint';hint.textContent=ui('松开加入引用，补充要求后发送','Drop to quote, then add your question');hint.setAttribute('aria-live','polite');hint.hidden=true;
 shortcut.type='button';shortcut.className='output-command-button';shortcut.innerHTML=icon('plus');shortcut.title=ui('输出方式（/）','Output format (/)');shortcut.setAttribute('aria-label',shortcut.title);shortcut.setAttribute('aria-haspopup','listbox');shortcut.setAttribute('aria-controls',list.id);
 // Button navigation never inserts characters into the draft.
 shortcut.onmousedown=e=>e.preventDefault();shortcut.onclick=()=>{if(!menu.hidden){close();input.focus();return;}buttonMenu=true;dismissed=false;query=null;matches=commandMatches();active=0;input.focus();render();};
 form.prepend(shortcut,menu,chip,hint);
 input.setAttribute('aria-controls',list.id);input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
 function size(){input.style.height='0px';const height=Math.min(144,Math.max(24,input.scrollHeight));input.style.height=height+'px';form.classList.toggle('composer-multiline',height>32);}
 function close(){menu.hidden=true;buttonMenu=false;input.setAttribute('aria-expanded','false');shortcut.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
 function setMode(id){mode=outputCommand(id)?.id||null;chip.hidden=!mode;form.classList.toggle('has-output-mode',!!mode);chip.textContent=mode?ui(...outputCommand(mode).label)+' ×':'';chip.setAttribute('aria-label',ui('移除输出方式','Remove output choice'));}
 function choose(command){if(query)input.setRangeText('',query.start,query.end,'end');setMode(command.id);close();input.focus();size();}
 function highlight(){
  for(const [i,row]of [...list.children].entries())row.setAttribute('aria-selected',String(i===active));
  const row=list.children[active];if(!row||!matches.length){input.removeAttribute('aria-activedescendant');return;}
  input.setAttribute('aria-activedescendant',row.id);
  // Scroll only the menu, never the surrounding reading pane.
  const top=row.offsetTop;if(top<list.scrollTop)list.scrollTop=top;else if(top+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=top+row.offsetHeight-list.clientHeight;
 }
 function render(){
  list.replaceChildren();menu.hidden=false;input.setAttribute('aria-expanded','true');shortcut.setAttribute('aria-expanded','true');
  if(!matches.length){const empty=document.createElement('p');empty.textContent=ui('没有匹配的功能','No matching output');list.append(empty);input.removeAttribute('aria-activedescendant');return;}
  matches.forEach(c=>{const row=document.createElement('button');row.type='button';row.id='output-command-'+c.id;row.setAttribute('role','option');row.dataset.command=c.id;
   const title=document.createElement('strong'),detail=document.createElement('span'),key=document.createElement('kbd');title.textContent=ui(...c.label);detail.textContent=ui(...c.description);key.textContent='/'+c.id;row.append(title,key,detail);row.onmousedown=e=>e.preventDefault();row.onclick=()=>choose(c);list.append(row);
  });highlight();
 }
 function refresh(){size();query=slashQuery(input.value,input.selectionStart);if(!query||dismissed){if(!buttonMenu)close();return;}buttonMenu=false;matches=commandMatches(query.query);active=0;render();}
 input.addEventListener('input',()=>{dismissed=false;buttonMenu=false;refresh();});input.addEventListener('click',()=>{if(!buttonMenu)refresh();});
 // Delayed blur dismissal used to close the menu in the middle of a click.
 document.addEventListener('pointerdown',e=>{if(!form.contains(e.target))close();},true);
 input.addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return;
  if(!menu.hidden){
   if(['ArrowDown','ArrowUp'].includes(e.key)&&matches.length){e.preventDefault();e.stopImmediatePropagation();active=(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;highlight();return;}
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dismissed=true;close();return;}
   if((e.key==='Enter'&&!e.shiftKey)||e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();if(matches[active])choose(matches[active]);return;}
  }
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}
 },true);
 function hover(value){wrap.classList.toggle('composer-drag-over',value);hint.hidden=!value;if(value)close();}
 const textDrag=e=>!Array.from(e.dataTransfer?.types||[]).includes('Files')&&Array.from(e.dataTransfer?.types||[]).includes('text/plain');
 for(const type of ['dragenter','dragover'])wrap.addEventListener(type,e=>{if(!textDrag(e))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';hover(true);wrap.closest('#learning')?.classList.remove('drag-over');});
 wrap.addEventListener('dragleave',e=>{if(!wrap.contains(e.relatedTarget))hover(false);});
 wrap.addEventListener('drop',e=>{if(!textDrag(e))return;e.preventDefault();e.stopPropagation();hover(false);const source=sourceFromTransfer(e.dataTransfer);if(source)onDropSource(source);});
 document.addEventListener('dragend',()=>hover(false));document.addEventListener('drop',()=>hover(false));window.addEventListener('blur',()=>{hover(false);close();});
 window.addEventListener('folio-language',()=>{setMode(mode);heading.textContent=ui('输出方式','Output format');close();});
 size();
 return {hover,size,setMode,containsPoint(x,y){const r=wrap.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top-16&&y<=r.bottom;},
  staged(value){wrap.classList.toggle('has-draft-source',value);size();},
  take(){const parsed=parseOutputCommand(input.value.trim());return {text:parsed.text,outputMode:parsed.command?.id||mode};},
  reset(){setMode(null);dismissed=false;close();hover(false);wrap.classList.remove('has-draft-source');size();}
 };
}
