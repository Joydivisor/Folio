// Materialize external files before storing or awaiting database/PDF operations.
// A File from the picker is a disk snapshot, not an owned, durable byte copy.
export async function snapshotFile(file) {
 if (!file || typeof file.arrayBuffer !== 'function') throw new DOMException('Missing file', 'NotFoundError');
 const bytes = await file.arrayBuffer();
 return new File([bytes], file.name || 'document', {type:file.type || '', lastModified:file.lastModified || 0});
}
export async function readDocumentFile(entry) {
 if (!entry.handle) return snapshotFile(entry.blob);
 const handle = entry.handle;
 if (handle.queryPermission && await handle.queryPermission({mode:'read'}) !== 'granted') {
  if (!handle.requestPermission || await handle.requestPermission({mode:'read'}) !== 'granted')
   throw new DOMException('File access was not granted', 'NotAllowedError');
 }
 for (let attempt=0; attempt<2; attempt++) {
  try { return await snapshotFile(await handle.getFile()); }
  catch (error) { if (attempt || !['NotReadableError','InvalidStateError'].includes(error.name)) throw error; }
 }
}
export function fileReadMessage(error, english=false) {
 const messages = {
  NotAllowedError:['没有获得读取权限，请重新授权文件夹或重新选择这篇文献。','Read access was not granted. Reconnect the folder or select this document again.'],
  SecurityError:['文件访问授权已失效，请重新连接文件夹。','File access has expired. Reconnect the folder.'],
  NotFoundError:['原文件可能已移动或删除，请重新定位文献。','The file may have moved or been deleted. Locate it again.'],
  NotReadableError:['文件暂时无法读取。如果文件在网盘中，请先下载到本机；也可以重新选择文件。','The file cannot be read. Download cloud files to this device first, or select the file again.'],
  InvalidStateError:['文件读取期间发生变化，请重试或重新选择文件。','The file changed while being read. Retry or select it again.'],
 };
 return messages[error?.name]?.[english?1:0] || (english?'Unable to open this document. Check that the file is complete and, for PDFs, whether a password is required.':'无法打开文献，请检查文件是否完整，或 PDF 是否需要密码。');
}
