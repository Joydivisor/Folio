import {ui,node,button,modal} from './workspace-ui.js';

// File-input change events do not carry the activation used to open the picker.
// Querying permission is safe here; requesting it needs a new, explicit click.
export async function chooseImportDestination(folder, choose=requestImportPermission) {
 if (!folder) return {kind:'local'};
 let permission='prompt';
 try { permission=await folder.queryPermission?.({mode:'readwrite'}) || 'prompt'; }
 catch(error) { if(!['SecurityError','NotAllowedError'].includes(error.name))throw error; }
 if (permission==='granted') return {kind:'folder',handle:folder};
 return choose(folder);
}

function requestImportPermission(folder) {
 const {root,body}=modal(ui('导入文献','Import documents'));
 root.dataset.importPermission='';
 body.append(node('p',ui(`将文献复制到“${folder.name}”需要你的写入授权。也可以仅保存到 Folio 的本机库。`,`Copying documents to “${folder.name}” needs write permission. You can also keep a copy in Folio's local library.`)));
 const status=node('p','');status.setAttribute('role','status');status.hidden=true;
 const actions=node('div',undefined,{className:'workspace-actions'});
 body.append(status,actions);
 return new Promise(resolve=>{
  let pending=false,settled=false;
  const finish=result=>{if(settled)return;settled=true;resolve(result);root.close();};
  root.addEventListener('close',()=>{settled=true;resolve(null);},{once:true});
  const local=button(ui('保存到本机库','Save locally'),()=>finish({kind:'local'}));local.dataset.importLocal='';
  const allow=button(ui('允许并导入','Allow and import'),async()=>{
   if(pending||settled)return;
   pending=true;local.disabled=true;status.hidden=true;
   try {
    // Keep this call before any await: the native permission prompt must use
    // this button's activation, never the earlier file-picker change event.
    const permission=await folder.requestPermission({mode:'readwrite'});
    if(settled)return;
    if(permission==='granted'){finish({kind:'folder',handle:folder});return;}
    status.textContent=ui('尚未获得文件夹写入权限。可以重试，或保存到本机库。','Folder write access was not granted. Try again, or save locally.');
   } catch {
    if(settled)return;
    status.textContent=ui('暂时无法授权这个文件夹。可以保存到本机库，或取消后重新连接文件夹。','This folder could not be authorized. Save locally, or cancel and reconnect the folder.');
   } finally {pending=false;if(!settled){local.disabled=false;status.hidden=false;}}
  });
  allow.dataset.importAllow='';allow.classList.add('primary');
  actions.append(local,allow);allow.focus();
 });
}
