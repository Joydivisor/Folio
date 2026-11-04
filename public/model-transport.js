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
