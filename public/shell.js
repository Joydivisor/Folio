import {setupFeatureGuide,openFeatureGuide} from './feature-guide.js';
import {menus,commandEnabled} from './commands.js';
import {t,language,setLanguage,languageChoice,startLocalization} from './i18n.js';
import {icon} from './icons.js';
const $=id=>document.getElementById(id);
const pref=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('folio-'+key))??fallback;}catch{return fallback;}};
const store=(key,value)=>{try{localStorage.setItem('folio-'+key,JSON.stringify(value));}catch{}};
export function setupShell({selection,fit,closeDocument,hasDocument}){
 setupFeatureGuide();
 let opener=null,currentMenu=-1,returnFocus=null;
 const dialog=$('settingsDialog'),oldOpen=$('settingsButton').onclick;
 function selectPreference(name){
  document.querySelectorAll('[data-pref-panel]').forEach(p=>p.hidden=p.dataset.prefPanel!==name);
  document.querySelectorAll('[data-pref]').forEach(b=>{const active=b.dataset.pref===name;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
 }
 function settings(name='general'){
  opener=document.activeElement;oldOpen();selectPreference(name);
  $('languageSelect').value=languageChoice();$('appearanceSelect').value=window.folioAppearance.get();$('memorySetting').checked=$('autoRemember').checked;
  document.querySelector('[data-pref="'+name+'"]').focus();
 }
 $('settingsButton').onclick=()=>settings();$('modelButton').onclick=()=>settings('ai');$('memoryShortcut').onclick=()=>settings('ai');
 document.querySelectorAll('[data-pref]').forEach(b=>b.onclick=()=>selectPreference(b.dataset.pref));
 dialog.addEventListener('close',()=>opener?.focus());
 $('languageSelect').onchange=e=>setLanguage(e.target.value);
 $('appearanceSelect').onchange=e=>window.folioAppearance.set(e.target.value);
 $('answerLanguage').value=pref('answer-language','auto');$('answerLanguage').onchange=e=>store('answer-language',e.target.value);
 function motion(value){document.documentElement.classList.toggle('reduce-motion',value);$('reduceMotion').checked=value;store('reduce-motion',value);}
 motion(pref('reduce-motion',false));$('reduceMotion').onchange=e=>motion(e.target.checked);
 function hints(value){document.body.classList.toggle('hide-reading-hints',!value);$('readingHints').checked=value;store('reading-hints',value);}
 hints(pref('reading-hints',true));$('readingHints').onchange=e=>hints(e.target.checked);
 function reference(value){$('includePage').checked=value;$('referenceDefault').checked=value;store('reference-default',value);}
 reference(pref('reference-default',true));$('includePage').onchange=$('referenceDefault').onchange=e=>reference(e.target.checked);
 $('memorySetting').onchange=e=>{$('autoRemember').checked=e.target.checked;$('autoRemember').dispatchEvent(new Event('change'));};
 $('autoRemember').addEventListener('change',()=>$('memorySetting').checked=$('autoRemember').checked);
 $('settingsFolder').onclick=()=>{dialog.close();$('chooseFolder').click();};$('settingsExport').onclick=()=>$('exportNotes').click();
 $('fitWidth').onclick=fit;
 const palette=$('annotationColors');palette.popover='auto';palette.classList.add('palette-popover');document.body.append(palette);
 $('annotationColorMenu').setAttribute('aria-controls','annotationColors');
 const colorPreview=()=>{const selected=palette.querySelector('[aria-pressed=true]');$('annotationColorMenu').style.setProperty('--annotation-color',selected?.style.getPropertyValue('--annotation-color')||'#e7c763');};colorPreview();
 $('annotationColorMenu').onclick=()=>{if(palette.matches(':popover-open')){palette.hidePopover();return;}palette.showPopover();const r=$('annotationColorMenu').getBoundingClientRect();palette.style.left=Math.max(8,Math.min(r.left,innerWidth-palette.offsetWidth-8))+'px';palette.style.top=r.bottom+6+'px';palette.querySelector('button').focus();};
 palette.addEventListener('click',e=>{if(e.target.closest('button')){colorPreview();palette.hidePopover();$('annotationColorMenu').focus();}});
 palette.addEventListener('toggle',e=>$('annotationColorMenu').setAttribute('aria-expanded',String(e.newState==='open')));
 palette.onkeydown=e=>{const buttons=[...palette.children],index=buttons.indexOf(document.activeElement);if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();buttons[(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length].focus();}if(e.key==='Escape'){e.preventDefault();palette.hidePopover();$('annotationColorMenu').focus();}};
 window.addEventListener('resize',()=>palette.hidePopover());
 function themeIcon(){const mode=window.folioAppearance.get();$('themeToggle').innerHTML=icon({light:'sun',dark:'moon',system:'monitor'}[mode]);const label=t('外观')+': '+t({light:'日间',dark:'夜间',system:'跟随系统'}[mode]);$('themeToggle').title=label;$('themeToggle').setAttribute('aria-label',label);$('appearanceSelect').value=mode;}
 window.addEventListener('folio-theme',themeIcon);window.addEventListener('folio-language',()=>{renderMenu();themeIcon();});
 const readerMenu=document.createElement('div');readerMenu.className='command-menu';readerMenu.popover='auto';readerMenu.id='readerActions';readerMenu.setAttribute('role','menu');document.body.append(readerMenu);$('readerMore').setAttribute('aria-controls','readerActions');
 $('readerMore').onclick=()=>{if(readerMenu.matches(':popover-open')){readerMenu.hidePopover();return;}readerMenu.replaceChildren();for(const [label,id]of [['放大','zoomIn'],['缩小','zoomOut'],['适合宽度','fitWidth']]){const b=document.createElement('button');b.setAttribute('role','menuitem');b.textContent=t(label);b.onclick=()=>{$(id).click();readerMenu.hidePopover();$('readerMore').focus();};readerMenu.append(b);}readerMenu.showPopover();const r=$('readerMore').getBoundingClientRect();readerMenu.style.left=Math.max(8,Math.min(r.left,innerWidth-readerMenu.offsetWidth-8))+'px';readerMenu.style.top=r.bottom+6+'px';readerMenu.querySelector('button').focus();};
 readerMenu.addEventListener('toggle',e=>$('readerMore').setAttribute('aria-expanded',String(e.newState==='open')));
 readerMenu.onkeydown=e=>{const buttons=[...readerMenu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}if(e.key==='Escape'){e.preventDefault();readerMenu.hidePopover();$('readerMore').focus();}};
 window.addEventListener('resize',()=>readerMenu.hidePopover());
 const popup=document.createElement('div');popup.className='command-menu';popup.id='commandMenu';popup.popover='auto';popup.setAttribute('role','menu');document.body.append(popup);
 popup.addEventListener('toggle',e=>{if(e.newState==='closed'){for(const b of $('appMenubar').children)b.setAttribute('aria-expanded','false');currentMenu=-1;}});
 function closeMenu(restore=false){popup.hidePopover();if(restore)returnFocus?.focus();}
 function context(){return {reader:document.body.dataset.view==='reader',selection:Boolean(selection()),document:hasDocument()};}
 function checked(id){return id==='ai-panel'?!document.body.classList.contains('ai-collapsed'):id==='annotations'?!$('annotationPanel').hidden:id==='focus'?document.body.classList.contains('canvas-focus'):null;}
 function openMenu(index,focus=true){
  if(currentMenu===index&&popup.matches(':popover-open')){closeMenu(true);return;}
  currentMenu=index;const anchor=$('appMenubar').children[index];returnFocus=anchor;popup.replaceChildren();
  for(const item of menus[index].items){
   if(!item){popup.append(document.createElement('hr'));continue;}
   const [id,zh,en,shortcut]=item,b=document.createElement('button');b.type='button';b.dataset.command=id;b.disabled=!commandEnabled(item,context());
   const mark=checked(id);b.setAttribute('role',mark===null?'menuitem':'menuitemcheckbox');if(mark!==null)b.setAttribute('aria-checked',String(mark));
   const label=document.createElement('span');label.textContent=language()==='en'?en:zh;const key=document.createElement('kbd');key.textContent=shortcut||'';b.append(label,key);
   b.onclick=()=>{closeMenu();execute(id).catch(error=>notice(error.message));};popup.append(b);
  }
  if(!popup.matches(':popover-open'))popup.showPopover();
  for(const [i,b]of [...$('appMenubar').children].entries())b.setAttribute('aria-expanded',String(index===i));
  const r=anchor.getBoundingClientRect();popup.style.left=Math.max(8,Math.min(r.left,innerWidth-popup.offsetWidth-8))+'px';popup.style.top=r.bottom+5+'px';
  if(focus)popup.querySelector('button:not(:disabled)')?.focus();
 }
 function renderMenu(){closeMenu();$('appMenubar').replaceChildren();menus.forEach((m,index)=>{const b=document.createElement('button');b.textContent=m.label[language()==='en'?1:0];b.setAttribute('role','menuitem');b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','commandMenu');b.onclick=()=>openMenu(index);b.onpointerenter=()=>{if(currentMenu!==-1&&currentMenu!==index)openMenu(index,false);};b.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();openMenu(index);}if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();$('appMenubar').children[(index+(e.key==='ArrowRight'?1:-1)+menus.length)%menus.length].focus();}};$('appMenubar').append(b);});}
 popup.onkeydown=e=>{const buttons=[...popup.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();openMenu((currentMenu+(e.key==='ArrowRight'?1:-1)+menus.length)%menus.length);}if(e.key==='Escape'){e.preventDefault();closeMenu(true);}if(e.key==='Tab')closeMenu();};
 document.addEventListener('pointerdown',e=>{if(e.target.closest('#appMenubar')&&document.activeElement.matches('input,textarea,[contenteditable="true"]')){focusedEditor=document.activeElement;}});
 let focusedEditor=null;
 document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,[contenteditable="true"]'))focusedEditor=e.target;});
 function notice(message){const d=document.createElement('dialog');d.className='info-dialog';const p=document.createElement('p');p.textContent=message;const b=document.createElement('button');b.textContent=t('关闭');b.onclick=()=>d.close();d.append(p,b);d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();}
 async function execute(id){
  const item=menus.flatMap(m=>m.items).find(i=>i?.[0]===id);if(!item||!commandEnabled(item,context()))return;
  if(['navigation','ocr','backup','restore','zotero','updates','artifacts','rollback'].includes(id)){window.dispatchEvent(new CustomEvent('folio-feature',{detail:id}));return;}
  const targets={import:'importFiles',folder:'chooseFolder',library:'libraryButton',notes:'globalNotesButton',export:'exportNotes','ai-panel':'toggleAI',annotations:'toggleAnnotations',focus:'focusCanvas','zoom-in':'zoomIn','zoom-out':'zoomOut',explore:'citeSelection',compile:'compileAnnotations'};
  if(targets[id]){$(targets[id]).click();return;}
  if(['settings','appearance','ai-settings'].includes(id)){settings(id==='settings'?'general':id==='appearance'?'appearance':'ai');return;}
  if(id==='fit'){fit();return;}if(id==='close'){closeDocument();return;}
  if(id==='search'){$('libraryButton').click();$('librarySearch').focus();return;}
  if(id==='fullscreen'){if(window.folioDesktop)await window.folioDesktop.windowCommand('fullscreen');else if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();return;}
  if(['undo','redo','cut','copy','paste','selectAll'].includes(id)){
   focusedEditor?.focus();if(window.folioDesktop){await window.folioDesktop.editCommand(id);return;}
   if(id==='paste'){const text=await navigator.clipboard.readText();document.execCommand('insertText',false,text);}else document.execCommand(id);return;
  }
  if(id==='about'){const version=await fetch('/api/version').then(r=>r.json()).then(v=>v.version).catch(()=>'');notice(language()==='en'?`Folio ${version}\nLocal library, source-linked notes and interactive explanations.`:`Folio ${version}\n本地文献库、可追溯笔记与交互解读。`);}
  if(id==='shortcuts')openFeatureGuide('shortcuts');
 }
 window.addEventListener('resize',()=>closeMenu());
 window.addEventListener('folio-command',e=>execute(e.detail).catch(error=>notice(error.message)));
 document.addEventListener('keydown',e=>{if(dialog.open||e.defaultPrevented)return;if((e.ctrlKey||e.metaKey)&&!e.altKey){const id=e.key.toLowerCase()==='o'?'import':e.key===','?'settings':null;if(id){e.preventDefault();execute(id);}}});
 // A separate sibling button keeps closing accessible without nested buttons.
 const tabGroup=$('readerTabGroup'),tabMenu=document.createElement('div');
 tabMenu.id='documentTabMenu';tabMenu.className='command-menu document-tab-menu';tabMenu.popover='auto';tabMenu.setAttribute('role','menu');document.body.append(tabMenu);
 $('readerTab').setAttribute('aria-haspopup','menu');$('readerTab').setAttribute('aria-controls',tabMenu.id);
 const dismissTabMenu=()=>tabMenu.hidePopover();
 const closeTab=()=>{dismissTabMenu();execute('close').catch(error=>notice(error.message));};
 $('closeReaderTab').onclick=closeTab;
 function showTabMenu(x,y){
  if(!hasDocument())return;
  tabMenu.replaceChildren();const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=t('关闭文档');b.onclick=closeTab;tabMenu.append(b);
  tabMenu.showPopover();tabMenu.style.left=Math.max(8,Math.min(x,innerWidth-tabMenu.offsetWidth-8))+'px';tabMenu.style.top=Math.max(8,Math.min(y,innerHeight-tabMenu.offsetHeight-8))+'px';b.focus();
 }
 tabGroup.oncontextmenu=e=>{e.preventDefault();const r=tabGroup.getBoundingClientRect();showTabMenu(e.clientX||r.left,e.clientY||r.bottom);};
 tabGroup.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=tabGroup.getBoundingClientRect();showTabMenu(r.left,r.bottom+4);}});
 tabMenu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();dismissTabMenu();$('readerTab').focus();}if(e.key==='Tab')dismissTabMenu();};
 window.addEventListener('resize',dismissTabMenu);window.addEventListener('folio-language',dismissTabMenu);
 new MutationObserver(()=>{if(tabGroup.hidden)dismissTabMenu();}).observe(tabGroup,{attributes:true,attributeFilter:['hidden']});
 themeIcon();renderMenu();startLocalization();
 return {settings,execute};
}
