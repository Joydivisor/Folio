// A chat is never shortened to fit a request. Providers enforce their own limits.
export const CHAT_CONTEXT_TOKENS=1_000_000;
export const MAX_REQUEST_BYTES=32*1024*1024;
export const MAX_IMAGE_BYTES=4*1024*1024;
export const OUTPUT_RESERVE=16384;
export function estimateTokens(text=''){
 // Model-independent estimate; not a provider tokenizer or billing count.
 let ascii=0,other=0;for(const c of String(text))c.codePointAt(0)<128?ascii++:other++;
 return Math.ceil(ascii/3+other*1.5);
}
export function contextTokens(messages,system=''){
 let tokens=estimateTokens(system);
 for(const m of messages){tokens+=8;if(typeof m.content==='string')tokens+=estimateTokens(m.content);
  else for(const part of m.content||[])tokens+=part.type==='text'?estimateTokens(part.text):4096;
 }
 return tokens;
}
export function assertContextFits(messages,system='',output=OUTPUT_RESERVE){
 const tokens=contextTokens(messages,system);
 if(tokens+output>CHAT_CONTEXT_TOKENS)throw Object.assign(Error('本次输入预计超过 1M tokens。对话已保留，请用右上角 ＋ 新建聊天，或减少本次材料。'),{status:413});
 return tokens;
}
export function validateMessages(values){
 const messages=[];
 for(const m of values){
  if(!['user','assistant'].includes(m?.role))continue;
  if(typeof m.content==='string'){messages.push({role:m.role,content:m.content});continue;}
  if(!Array.isArray(m.content)||!m.content.length)throw Object.assign(Error('消息内容无效。'),{status:400});
  const content=m.content.map(p=>{
   if(p?.type==='text'&&typeof p.text==='string')return {type:'text',text:p.text};
   const url=p?.image_url?.url;
   if(m.role==='user'&&p?.type==='image_url'&&typeof url==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)&&url.length<=Math.ceil(MAX_IMAGE_BYTES*4/3)+100)return {type:'image_url',image_url:{url,detail:'high'}};
   throw Object.assign(Error('图片需为不超过 4 MB 的本地 PNG、JPEG 或 WebP。'),{status:400});
  });messages.push({role:m.role,content});
 }
 if(!messages.length)throw Object.assign(Error('缺少可发送的消息。'),{status:400});
 return messages;
}
