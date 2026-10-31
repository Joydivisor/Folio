export function contextBelongsToSource(source,documentId){
 return Boolean(documentId&&source?.id===documentId&&source?.external!==true);
}
