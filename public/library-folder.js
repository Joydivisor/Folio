// A saved catalog keeps the library visible while an external disk is offline
// or the browser needs a new user gesture to renew a folder grant.
export async function scanDirectory(folder, supports, limit = 2000) {
 const found=[];
 async function walk(dir,prefix='') {
  for await(const [name,handle] of dir.entries()) {
   if(name.startsWith('.'))continue;
   const relative=prefix+name;
   if(handle.kind==='directory')await walk(handle,relative+'/');
   else if(supports(name)) {
    if(found.length>=limit)throw Error('文件夹中超过 2000 篇文献，请选择更小的子文件夹。');
    found.push({id:'folder:'+folder.name+':'+relative,name,handle,path:relative,kind:'file'});
   }
  }
 }
 await walk(folder);
 return found.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
}

export async function restoredCatalog(folder, snapshot) {
 if(!folder||!snapshot||snapshot.version!==1||!snapshot.folder||!Array.isArray(snapshot.entries))return [];
 try { if(!await folder.isSameEntry(snapshot.folder))return []; } catch { return []; }
 return snapshot.entries.filter(e=>e&&typeof e.id==='string'&&typeof e.name==='string'&&typeof e.path==='string'&&e.handle?.kind==='file').map(e=>({...e,kind:'file'}));
}
