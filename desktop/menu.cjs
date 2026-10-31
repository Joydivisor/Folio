const edits=new Set(['undo','redo','cut','copy','paste','selectAll']);
exports.menuTemplate=(menus,language,send)=>menus.map(menu=>({label:menu.label[language==='en'?1:0],submenu:menu.items.map(item=>{
 if(!item)return {type:'separator'};
 const [id,zh,en,shortcut]=item;
 return {label:language==='en'?en:zh,...(shortcut?{accelerator:shortcut.replace('Ctrl','CmdOrCtrl')}:{}),...(edits.has(id)?{role:id}:{click:()=>send(id)})};
})}));
