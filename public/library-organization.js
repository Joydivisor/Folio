// Source identity is never inferred from titles: two unrelated files may share a name.
export function documentKey(source,documents=[]){
 if(!source||source.external)return null;
 if(source.documentId)return source.documentId;
 if(!source.id)return null;
 return documents.find(d=>d.id===source.id||d.aliases?.includes(source.id))?.id||source.id;
}
export function notesForDocument(notes,source,documents=[]){
 const key=documentKey(source,documents);return key?notes.filter(n=>documentKey(n.source,documents)===key):[];
}
export function sourceEntry(source,entries,documents=[]){
 const key=documentKey(source,documents);return key?entries.find(e=>documentKey(e,documents)===key):undefined;
}
export function groupNotes(notes,entries=[],documents=[]){
 const groups=new Map();
 for(const note of notes){const key=documentKey(note.source,documents)||'unlinked';let group=groups.get(key);
  if(!group){const entry=sourceEntry(note.source,entries,documents);group={key,name:entry?.name||note.source?.name||'',path:entry?.path||documents.find(d=>d.id===key)?.path||'',available:Boolean(entry),notes:[]};groups.set(key,group);}group.notes.push(note);
 }
 return [...groups.values()].sort((a,b)=>a.key==='unlinked'?1:b.key==='unlinked'?-1:a.name.localeCompare(b.name));
}
export const collectionColors=['#729fe0','#61c5a3','#e6b85c','#ce82ab','#a88cdb'];
export function validateCollections(value){
 if(!Array.isArray(value)||value.length>500)throw Error('Invalid collections');const ids=new Set();
 for(const c of value){if(!c||typeof c.id!=='string'||!c.id||c.id.length>1000||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>120||!collectionColors.includes(c.color)||!Array.isArray(c.members)||c.members.length>10000||c.members.some(id=>typeof id!=='string'||!id||id.length>1000)||new Set(c.members).size!==c.members.length)throw Error('Invalid collection');ids.add(c.id);}
 for(const c of value){if(c.parentId!=null&&(!ids.has(c.parentId)||c.parentId===c.id))throw Error('Invalid collection parent');const seen=new Set([c.id]);let parent=c.parentId;while(parent){if(seen.has(parent))throw Error('Cyclic collection');seen.add(parent);parent=value.find(x=>x.id===parent)?.parentId;}}
 return value;
}
export function descendants(id,collections){const found=new Set([id]);let changed=true;while(changed){changed=false;for(const c of collections)if(c.parentId&&found.has(c.parentId)&&!found.has(c.id)){found.add(c.id);changed=true;}}return found;}
export function collectionPath(id,collections){const names=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const c=collections.find(c=>c.id===id);if(!c)break;names.unshift(c.name);id=c.parentId;}return names.join(' / ');}
export function itemFor(source,items=[],documents=[]){const key=documentKey(source,documents);return key?items.find(item=>item.attachments.some(id=>documentKey({id},documents)===key)):undefined;}
export function libraryKey(source,documents=[],items=[]){return items.find(i=>i.id===source?.id)?.id||itemFor(source,items,documents)?.id||documentKey(source,documents);}
export function collectionKeys(collection,documents=[],items=[],collections=[]){const ids=descendants(collection?.id,collections);const members=[collection,...collections.filter(c=>c.id!==collection?.id&&ids.has(c.id))].filter(Boolean).flatMap(c=>c.members);return new Set(members.map(id=>libraryKey({id},documents,items)));}
export function inCollection(source,collection,documents=[],items=[],collections=[]){const key=libraryKey(source,documents,items);return Boolean(key&&collectionKeys(collection,documents,items,collections).has(key));}
export function setMembership(collection,source,include,documents=[],items=[]){
 const key=libraryKey(source,documents,items);if(!key)return;
 collection.members=collection.members.filter(id=>libraryKey({id},documents,items)!==key);if(include)collection.members.push(key);
}
export function notesInScope(notes,scope,collections=[],documents=[],items=[]){
 if(scope.kind==='document')return notes.filter(n=>(documentKey(n.source,documents)||'unlinked')===(scope.id==='unlinked'?'unlinked':documentKey({id:scope.id},documents)));
 if(scope.kind==='item'){const item=items.find(i=>i.id===scope.id);return item?notes.filter(n=>itemFor(n.source,items,documents)===item):[];}
 if(scope.kind==='collection'){const c=collections.find(c=>c.id===scope.id);return notes.filter(n=>inCollection(n.source,c,documents,items,collections));}
 return notes;
}
export function sourceScopeRoute(kind,id){return '#/notes/'+kind+'/'+encodeURIComponent(id);}

export function normalizeTags(value){return [...new Map(value.map(tag=>tag.trim()).filter(Boolean).map(tag=>[tag.toLocaleLowerCase(),tag])).values()];}
export function validateItems(value){
 if(!Array.isArray(value)||value.length>10000)throw Error('Invalid library items');const ids=new Set(),files=new Set();
 for(const item of value){if(!item||typeof item.id!=='string'||!item.id.startsWith('item:')||ids.has(item.id)||item.id.length>1000||typeof item.title!=='string'||!item.title.trim()||item.title.length>1000||!Array.isArray(item.attachments)||!item.attachments.length||item.attachments.length>1000||!item.attachments.includes(item.primary)||!Array.isArray(item.tags)||item.tags.length>100||item.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>80)||normalizeTags(item.tags).length!==item.tags.length)throw Error('Invalid library item');if(item.readStatus!==undefined&&!['unread','reading','read'].includes(item.readStatus))throw Error('Invalid reading status');ids.add(item.id);for(const key of ['authors','year','doi'])if(item[key]!==undefined&&(typeof item[key]!=='string'||item[key].length>1000))throw Error('Invalid item metadata');for(const id of item.attachments){if(typeof id!=='string'||!id||id.length>1000||files.has(id))throw Error('Duplicate attachment ownership');files.add(id);}}
 return value;
}
export function ensureItem(source,items,documents=[]){let item=itemFor(source,items,documents);if(!item){const key=documentKey(source,documents);if(!key)throw Error('Missing document');item={id:'item:'+crypto.randomUUID(),title:source.name.replace(/\.(pdf|md|txt)$/i,''),authors:'',year:'',doi:'',tags:[],attachments:[key],primary:key};items.push(item);}return item;}
export function attachDocument(item,source,items,documents=[]){const key=documentKey(source,documents),owner=itemFor(source,items,documents);if(!key)throw Error('Missing document');if(owner&&owner!==item)throw Error('This file already belongs to another item');if(!item.attachments.some(id=>documentKey({id},documents)===key))item.attachments.push(key);}
export function itemEntries(item,entries,documents=[]){return entries.filter(e=>item.attachments.some(id=>documentKey({id},documents)===documentKey(e,documents)));}
// Group only explicit user relationships. A matching filename never creates a parent item.
export function libraryRows(entries,items=[],documents=[]){const groups=new Map();for(const entry of entries){const item=itemFor(entry,items,documents),key=item?.id||entry.id;if(!groups.has(key))groups.set(key,{item,entries:[]});groups.get(key).entries.push(entry);}return [...groups.values()].map(g=>({...g,entry:g.entries.find(e=>documentKey(e,documents)===documentKey({id:g.item?.primary},documents))||g.entries[0]}));}
