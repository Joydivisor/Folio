// Inspect only text explicitly pasted or submitted by the user. Never read the clipboard in the background.
export function extractCredential(value){
 const text=String(value||'').trim();
 if(!text)return '';
 if(text.length>16384)throw Error('粘贴内容过长，请只复制密钥。');
 const keys=[...new Set(text.match(/\bsk-[A-Za-z0-9_-]{20,512}\b/g)||[])];
 if(keys.length>1)throw Error('发现多个密钥，请只保留要使用的一个。');
 if(keys.length===1)return keys[0];
 if(text.length<=512&&/^[A-Za-z0-9_-]+$/.test(text)&&text.length>=16)return text;
 throw Error('没有识别到完整密钥，请重新复制。');
}
