import {PROVIDERS,normalizeEndpoint,providerFor} from './model-providers.js';
import {extractCredential} from './credential-input.js';
import {ui,node} from './workspace-ui.js';
const $=id=>document.getElementById(id);
export function setupModelSettings({getSettings,onSaved,onStatus}){
 const desktop=window.folioDesktop,sessions=new Map(),statuses=new Map();let busy=false,epoch=0,serverKey=false;
 let profiles={};try{profiles=JSON.parse(localStorage.getItem('folio-provider-profiles')||'{}');}catch{}
 if(!profiles||typeof profiles!=='object'||Array.isArray(profiles))profiles={};
 function form(){return {imageInput:$('imageInput').value,baseUrl:normalizeEndpoint($('baseUrl').value),model:$('modelName').value.trim(),thinking:$('thinkingMode').checked,workspaceId:$('providerSelect').value==='anthropic'?$('providerWorkspaceId').value.trim():'',apiKey:extractCredential($('apiKey').value)};}
 function address(){try{return normalizeEndpoint($('baseUrl').value);}catch{return '';}}
 function activeStatus(url,status){statuses.set(url,status);if(normalizeEndpoint(getSettings().baseUrl)===url)onStatus(status);}
 function reportStatus(url){
  const s=statuses.get(url)||{};
  $('credentialStatus').textContent=s.error?ui('已保存的密钥无法解锁，请重新输入或检查系统密钥库。原文件已保留。','The saved key could not be unlocked. Re-enter it or check the system keyring. The original file was kept.'):s.persisted?ui('已加密保存 · 重启后自动连接；输入框留空即可','Encrypted on this device · reconnects after restart; leave the key field empty'):s.configured?ui('仅本次运行有效 · 关闭后需要重新填写','Session only · re-enter after closing'):serverKey&&url==='https://api.deepseek.com'?ui('本机服务已托管密钥','Key managed by the local server'):ui('尚未配置此服务的密钥','No key configured for this service');
  $('apiKey').placeholder=s.configured?ui('已配置；留空保留，粘贴可替换','Configured; leave empty to keep, paste to replace'):ui('粘贴此服务的 API Key','Paste this provider’s API key');
  $('forgetKey').disabled=!s.configured&&!s.error;
 }
 async function status(url,token=epoch){
  let s=desktop?await desktop.keyStatus(url):{configured:Boolean(sessions.get(url)),persisted:false};activeStatus(url,s);
  if(token===epoch&&url===address()){$('rememberKey').checked=s.configured?s.persisted:true;reportStatus(url);}
  return s;
 }
 function fillModels(url,selected){
  const options=profiles[url]?.models||[];$('availableModels').replaceChildren();
  if(selected&&!options.some(m=>m.id===selected))$('availableModels').append(node('option',selected+ui(' · 未验证',' · not verified'),{value:selected}));
  for(const m of options)$('availableModels').append(node('option',m.name===m.id?m.id:m.name+' · '+m.id,{value:m.id}));
  if(!$('availableModels').options.length)$('availableModels').append(node('option',ui('先连接以获取模型','Connect to load models'),{value:''}));
  $('availableModels').value=selected||$('availableModels').options[0].value;$('modelName').value=$('availableModels').value;
  $('modelListHint').textContent=options.length?ui('来自服务商的模型列表。实际调用取决于权限、余额与接口兼容性。','Provider-listed models. Access, credit and API compatibility are verified by a test call.'):ui('连接后读取模型列表；不支持列表的服务可手动填写模型 ID。','Connect to retrieve models, or enter a model ID in Advanced settings.');
 }
 function providerFields(){const p=PROVIDERS.find(p=>p.id===$('providerSelect').value);$('baseUrl').readOnly=p.id!=='custom';$('connectionAdvanced').open=p.id==='custom';$('thinkingRow').hidden=p.id!=='deepseek';$('workspaceIdRow').hidden=p.id!=='anthropic';if(p.id!=='deepseek')$('thinkingMode').checked=false;$('providerDestination').textContent=p.id==='custom'?ui('自定义服务 · 请确认下方地址属于你的服务商','Custom service · check the destination in Advanced settings'):p.baseUrl.replace('https://','');}
 async function open(){const s=getSettings(),token=++epoch;$('providerSelect').value=providerFor(s.baseUrl).id;$('baseUrl').value=s.baseUrl;$('apiKey').value='';$('thinkingMode').checked=s.thinking;$('imageInput').value=s.imageInput||'auto';$('providerWorkspaceId').value=s.workspaceId||'';providerFields();fillModels(normalizeEndpoint(s.baseUrl),s.model);$('connectionResult').textContent='';try{await status(normalizeEndpoint(s.baseUrl),token);}catch{$('credentialStatus').textContent=ui('无法读取密钥状态，请重新打开设置。','Could not read key status. Reopen settings.');}}
 $('providerSelect').replaceChildren(...PROVIDERS.map(p=>node('option',p.id==='custom'?ui('自定义 · OpenAI 兼容','Custom · OpenAI compatible'):p.name,{value:p.id})));
 $('providerSelect').onchange=async()=>{const token=++epoch,p=PROVIDERS.find(p=>p.id===$('providerSelect').value);$('apiKey').value='';$('baseUrl').value=p.baseUrl;$('providerWorkspaceId').value=profiles[p.baseUrl]?.workspaceId||'';$('connectionResult').textContent='';providerFields();fillModels(p.baseUrl,profiles[p.baseUrl]?.model||p.model);$('imageInput').value=profiles[p.baseUrl]?.imageInput||'auto';$('rememberKey').checked=true;$('credentialStatus').textContent=ui('尚未配置此服务的密钥','No key configured for this service');if(p.baseUrl)try{await status(p.baseUrl,token);}catch{};};
 $('baseUrl').oninput=()=>{++epoch;$('apiKey').value='';$('modelName').value='';$('connectionResult').textContent='';fillModels(address(),'');$('credentialStatus').textContent=ui('地址已更改，请为该地址配置密钥','Destination changed. Configure a key for this address.');};
 $('baseUrl').onchange=()=>{const url=address();if(url)status(url).catch(()=>{});};
 $('availableModels').onchange=()=>{$('modelName').value=$('availableModels').value;};
 $('modelName').onchange=()=>{const url=address();fillModels(url,$('modelName').value.trim());};
 $('apiKey').addEventListener('paste',e=>{const value=e.clipboardData?.getData('text');if(!value)return;e.preventDefault();try{$('apiKey').value=extractCredential(value);$('connectionResult').textContent=ui('密钥已识别，点击「连接并获取模型」。','Key detected. Choose Connect & load models.');}catch(error){$('apiKey').value='';$('connectionResult').textContent=error.message;}});
 async function saveKey(config){
  if(desktop){const s=await desktop.saveKey(config.apiKey,$('rememberKey').checked,config.baseUrl);activeStatus(config.baseUrl,s);$('apiKey').value='';reportStatus(config.baseUrl);return {...config,apiKey:''};}
  if(config.apiKey)sessions.set(config.baseUrl,config.apiKey);activeStatus(config.baseUrl,{configured:Boolean(sessions.get(config.baseUrl)),persisted:false});reportStatus(config.baseUrl);return {...config,apiKey:sessions.get(config.baseUrl)||''};
 }
 async function loadModels(){const requestEpoch=epoch;const config=await saveKey(form());const result=desktop?await desktop.listModels(config):await fetch('/api/models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;});if(requestEpoch!==epoch)throw Error(ui('设置已切换，旧请求已忽略。','Settings changed; the old response was ignored.'));const old=profiles[config.baseUrl]||{};profiles[config.baseUrl]={...old,models:result.models};fillModels(config.baseUrl,result.models.some(m=>m.id===config.model)?config.model:result.models[0]?.id||config.model);$('connectionResult').textContent=result.models.length?ui('已获取 ','Loaded ')+result.models.length+ui(' 个模型。选择后保存即可使用。',' models. Choose one and save to use it.'):ui('未找到适用的文本模型，请在高级设置中填写模型 ID。','No suitable text models found. Enter a model ID in Advanced settings.');}
 async function locked(fn){if(busy)return;busy=true;const controls=['imageInput','providerSelect','baseUrl','apiKey','rememberKey','availableModels','modelName','thinkingMode','providerWorkspaceId','testConnection','connectModels','saveModelSettings','importKey','forgetKey'].map($);const states=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);try{return await fn();}finally{controls.forEach((el,i)=>el.disabled=states[i]);busy=false;reportStatus(address());}}
 $('connectModels').onclick=()=>locked(loadModels).catch(e=>$('connectionResult').textContent=e.message);
 async function save(){const requestEpoch=epoch;let config=await saveKey(form());if(!config.model){await loadModels();config=await saveKey(form());}if(!config.model)throw Error('请选择模型，或在高级设置中填写模型 ID。');if(requestEpoch!==epoch)throw Error(ui('设置已关闭，未切换当前模型。','Settings closed; the active model was kept.'));profiles[config.baseUrl]={imageInput:config.imageInput,model:config.model,workspaceId:config.workspaceId,models:profiles[config.baseUrl]?.models||[]};localStorage.setItem('folio-provider-profiles',JSON.stringify(profiles));onSaved(config);return config;}
 $('settingsForm').onsubmit=e=>{e.preventDefault();if(document.querySelector('[data-pref-panel=ai]').hidden)return;locked(async()=>{await save();$('settingsDialog').close();}).catch(e=>$('connectionResult').textContent=e.message);};
 $('testConnection').onclick=()=>locked(async()=>{const config=await saveKey(form());if(!config.model)throw Error(ui('先选择模型。','Choose a model first.'));$('connectionResult').textContent=ui('正在验证模型调用…','Testing model access…');const messages=[{role:'user',content:'Reply with OK.'}];let content;if(desktop)content=await desktop.requestAI({id:crypto.randomUUID(),config,messages});else{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...config,messages})});const data=await response.json();if(!response.ok)throw Error(data.error);content=data.content;}$('connectionResult').textContent=ui('调用成功 · ','Verified · ')+config.model;}).catch(e=>$('connectionResult').textContent=e.message);
 $('desktopKeyOptions').hidden=!desktop;
 $('keyPrivacy').textContent=desktop?ui('密钥由系统密钥库加密，仅用于你选择的服务地址。提问时，问题和相关原文会发送给该服务商。','Keys are encrypted with the OS keyring and bound to the selected endpoint. Questions and relevant source passages are sent to that provider.'):ui('网页版密钥仅在当前页面有效，不写入浏览器存储。需要重启后继续使用，请安装桌面版。','Browser keys last only for this page session. Use the desktop app to save keys securely across restarts.');
 $('importKey').onclick=()=>locked(async()=>{const url=address();if(!url)throw Error('请先填写服务地址。');const s=await desktop.importKey($('rememberKey').checked,url);activeStatus(url,s);$('apiKey').value='';reportStatus(url);}).catch(e=>$('connectionResult').textContent=e.message);
 $('forgetKey').onclick=()=>locked(async()=>{const url=address();activeStatus(url,await desktop.forgetKey(url));$('apiKey').value='';$('rememberKey').checked=true;reportStatus(url);}).catch(e=>$('connectionResult').textContent=e.message);
 $('settingsDialog').addEventListener('close',()=>{$('apiKey').value='';++epoch;});
 return {open,setServerKey(value){serverKey=value;},async ready(){const url=normalizeEndpoint(getSettings().baseUrl);return status(url);}};
}
