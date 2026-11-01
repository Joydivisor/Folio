export function contextBelongsToSource(source,documentId){
 if(documentId&&typeof documentId==='object')return Boolean(source?.external!==true&&(source?.id===documentId.id||source?.documentId&&source.documentId===documentId.documentId)&&(!source.revision||source.revision===documentId.revision));
 return Boolean(documentId&&source?.id===documentId&&source?.external!==true);
}
