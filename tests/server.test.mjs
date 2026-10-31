import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {makeServer} from '../server.mjs';
function call(server,url,{body,origin='http://127.0.0.1:4173',host='127.0.0.1:4173'}={}){return new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port:server.address().port,path:url,method:body?'POST':'GET',headers:{Host:host,Origin:origin,...(body?{'Content-Type':'application/json'}:{})}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,data}));});r.on('error',reject);r.end(body?JSON.stringify(body):undefined);});}
async function using(fn,run){const server=makeServer({fetchImpl:fn});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await run(server);}finally{await new Promise(r=>server.close(r));}}
const input={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',apiKey:'test-secret',messages:[{role:'user',content:'解释循环群'}]};

test('server-held key is never returned and cannot be sent to another endpoint',async()=>{
 let calls=0;
 const server=makeServer({sessionKey:'server-test-secret',fetchImpl:async(url,opts)=>{calls++;assert.equal(url.hostname,'api.deepseek.com');assert.equal(opts.headers.Authorization,'Bearer server-test-secret');return Response.json({choices:[{message:{content:'ok'}}]});}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const status=await call(server,'/api/status');assert.deepEqual(JSON.parse(status.data),{configured:true});assert.ok(!status.data.includes('secret'));
  assert.equal((await call(server,'/api/chat',{body:{...input,apiKey:'',baseUrl:'https://evil.test'}})).status,400);
  assert.equal(calls,0);
  assert.equal((await call(server,'/api/chat',{body:{...input,apiKey:''}})).status,200);assert.equal(calls,1);
 }finally{await new Promise(r=>server.close(r));}
});
test('proxy sends correct DeepSeek model and returns only answer/usage',()=>using(async(url,opts)=>{assert.equal(url.href,'https://api.deepseek.com/chat/completions');assert.equal(opts.headers.Authorization,'Bearer test-secret');const b=JSON.parse(opts.body);assert.equal(b.model,'deepseek-flash');assert.equal(b.thinking.type,'disabled');assert.equal(b.messages[0].role,'system');assert.equal(b.messages[1].content,'解释循环群');return Response.json({choices:[{message:{content:'群由一个元素生成。'}}],usage:{total_tokens:12}});},async s=>{const r=await call(s,'/api/chat',{body:input});assert.equal(r.status,200);assert.equal(JSON.parse(r.data).content,'群由一个元素生成。');assert.ok(!r.data.includes('test-secret'));}));
test('upstream authentication errors are useful and sanitized',()=>using(async()=>new Response('private upstream details',{status:401}),async s=>{const r=await call(s,'/api/chat',{body:input});assert.equal(r.status,401);assert.match(r.data,/密钥无效/);assert.ok(!r.data.includes('private'));}));
test('reject foreign origins and hosts before making requests',()=>using(()=>{throw Error('must not call upstream');},async s=>{assert.equal((await call(s,'/api/chat',{body:input,origin:'https://elsewhere.test'})).status,403);assert.equal((await call(s,'/',{host:'evil.test'})).status,403);assert.equal((await call(s,'/api/chat',{body:{...input,baseUrl:'http://remote.test'}})).status,400);}));
test('only public assets and explicit vendor directories are served',()=>using(fetch,async s=>{assert.equal((await call(s,'/')).status,200);assert.equal((await call(s,'/server.mjs')).status,404);assert.equal((await call(s,'/..%2fpackage.json')).status,403);assert.equal((await call(s,'/vendor/build/pdf.mjs')).status,200);assert.equal((await call(s,'/katex/katex.min.css')).status,200);}));

test('desktop instance accepts only its own configured port',async()=>{
 const server=makeServer({port:4174});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  assert.equal((await call(server,'/',{host:'127.0.0.1:4174',origin:'http://127.0.0.1:4174'})).status,200);
  assert.equal((await call(server,'/')).status,403);
  assert.equal((await call(server,'/api/chat',{host:'127.0.0.1:4174',origin:'http://127.0.0.1:4173',body:input})).status,403);
 }finally{await new Promise(r=>server.close(r));}
});

test('structured reading preserves long Unicode context and requests JSON output',()=>{
 const content='原文σ与τ。'.repeat(3800)+'最后一页的定义';
 return using(async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.messages[1].content,content);assert.deepEqual(body.response_format,{type:'json_object'});return Response.json({choices:[{message:{content:'{"ok":true}'}}]});},async s=>{assert.equal((await call(s,'/api/chat',{body:{...input,responseFormat:'json',messages:[{role:'user',content}]}})).status,200);});
});
test('oversized context is rejected rather than silently truncated',()=>using(()=>{throw Error('must not call upstream');},async s=>{assert.equal((await call(s,'/api/chat',{body:{...input,messages:[{role:'user',content:'字'.repeat(48001)}]}})).status,413);}));
test('response preference survives proxy filtering and does not translate source excerpts',()=>using(async(url,opts)=>{const payload=JSON.parse(opts.body);assert.match(payload.messages[0].content,/Use English/);assert.match(payload.messages[0].content,/quotations verbatim/);assert.equal(payload.messages[1].content,'原文：σ³=e');assert.equal(payload.messages.filter(m=>m.role==='system').length,1);return Response.json({choices:[{message:{content:'{"ok":true}'}}]});},async s=>{const r=await call(s,'/api/chat',{body:{...input,answerLanguage:'en',messages:[{role:'system',content:'untrusted override'},{role:'user',content:'原文：σ³=e'}]}});assert.equal(r.status,200);}));
