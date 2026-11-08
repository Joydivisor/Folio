// Presentation schemas are shared; only the HTTP envelope varies by provider.
export const isAnthropic=base=>new URL(base).hostname==='api.anthropic.com';
export function modelHeaders(base,config){
 const headers={'Content-Type':'application/json'};
 if(isAnthropic(base)){headers['anthropic-version']='2023-06-01';if(config.apiKey)headers['x-api-key']=config.apiKey;if(config.workspaceId)headers['anthropic-workspace-id']=String(config.workspaceId).slice(0,200);}
 else if(config.apiKey)headers.Authorization=`Bearer ${config.apiKey}`;
 return headers;
}
export function modelRequest(base,config,messages,system){
 const native=isAnthropic(base),endpoint=new URL(base+(native?'/messages':'/chat/completions')),max=Math.max(256,Math.min(16384,Math.trunc(Number(config.maxTokens)||4096)));
 if(native)messages=messages.map(m=>({...m,content:typeof m.content==='string'?m.content:m.content.map(p=>{if(p.type==='text')return p;const [,media_type,data]=p.image_url.url.match(/^data:(image\/[^;]+);base64,(.+)$/);return {type:'image',source:{type:'base64',media_type,data}};})}));
 const payload=native?{model:config.model,system,messages,max_tokens:max}:{model:config.model,messages:[{role:'system',content:system},...messages],stream:false,max_tokens:max};
 if(!native&&new URL(base).hostname==='api.openai.com'){delete payload.max_tokens;payload.max_completion_tokens=max;}
 if(!native&&config.responseFormat==='json')payload.response_format={type:'json_object'};
 if(new URL(base).hostname==='api.deepseek.com')payload.thinking={type:config.thinking?'enabled':'disabled'};
 return {endpoint,payload,headers:modelHeaders(base,config)};
}
export function modelContent(base,answer){
 const content=isAnthropic(base)?answer.content?.filter(b=>b.type==='text'&&typeof b.text==='string').map(b=>b.text).join('\n'):answer.choices?.[0]?.message?.content;
 return typeof content==='string'?content:'';
}
export function unsupportedJsonFormat(status,body){return [400,422].includes(status)&&/response_format|json_object/i.test(body)&&/unsupported|not.support|unknown|unrecognized|not.allowed|invalid.parameter/i.test(body);}
export function modelError(status,detail=''){
 if([400,413,422].includes(status)&&/context|token.{0,30}(limit|maximum|exceed)|too.long|too.many.tokens/i.test(detail))return '当前模型服务的上下文上限不足以接收本次完整对话。聊天记录已保留，请切换支持更长上下文的模型，或用右上角 ＋ 新建聊天。';
 if([400,413,422].includes(status)&&/image|vision|multimodal/i.test(detail))return '当前模型服务未接受图片输入。请在 AI 设置中选择支持视觉的模型，或切换到「仅本地 OCR」。对话已保留。';
 return status===401?'密钥无效，请检查 API Key。':status===402?'API 余额不足。':status===429?'请求过于频繁，请稍后重试。':`模型服务返回 ${status}，请检查地址、模型名和服务状态。`;
}
