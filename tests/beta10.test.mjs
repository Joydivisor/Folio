import test from 'node:test';
import assert from 'node:assert/strict';
import {diagram,anatomy,documentResult,answer} from './beta10-fixtures.mjs';
import {parseReading,requestReading} from '../public/reading-response.js';
import {parseDisplayPlan} from '../public/display-plan.js';
import {anatomyPositions} from '../public/anatomy-plan.js';
import {preferredReadingKind} from '../public/reading-intent.js';
import {geometryMesh,rigidPoints} from '../public/geometry-model.js';
import {rotate} from '../public/geometry.js';
import {modelRequest,modelContent,unsupportedJsonFormat} from '../public/model-transport.js';
import {createArtifact} from '../public/artifact-history.js';
import {makeBackup,readBackup,TABLES} from '../public/workspace-store.js';
import {originalStudyNote} from '../public/study-note.js';
import {makeServer} from '../server.mjs';
import {sameArtifactParameters} from '../public/artifact-parameters.js';
import http from 'node:http';

test('short prose wins, mixed documents preserve ordered blocks and reject executable displays',()=>{
 for(const q of ['不要图，两句话解释这个流程','Explain the process in two sentences','这个概念是什么意思？'])assert.ok([null,'explain'].includes(preferredReadingKind(q)),q);
 const result=parseReading(JSON.stringify(documentResult),[],{strictPlan:true,question:'在画布里写一份笔记'});assert.equal(result.plan.presentation,undefined);assert.deepEqual(result.plan.blocks.map(b=>b.id),['intro','flow','compare','closing']);
 const bad=structuredClone(documentResult);bad.blocks[1].display={kind:'javascript',code:'alert(1)'};assert.throws(()=>parseDisplayPlan(bad));bad.blocks[1].display=documentResult;assert.throws(()=>parseDisplayPlan(bad));
 assert.match(originalStudyNote(result).markdown,/误差达标/);
});
test('visual outputs are accepted without activation words, while prose preferences and view size remain independent',()=>{
 const geometry={kind:'geometry',object:'立方体的顶点对应',reason:'用旋转辨认顶点的对应关系',shape:'cube',axis:[0,0,1],angle:90,explanation:answer};
 for(const [value,question]of [[diagram,'误差没达标时怎么继续？'],[anatomy,'滑块移动后与导轨的位置关系是什么？'],[geometry,'绕竖直轴转动后哪些顶点重合？'],[documentResult,'解释迭代过程，并比较两种停止条件']]){
  const response=parseReading(JSON.stringify(value),[],{strictPlan:true,question});assert.equal(response.plan.kind,value.kind);assert.equal(response.plan.presentation,undefined);
 }
 const visual=JSON.stringify(anatomy);assert.equal(parseReading(visual,[],{strictPlan:true,question:'只用文字解释部件关系'}).plan.kind,'explain');
 const simple={kind:'explain',object:'元素的阶',reason:'用定义即可说明',explanation:answer};
 for(const question of ['什么是元素的阶？','用画布解释元素的阶','整理一份元素的阶的笔记']){const response=parseReading(JSON.stringify(simple),[],{strictPlan:true,question});assert.equal(response.plan.kind,'explain');assert.equal(response.plan.presentation,undefined);}
});
test('targeted edits preserve all other nodes, edges, prose and controls, and cannot be triggered by a why question',()=>{
 const v=parseReading(JSON.stringify(diagram));const edit={kind:'edit',edits:[{target:'node',id:'check',changes:{label:'误差满足要求？'}}]};
 const r=parseReading(JSON.stringify(edit),[],{artifact:v,question:'把判断节点改成误差满足要求'});
 assert.equal(r.plan.diagram.nodes[1].label,'误差满足要求？');assert.deepEqual(r.plan.diagram.nodes[2],v.plan.diagram.nodes[2]);assert.deepEqual(r.plan.diagram.edges,v.plan.diagram.edges);assert.deepEqual(r.answer,v.answer);
 assert.throws(()=>parseReading(JSON.stringify(edit),[],{artifact:v,question:'为什么要判断误差？'}));
 assert.throws(()=>parseReading(JSON.stringify({kind:'edit',edits:[{target:'node',id:'check',changes:{html:'<script>'}}]}),[],{artifact:v,question:'修改节点'}));
 const req=requestReading('',null,{artifact:{...v,interaction:{selected:2,zoom:1.2}},question:'解释这个节点'});assert.match(req,/"interaction":\{"selected":2/);assert.match(req,/"id":"check"/);
});
test('illustrations clamp controls, preserve source coordinates, reject missing parts and invalid model values',()=>{
 const plan=parseDisplayPlan(anatomy),moved=anatomyPositions(plan.scene,{travel:200});assert.equal(moved.find(p=>p.id==='slide').position[0],60);assert.equal(plan.scene.parts[2].position[0],20);
 for(const value of [NaN,Infinity,-1]){const bad=structuredClone(anatomy);bad.scene.parts[0].size[0]=value;assert.throws(()=>parseDisplayPlan(bad));}
 const bad=structuredClone(anatomy);bad.scene.parts[0].motion={control:'missing',translate:[1,0,0]};assert.throws(()=>parseDisplayPlan(bad));
});
test('text edits retain interaction parameters and cannot address an inherited array property',()=>{
 const before=parseDisplayPlan(anatomy),after=structuredClone(before);after.scene.parts[0].label='固定底座';assert.ok(sameArtifactParameters(before,after));after.scene.parts[0].size[0]=150;assert.equal(sameArtifactParameters(before,after),false);
 const v={plan:{kind:'derivation',object:'证明',reason:'两步',steps:[{title:'第一步',text:'依据',basis:'source',sources:[{page:1,quote:'原文中的依据'}]},{title:'第二步',text:'结论',basis:'deduction',sources:[]}]},answer,visual:null};
 const edited=parseReading(JSON.stringify({kind:'edit',edits:[{target:'step',index:1,changes:{text:'更清楚的结论'}}]}),[],{artifact:v,question:'修改第二步'});assert.deepEqual(edited.plan.steps[0].sources,v.plan.steps[0].sources);assert.ok(sameArtifactParameters(v.plan,edited.plan));
 for(const index of ['__proto__','constructor',-1,1.5])assert.throws(()=>parseReading(JSON.stringify({kind:'edit',edits:[{target:'text',index,changes:{text:'polluted'}}]}),[],{artifact:v,question:'修改文本'}));assert.equal([].text,undefined);
});
test('expanded meshes keep rigid distances and valid faces; custom mesh bounds reject invalid or degenerate geometry',()=>{
 for(const shape of ['sphere','cone','cylinder','cube','tetrahedron','octahedron']){const m=geometryMesh({shape});assert.ok(m.vertices.length<=128&&m.faces.length<=256);assert.ok(m.faces.every(f=>f.every(i=>m.vertices[i])));assert.ok(rigidPoints(m.vertices,m.vertices.map(p=>rotate(p,[1,2,3],.87))));}
 const p={kind:'geometry',object:'三角棱锥',reason:'已给坐标',shape:'mesh',vertices:[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],faces:[[0,1,2],[0,1,3],[0,2,3],[1,2,3]],axis:[0,0,1],angle:90};assert.equal(parseDisplayPlan(p).vertices.length,4);assert.throws(()=>parseDisplayPlan({...p,faces:[[0,1,5]]}));assert.throws(()=>parseDisplayPlan({...p,vertices:[[0,0,0],[1,0,0],[2,0,0]],faces:[[0,1,2]]}));
});
test('new displays and reading preferences survive backup with independent snapshots',async()=>{
 const tables=Object.fromEntries(TABLES.map(t=>[t,[]]));tables.artifacts=[createArtifact({page:2,text:'source'},parseDisplayPlan(documentResult),answer),createArtifact({page:1},parseDisplayPlan(anatomy),answer)];tables.state=[{id:'folio-reading-mode',value:'continuous'},{id:'folio-reader-offsets',value:{book:{page:7,offset:.4}}}];const restored=await readBackup(await makeBackup(tables));assert.deepEqual(restored.artifacts,tables.artifacts);assert.equal(restored.state[1].value.book.offset,.4);
});
test('Claude native and compatible models share presentation data but use the correct envelopes',()=>{
 const config={model:'model-test',apiKey:'fixture',responseFormat:'json',maxTokens:8192},messages=[{role:'user',content:JSON.stringify(anatomy)}];
 const a=modelRequest('https://api.anthropic.com/v1',config,messages,'system');assert.equal(a.endpoint.pathname,'/v1/messages');assert.equal(a.headers['x-api-key'],'fixture');assert.equal(a.payload.system,'system');assert.equal(a.payload.response_format,undefined);assert.deepEqual(a.payload.messages,messages);assert.equal(a.payload.max_tokens,8192);
 assert.equal(modelContent('https://api.anthropic.com/v1',{content:[{type:'thinking',thinking:'hidden'},{type:'text',text:'{"kind":"anatomy"}'}]}),'{"kind":"anatomy"}');
 const o=modelRequest('https://api.openai.com/v1',config,messages,'system');assert.equal(o.payload.max_completion_tokens,8192);assert.equal(o.payload.max_tokens,undefined);assert.equal(o.headers.Authorization,'Bearer fixture');
 assert.equal(unsupportedJsonFormat(400,'response_format json_object is not supported'),true);assert.equal(unsupportedJsonFormat(401,'response_format unsupported'),false);assert.equal(unsupportedJsonFormat(400,'invalid API key'),false);
});
test('proxy extracts native text, retries only unsupported JSON format once, and serves the vendored kit locally',async()=>{
 let calls=0;const server=makeServer({fetchImpl:async(url,opts)=>{calls++;const body=JSON.parse(opts.body);if(url.hostname==='api.anthropic.com'){assert.equal(url.pathname,'/v1/messages');assert.equal(body.system.includes('学习伙伴'),true);return Response.json({content:[{type:'text',text:JSON.stringify(anatomy)}]});}if(body.response_format)return Response.json({error:{message:'response_format is unsupported'}},{status:400});return Response.json({choices:[{message:{content:'ok'}}]});}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const call=(url,body)=>new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:server.address().port,path:url,method:body?'POST':'GET',headers:{Host:'127.0.0.1:4173','Content-Type':'application/json'}},res=>{let text='';res.on('data',s=>text+=s);res.on('end',()=>resolve({status:res.statusCode,text}));});r.on('error',reject);r.end(body?JSON.stringify(body):undefined);});
 try{const input={model:'fixture',messages:[{role:'user',content:'json'}],responseFormat:'json'};const a=await call('/api/chat',{...input,baseUrl:'https://api.anthropic.com/v1'});assert.equal(a.status,200);assert.equal(JSON.parse(JSON.parse(a.text).content).kind,'anatomy');const b=await call('/api/chat',{...input,baseUrl:'https://example.test/v1'});assert.equal(b.status,200);assert.equal(calls,3);assert.equal((await call('/vendor/anatomy/iso-kit.mjs')).status,200);}finally{await new Promise(r=>server.close(r));}
});
