const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const DEFAULT='https://api.deepseek.com';
function endpoint(value=DEFAULT){
 const url=new URL(value);
 if((url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))||url.username||url.password||url.search||url.hash)throw Error('请输入 HTTPS 服务地址，或本机 HTTP 地址');
 const result=url.origin+url.pathname.replace(/\/+$/,'');
 return /^https:\/\/api\.deepseek\.com(?:\/v1)?$/.test(result)?DEFAULT:result;
}
function officialEndpoint(value){const normalized=endpoint(value);if(normalized!==DEFAULT)throw Error('本机托管密钥只可用于 DeepSeek 官方地址。');return new URL(value).origin+new URL(value).pathname.replace(/\/$/,'');}
function createVault(directory,crypto){
 const records=new Map(),legacy=path.join(directory,'deepseek-key.bin');
 const protectedBackend=()=>!['basic_text','unknown'].includes(crypto.getSelectedStorageBackend?.());
 const file=url=>path.join(directory,'provider-'+createHash('sha256').update(url).digest('hex')+'.bin');
 const record=url=>records.get(url)||{key:'',persisted:false};
 const status=(value=DEFAULT)=>{const r=record(endpoint(value));return {configured:Boolean(r.key),persisted:r.persisted,...(r.error?{error:r.error}:{})};};
 let queue=Promise.resolve();
 const serialize=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 return {
  status,
  load(value=DEFAULT){return serialize(async()=>{
   const url=endpoint(value);if(records.has(url))return status(url);
   let bytes,old=false;
   try{bytes=await fs.readFile(file(url));}catch(e){if(e.code!=='ENOENT'){records.set(url,{key:'',persisted:false,error:'unlock'});return status(url);}if(url===DEFAULT)try{bytes=await fs.readFile(legacy);old=true;}catch(e){if(e.code!=='ENOENT'){records.set(url,{key:'',persisted:false,error:'unlock'});return status(url);}}}
   if(!bytes)return status(url);
   if(!protectedBackend()){records.set(url,{key:'',persisted:false,error:'unavailable'});return status(url);}
   try{const decrypted=await crypto.decryptStringAsync(bytes);const raw=typeof decrypted==='string'?decrypted:decrypted?.result;const data=old?{endpoint:url,key:raw}:JSON.parse(raw);if(data.endpoint!==url||typeof data.key!=='string'||!data.key||data.key.length>2048)throw Error('Invalid credential record');records.set(url,{key:data.key,persisted:true});}
   catch{records.set(url,{key:'',persisted:false,error:'unlock'});}
   return status(url);
  });},
  save(value,remember,address=DEFAULT){return serialize(async()=>{
   const url=endpoint(address),previous=record(url);
   if(typeof value!=='string'||value.length>2048||/[\r\n]/.test(value))throw Error('密钥格式不正确。');
   if(!value.trim()&&previous.error)throw Error('无法解锁已保存的密钥。请重新输入密钥，或先清除该服务的密钥。');
   const next=value.trim()||previous.key;
   if(remember&&next){
    if(!protectedBackend()||!await crypto.isAsyncEncryptionAvailable())throw Error('系统密钥库不可用；请取消本机保存，仅在本次运行使用。');
    const encrypted=await crypto.encryptStringAsync(JSON.stringify({endpoint:url,key:next}));
    await fs.writeFile(file(url)+'.tmp',encrypted,{mode:0o600});await fs.rename(file(url)+'.tmp',file(url));
   }else await fs.rm(file(url),{force:true});
   if(url===DEFAULT)await fs.rm(legacy,{force:true});
   records.set(url,{key:next,persisted:Boolean(remember&&next)});return status(url);
  });},
  forget(address=DEFAULT){return serialize(async()=>{const url=endpoint(address);await fs.rm(file(url),{force:true});if(url===DEFAULT)await fs.rm(legacy,{force:true});records.delete(url);return status(url);});},
  config(config){const url=endpoint(config.baseUrl);return {baseUrl:url,model:String(config.model||'').slice(0,200),thinking:Boolean(config.thinking),workspaceId:String(config.workspaceId||'').slice(0,200),maxTokens:Math.max(256,Math.min(16384,Math.trunc(Number(config.maxTokens)||4096))),answerLanguage:['en','zh-CN'].includes(config.answerLanguage)?config.answerLanguage:'auto',...(config.responseFormat==='json'?{responseFormat:'json'}:{}),apiKey:record(url).key};},
 };
}
module.exports={createVault,officialEndpoint,endpoint};
