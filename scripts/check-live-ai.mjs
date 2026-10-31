import {testCredential} from './test-credential.mjs';
// Explicit manual check only. The supplied credential is never printed or copied.
import {readFile} from 'node:fs/promises';
import {makeServer} from '../server.mjs';
import {parseScene,sceneInstruction} from '../public/geometry.js';
import {parseGraph} from '../public/graph-schema.js';
const apiKey=await testCredential();
if(!apiKey)throw new Error('No recognizable API credential in supplied file.');
const port=4187,server=makeServer({port});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
try{
 for(const check of [
  {name:'connection',prompt:'只回复连接成功',validate:s=>s.includes('连接成功')},
  {name:'concept-graph',prompt:'仅返回JSON结构 {"title":"标题","summary":"说明","nodes":[{"id":"n1","label":"概念","detail":"解释"}],"edges":[{"from":"n1","to":"n2","label":"关系"}]}。用不超过5个节点解释 S3 的导出列，节点id唯一，边仅引用存在节点。',validate:s=>Boolean(parseGraph(s).nodes.length)},
  {name:'3d-scene',prompt:sceneInstruction+'用3D展示正四面体绕顶点旋转和置换的关系。',validate:s=>parseScene(s).operation==='vertex'},
 ]){
  const start=Date.now();
  const r=await fetch(`http://127.0.0.1:${port}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:JSON.stringify({baseUrl:'https://api.deepseek.com',model:'deepseek-flash',apiKey,messages:[{role:'user',content:check.prompt}]}),signal:AbortSignal.timeout(130000)});
  const data=await r.json();let valid=false;try{valid=r.ok&&check.validate(data.content);}catch{}
  console.log(JSON.stringify({check:check.name,http:r.status,valid,elapsedMs:Date.now()-start,usage:data.usage,error:r.ok?undefined:data.error}));
 }
}finally{server.close();server.closeAllConnections();}
