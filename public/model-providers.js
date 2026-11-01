// Presets select destinations, never infer a destination from a secret.
export const PROVIDERS = [
 {id:'deepseek',name:'DeepSeek',baseUrl:'https://api.deepseek.com',model:'deepseek-flash'},
 {id:'openai',name:'OpenAI',baseUrl:'https://api.openai.com/v1',model:''},
 {id:'gemini',name:'Google Gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:''},
 {id:'custom',name:'自定义 · OpenAI 兼容',baseUrl:'',model:''},
];
export function normalizeEndpoint(value){
 const url=new URL(String(value).trim());
 if((url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))||url.username||url.password||url.search||url.hash)throw Error('请输入 HTTPS 服务地址，或本机 HTTP 地址');
 const result=url.origin+url.pathname.replace(/\/+$/,'');
 return /^https:\/\/api\.deepseek\.com(?:\/v1)?$/.test(result)?'https://api.deepseek.com':result;
}
export function providerFor(baseUrl){try{return PROVIDERS.find(p=>p.baseUrl&&p.baseUrl===normalizeEndpoint(baseUrl))||PROVIDERS.at(-1);}catch{return PROVIDERS.at(-1);}}
export function modelOptions(value,baseUrl){
 if(!Array.isArray(value?.data))throw Error('服务没有返回标准模型列表，请在高级设置中填写模型 ID。');
 const provider=providerFor(baseUrl).id,seen=new Set();
 return value.data.filter(m=>{
  if(typeof m?.id!=='string'||!m.id.trim()||m.id.length>200||/[\x00-\x1f]/.test(m.id)||seen.has(m.id))return false;
  seen.add(m.id);
  if(m.output_modalities&&!m.output_modalities.includes('text'))return false;
  if(provider==='openai'&&(!/^(gpt-|o\d|chatgpt-)/.test(m.id)||/image|audio|realtime|transcribe|tts|search|codex|deep-research/.test(m.id)))return false;
  if(provider==='gemini'&&(!m.id.includes('gemini')||/embedding|image|live|tts|robotics/.test(m.id)))return false;
  return true;
 }).slice(0,300).map(m=>({id:m.id,name:typeof m.name==='string'?m.name.slice(0,120):m.id})).sort((a,b)=>a.id.localeCompare(b.id));
}
