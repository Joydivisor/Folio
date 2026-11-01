// Versioned local workspace. Legacy records remain untouched until users choose to remove them.
import {DISPLAY_KINDS,parseDisplayPlan} from './display-plan.js';
import {parseUnderstanding} from './understanding.js';
import {validatePermutationSnapshot} from './permutation-state.js';
import {parseGraph} from './graph-schema.js';
export const DATA_KEYS=['jianwei-notes','jianwei-positions','jianwei-favorites','jianwei-recent','folio-annotations','folio-remember-conversations','folio-display'];
export const TABLES=['state','documents','pages','artifacts','imports','regions'];
function validateTree(value,depth=0){
 if(depth>40)throw Error('Backup nesting is too deep');
 if(Array.isArray(value)&&value.length>100000)throw Error('Backup array too large');
 if(typeof value==='number'&&!Number.isFinite(value))throw Error('Invalid numeric value');
 if(typeof value==='string'&&value.length>30000000)throw Error('Backup field too large');
 if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw Error('Invalid backup property');validateTree(item,depth+1);}
}
const imageSafe=value=>typeof value==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
function validateSource(s){if(!s||typeof s!=='object')throw Error('Invalid source');if(s.page!==undefined&&(!Number.isInteger(s.page)||s.page<1))throw Error('Invalid source page');if(s.rect&&(!Array.isArray(s.rect)||s.rect.length!==4||!s.rect.every(n=>Number.isFinite(n)&&n>=0&&n<=1)||s.rect[0]+s.rect[2]>1.00001||s.rect[1]+s.rect[3]>1.00001))throw Error('Invalid source rectangle');}
function validateArtifact(a){if(!a||typeof a.id!=='string'||!Array.isArray(a.versions)||!a.versions.length||a.versions.length>1000||!Number.isInteger(a.cursor)||!a.versions[a.cursor])throw Error('Invalid artifact history');validateSource(a.source);const ids=new Set();for(const v of a.versions){if(typeof v.id!=='string'||ids.has(v.id)||!v.plan||typeof v.plan.kind!=='string'||!v.answer||typeof v.answer!=='object')throw Error('Invalid artifact version');ids.add(v.id);
 const p=v.plan;if(DISPLAY_KINDS.includes(p.kind))parseDisplayPlan(p);else parseUnderstanding(JSON.stringify({...p,...(p.kind==='permutation'?{sigma:p.sigma?.map(n=>n+1),tau:p.tau?.map(n=>n+1)}:{})}));
 if(!Array.isArray(v.answer.paragraphs)||v.answer.paragraphs.length>20||v.answer.paragraphs.some(p=>typeof p.text!=='string'||!Array.isArray(p.sources)))throw Error('Invalid artifact answer');
 if(v.interaction?.kind==='permutation-state')validatePermutationSnapshot(v.interaction);
 if(v.visual)v.visual=parseGraph(JSON.stringify(v.visual),a.source.text||'');
 if(p.kind==='derived')for(const key of ['depth','index','a','b'])if(v.interaction?.[key]!==undefined&&(!Number.isInteger(v.interaction[key])||v.interaction[key]<0||v.interaction[key]>120))throw Error('Invalid group interaction');
 }}
export function validateBackup(value){
 if(value?.format!=='folio-workspace'||value.version!==1||!value.tables)throw Error('Unsupported backup format');
 validateTree(value);
 const out={};
 for(const name of TABLES){const rows=value.tables[name];if(!Array.isArray(rows)||rows.length>100000)throw Error('Invalid backup table: '+name);const ids=new Set();out[name]=rows.map(row=>{if(!row||typeof row.id!=='string'||!row.id||row.id.length>1000||ids.has(row.id))throw Error('Invalid or duplicate record');ids.add(row.id);if(name==='state'&&!DATA_KEYS.includes(row.id))throw Error('Unsupported settings in backup');return structuredClone(row);});}
 for(const doc of out.documents)if(typeof doc.name!=='string'||typeof doc.revision!=='string'||!Array.isArray(doc.aliases))throw Error('Invalid document record');
 for(const page of out.pages)if(typeof page.documentId!=='string'||!Number.isInteger(page.page)||page.page<1||typeof page.text!=='string')throw Error('Invalid page record');
 for(const p of out.pages)if(p.image&&!imageSafe(p.image))throw Error('Invalid OCR image');
 for(const a of out.artifacts)validateArtifact(a);
 for(const r of out.regions){validateSource(r.source);if(!imageSafe(r.image))throw Error('Invalid region image');}
 for(const i of out.imports)if(!Array.isArray(i.items)||!Array.isArray(i.collections))throw Error('Invalid import record');
 for(const r of out.state){if(['jianwei-notes','folio-annotations'].includes(r.id)&&!Array.isArray(r.value))throw Error('Invalid note collection');if(r.id==='jianwei-notes')for(const n of r.value){if(typeof n.id!=='string')throw Error('Invalid note');if(n.source)validateSource(n.source);if(n.artifact?.kind==='folio-artifact')validateArtifact(n.artifact.record);}}
 return out;
}
export async function checksum(value){const bytes=new TextEncoder().encode(JSON.stringify(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function makeBackup(tables){const payload={format:'folio-workspace',version:1,createdAt:new Date().toISOString(),tables};validateBackup(payload);return {...payload,checksum:await checksum(payload)};}
export async function readBackup(value){const {checksum:expected,...payload}=value||{};if(typeof expected!=='string'||await checksum(payload)!==expected)throw Error('Backup checksum does not match');return validateBackup(payload);}
export function openWorkspace(){
 const ready=new Promise((resolve,reject)=>{const req=indexedDB.open('folio-workspace',1);req.onupgradeneeded=()=>{for(const name of [...TABLES,'recovery'])req.result.createObjectStore(name,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Close other Folio windows before migrating storage'));});
 async function op(table,method,value){const db=await ready;return new Promise((resolve,reject)=>{const tx=db.transaction(table,method.startsWith('get')?'readonly':'readwrite'),r=tx.objectStore(table)[method](value);tx.oncomplete=()=>resolve(r.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Storage transaction aborted'));});}
 async function replace(tables){const db=await ready;return new Promise((resolve,reject)=>{const tx=db.transaction(TABLES,'readwrite');for(const name of TABLES){const s=tx.objectStore(name);s.clear();for(const row of tables[name])s.put(row);}tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Restore failed'));});}
 const api={get:(t,id)=>op(t,'get',id),all:t=>op(t,'getAll'),put:(t,row)=>op(t,'put',structuredClone(row)),remove:(t,id)=>op(t,'delete',id),async snapshot(){const db=await ready;const tables=await new Promise((resolve,reject)=>{const tx=db.transaction(TABLES,'readonly'),result={};for(const name of TABLES){const r=tx.objectStore(name).getAll();r.onsuccess=()=>result[name]=r.result;}tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Snapshot failed'));});return makeBackup(tables);},async restore(backup){const tables=await readBackup(backup);await api.put('recovery',{id:'before-restore',backup:await api.snapshot()});await replace(tables);},async rollback(){const r=await api.get('recovery','before-restore');if(!r)throw Error('No restore recovery point');await replace(await readBackup(r.backup));},async migrate(storage){if(await api.get('recovery','legacy-v1'))return;const rows=[];for(const id of DATA_KEYS){const raw=storage.getItem(id);if(raw!==null){let value;try{value=JSON.parse(raw);}catch{throw Error('Cannot migrate malformed local record: '+id);}rows.push({id,value});}}await api.put('recovery',{id:'legacy-v1-pending',rows});const db=await ready;await new Promise((resolve,reject)=>{const tx=db.transaction(['state','recovery'],'readwrite');for(const row of rows)tx.objectStore('state').put(row);tx.objectStore('recovery').put({id:'legacy-v1',rows,date:new Date().toISOString()});tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});},async identify(entry,file){const revision=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');const docs=await api.all('documents');let doc=docs.find(d=>d.aliases.includes(entry.id))||docs.find(d=>d.revision===revision);if(!doc)doc={id:'doc:'+crypto.randomUUID(),aliases:[],name:entry.name};doc={...doc,aliases:[...new Set([...doc.aliases,entry.id])],revision,name:entry.name,size:file.size,path:entry.path||'',modified:file.lastModified||0};await api.put('documents',doc);return doc;}};
 return api;
}
