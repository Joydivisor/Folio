// Capture all handles synchronously inside the drop event, before any await.
export function captureDroppedItems(transfer){
 const items=[...transfer.items||[]].filter(i=>i.kind==='file');
 return items.length?items.map(item=>{
  let handle,entry,file;try{handle=item.getAsFileSystemHandle?.().catch(()=>null);}catch{}try{entry=item.webkitGetAsEntry?.();}catch{}try{file=item.getAsFile?.();}catch{}
  return {handle,entry,file};
 }):[...transfer.files||[]].map(file=>({file}));
}
export async function readDroppedFiles(items,supports,{limit=2000,onProgress=()=>{}}={}){
 const files=[],errors=[];let skipped=0,visited=0;
 const add=(file,path)=>{if(!supports(file.name)){skipped++;return;}if(files.length>=limit)throw Error('一次最多导入 '+limit+' 篇文献，请拖入较小的子文件夹。');files.push({file,path});onProgress(files.length);};
 const visit=()=>{if(++visited>20000)throw Error('目录条目过多，请拖入较小的子文件夹。');};
 async function modern(handle,prefix='',depth=0){
  if(depth>64)throw Error('文件夹层级过深。');visit();if(handle.name.startsWith('.'))return;
  const path=prefix+handle.name;
  if(handle.kind==='directory'){for await(const child of handle.values())await modern(child,path+'/',depth+1);}
  else if(supports(handle.name)){try{add(await handle.getFile(),path);}catch(e){if(files.length>=limit)throw e;errors.push(path);}}else skipped++;
 }
 async function legacy(entry,prefix='',depth=0){
  if(depth>64)throw Error('文件夹层级过深。');visit();if(entry.name.startsWith('.'))return;
  const path=prefix+entry.name;
  if(entry.isDirectory){const reader=entry.createReader();while(true){const batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));if(!batch.length)break;for(const child of batch)await legacy(child,path+'/',depth+1);}}
  else if(supports(entry.name)){try{add(await new Promise((resolve,reject)=>entry.file(resolve,reject)),path);}catch(e){if(files.length>=limit)throw e;errors.push(path);}}else skipped++;
 }
 for(const item of items){const handle=await item.handle;if(handle)await modern(handle);else if(item.entry)await legacy(item.entry);else if(item.file)add(item.file,item.file.webkitRelativePath||item.file.name);}
 return {files,errors,skipped};
}
