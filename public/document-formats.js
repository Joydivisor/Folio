// Reading formats shared by import, attachments, relinking and directory scans.
export const DOCUMENT_ACCEPT='.pdf,.docx,.txt,.md,.markdown';
export const supportsDocument=name=>/\.(pdf|docx|txt|md|markdown)$/i.test(String(name));
export const documentTitle=name=>String(name).replace(/\.(pdf|docx|txt|md|markdown)$/i,'');

export function paginateText(text,limit=4200){
 const pages=[];
 for(let section of String(text).replace(/\r\n?/g,'\n').split('\f')){
  while(section.length>limit){
   let at=section.lastIndexOf('\n',limit);if(at<limit/2)at=section.lastIndexOf(' ',limit);if(at<limit/2)at=limit;
   if(/[\uD800-\uDBFF]/.test(section[at-1]))at--;
   pages.push(section.slice(0,at));section=section.slice(at).replace(/^\n/,'');
  }
  if(section.trim())pages.push(section);
 }
 return pages.length?pages:[''];
}

export function parseDocxXML(xml,Parser=globalThis.DOMParser){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported DOCX XML declarations');
 const doc=new Parser().parseFromString(xml,'application/xml');
 if(doc.getElementsByTagName('parsererror').length||doc.documentElement?.localName!=='document')throw Error('Invalid DOCX document');
 const word=doc.documentElement.namespaceURI;
 if(!['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main'].includes(word))throw Error('Invalid DOCX namespace');
 const body=doc.getElementsByTagNameNS(word,'body')[0];if(!body)throw Error('Missing DOCX body');
 const children=n=>Array.from(n.childNodes||[]).filter(c=>c.nodeType===1);
 const child=(n,name)=>children(n).find(c=>c.localName===name);
 const value=(n,name)=>n?.getAttributeNS(word,name)||n?.getAttribute('w:'+name)||'';
 function read(n){
  const name=n.localName,math=/\/math$/.test(n.namespaceURI||'');
  if(['del','moveFrom','instrText','delText','pPr','rPr','sectPr','tblPr','tcPr','drawing','pict','altChunk'].includes(name))return '';
  if(name==='t')return n.textContent;
  if(math){
   const part=k=>child(n,k)?read(child(n,k)):'';
   if(name==='f')return '('+part('num')+')/('+part('den')+')';
   if(name==='sSup')return part('e')+'^('+part('sup')+')';
   if(name==='sSub')return part('e')+'_('+part('sub')+')';
   if(name==='sSubSup')return part('e')+'_('+part('sub')+')^('+part('sup')+')';
   if(name==='rad')return (part('deg')?'root['+part('deg')+']':'sqrt')+'('+part('e')+')';
  }
  if(name==='tab')return '\t';
  if(name==='br')return value(n,'type')==='page'?'\f':'\n';
  if(name==='cr')return '\n';
  if(name==='noBreakHyphen')return '‑';
  if(name==='softHyphen')return '\u00ad';
  if(name==='tbl')return children(n).filter(c=>c.localName==='tr').map(row=>children(row).filter(c=>c.localName==='tc').map(c=>read(c).trim().replace(/\n+/g,' / ')).join('\t')).join('\n')+'\n\n';
  const text=children(n).map(read).join('');
  if(name==='p'){
   const properties=child(n,'pPr'),listed=properties&&child(properties,'numPr');
   return (properties&&child(properties,'pageBreakBefore')&&value(child(properties,'pageBreakBefore'),'val')!=='0'?'\f':'')+(listed?'• ':'')+text+'\n\n';
  }
  return text;
 }
 return read(body).replace(/\n{3,}/g,'\n\n').trim();
}

export async function readTextDocument(file,{unzip,Parser}={}){
 // Preserve existing TXT/Markdown page boundaries and their saved note anchors.
 if(!/\.docx$/i.test(file.name))return (await file.text()).match(/[\s\S]{1,4200}/g)||['（空文档）'];
 try{
  const unzipSync=unzip||(await import('/note-vendor/fflate.js')).unzipSync;
  const files=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{
   if(entry.name!=='word/document.xml')return false;
   if(entry.originalSize>24*1024*1024)throw Error('DOCX text exceeds 24 MB');
   return true;
  }});
  if(!files['word/document.xml'])throw Error('Missing DOCX document');
  return paginateText(parseDocxXML(new TextDecoder().decode(files['word/document.xml']),Parser));
 }catch(cause){const error=new Error('Unable to read DOCX',{cause});error.name='DocumentFormatError';throw error;}
}
