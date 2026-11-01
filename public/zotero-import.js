const NS={rdf:'http://www.w3.org/1999/02/22-rdf-syntax-ns#',dc:'http://purl.org/dc/elements/1.1/',terms:'http://purl.org/dc/terms/',z:'http://www.zotero.org/namespaces/export#',bib:'http://purl.org/net/biblio#',foaf:'http://xmlns.com/foaf/0.1/',link:'http://purl.org/rss/1.0/modules/link/'};
export function safeAttachmentPath(value){let text;try{text=decodeURIComponent(value).replaceAll('\\','/');}catch{return null;}if(!text||text.startsWith('/')||/^[a-z]+:/i.test(text)||text.split('/').some(p=>p==='..'||p==='')||text.includes('\0'))return null;return text.replace(/^\.\//,'');}
export function parseZoteroRDF(text,Parser=DOMParser){
 if(typeof text!=='string'||text.length>20000000||/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Invalid or oversized Zotero RDF');
 const doc=new Parser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement?.namespaceURI!==NS.rdf||doc.documentElement.localName!=='RDF')throw Error('Select a Zotero RDF export');
 const graph=new Map();let anonymous=0;
 const children=n=>Array.from(n.childNodes||[]).filter(n=>n.nodeType===1);
 const attr=(n,key)=>n.getAttributeNS(NS.rdf,key);
 function read(n){const id=attr(n,'about')||(attr(n,'nodeID')?'_:'+attr(n,'nodeID'):'_anonymous'+(++anonymous));const props=graph.get(id)||[];graph.set(id,props);if(n.localName!=='Description')props.push({p:NS.rdf+'type',ref:n.namespaceURI+n.localName});for(const property of children(n)){const p=property.namespaceURI+property.localName,r=attr(property,'resource'),b=attr(property,'nodeID'),nested=children(property);if(r)props.push({p,ref:r});else if(b)props.push({p,ref:'_:'+b});else if(nested.length)for(const node of nested)props.push({p,ref:read(node)});else props.push({p,text:property.textContent||''});}return id;}
 for(const n of children(doc.documentElement))read(n);if(graph.size>30000)throw Error('Export contains too many records');
 const values=(id,key)=>(graph.get(id)||[]).filter(v=>v.p===key),literal=(id,key)=>values(id,key).map(v=>v.text||'').join('; '),refs=(id,key)=>values(id,key).map(v=>v.ref).filter(Boolean),type=id=>refs(id,NS.rdf+'type');
 const items=[],collections=[];
 for(const [id,props] of graph){const types=type(id),title=literal(id,NS.dc+'title');if(types.includes(NS.z+'Collection')){collections.push({id,title,members:refs(id,NS.terms+'hasPart')});continue;}const itemType=literal(id,NS.z+'itemType');if(!title||types.includes(NS.z+'Attachment')||types.includes(NS.bib+'Memo')||!itemType)continue;
  const creators=[];for(const prop of props.filter(p=>/authors$|editors$|contributors$/.test(p.p))){const seq=graph.get(prop.ref)||[];for(const member of seq.filter(p=>p.ref&&p.p!==NS.rdf+'type')){const name=[literal(member.ref,NS.foaf+'givenName'),literal(member.ref,NS.foaf+'surname')].filter(Boolean).join(' ');if(name)creators.push(name);}}
  const attachments=refs(id,NS.link+'link').filter(r=>type(r).includes(NS.z+'Attachment')).map(ref=>{const path=values(ref,NS.z+'path')[0];return {id:ref,title:literal(ref,NS.dc+'title'),path:path?.ref||path?.text||'',safePath:safeAttachmentPath(path?.ref||path?.text||'')};});
  const notes=refs(id,NS.terms+'isReferencedBy').filter(r=>type(r).includes(NS.bib+'Memo')).map(ref=>({id:ref,text:literal(ref,NS.rdf+'value').replace(/<[^>]*>/g,' ')}));
  const tags=values(id,NS.dc+'subject').map(v=>v.text||literal(v.ref,NS.rdf+'value')).filter(Boolean);
  items.push({id,title,itemType,creators,attachments,notes,tags,date:literal(id,NS.dc+'date'),identifiers:values(id,NS.dc+'identifier').map(v=>v.text||v.ref||''),fields:props.filter(p=>p.text).map(({p,text})=>({predicate:p,value:text}))});
 }
 if(!items.length)throw Error('No supported bibliographic items found in this Zotero RDF export');return {items,collections};
}
