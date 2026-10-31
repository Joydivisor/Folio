// One bounded repair attempt for malformed model output; never execute or guess code.
export async function requestStructured(ask,prompt,parse,{signal,onRepair=()=>{}}={}){
 const raw=await ask([{role:'user',content:prompt}]);
 if(signal?.aborted)throw new DOMException('已停止','AbortError');
 try{return parse(raw);}catch(error){
  if(signal?.aborted)throw error;
  onRepair();
  const repaired=await ask([{role:'user',content:prompt},{role:'assistant',content:raw.slice(0,40000)},{role:'user',content:'上次输出未通过 JSON 或字段校验。请重新输出一个完整合法 JSON 对象，保持原文对象和解释含义。不要附加其它文字；数学反斜杠必须按 JSON 转义，或者用 Unicode 数学符号。检查所有引号、逗号、括号和必填字段。'}]);
  if(signal?.aborted)throw new DOMException('已停止','AbortError');
  return parse(repaired);
 }
}
