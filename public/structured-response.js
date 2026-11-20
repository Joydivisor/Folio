// One bounded repair attempt for malformed model output; never execute or guess code.
export async function requestStructured(ask,prompt,parse,{signal,onRepair=()=>{}}={}){
 if(signal?.aborted)throw new DOMException('已停止','AbortError');
 const raw=await ask([{role:'user',content:prompt}]);
 if(signal?.aborted)throw new DOMException('已停止','AbortError');
 try{return parse(raw,{attempt:0});}catch(error){
  if(signal?.aborted)throw error;
  onRepair();
  const messages=[{role:'user',content:prompt}];
  if(typeof raw==='string'&&raw.trim())messages.push({role:'assistant',content:raw.slice(0,40000)});
  messages.push({role:'user',content:'校验问题：'+String(error.message).slice(0,300)+'。请按本次指定格式重新生成一个完整、精简的 JSON 对象。保留原文参数，补全必填字段并修正上述问题。数学反斜杠须按 JSON 转义，也可用 Unicode 数学符号。'});
  const repaired=await ask(messages);
  if(signal?.aborted)throw new DOMException('已停止','AbortError');
  return parse(repaired,{attempt:1});
 }
}
