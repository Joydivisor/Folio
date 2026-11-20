import test from 'node:test';
import assert from 'node:assert/strict';
import {OUTPUT_COMMANDS} from '../public/output-commands.js';
import {outputSystemInstruction} from '../public/output-system.js';
import {generateReading,parseReading} from '../public/reading-response.js';
import {createConversations} from '../public/conversations.js';
import {documentResult} from './beta10-fixtures.mjs';
import {outputCases,fixtureFor} from './output-mode-cases.mjs';

const byMode=Object.fromEntries(outputCases.map(c=>[c.mode,c]));
const plain=fixtureFor(byMode.explain);
test('every menu item uses its own schema on both attempts and delivers the requested data',async t=>{
 assert.deepEqual(OUTPUT_COMMANDS.map(c=>c.id),outputCases.map(c=>c.mode));
 for(const example of outputCases)await t.test(example.mode,async()=>{
  const {mode,selection,question}=example,context={excerpts:[{page:1,text:selection}]};
  const contract=outputSystemInstruction(mode);
  assert.ok(contract.includes('/'+mode+'（'));assert.ok(contract.includes(example.kind));
  let requests=0;
  const result=await generateReading(async(messages,selected)=>{
   assert.equal(selected,mode);assert.deepEqual(JSON.parse(messages[0].content).document_context.excerpts,context.excerpts);
   if(++requests===1)return mode==='explain'?'{':JSON.stringify(plain);
   assert.equal(messages.length,3);return JSON.stringify(fixtureFor(example));
  },selection,context,{outputMode:mode,question});
  assert.equal(requests,2);assert.equal(result.plan.kind,example.kind);
  assert.equal(result.answer.paragraphs[0].sources[0].quote,selection);example.check(result);
 });
});

test('explicit outputs never accept an invalid repair, and transport failures do not trigger a format retry',async()=>{
 for(const [mode,value] of [['compare',plain],['concept',{...plain,kind:'concept'}],['derive',{...plain,kind:'derivation',steps:[]}],['diagram',{...plain,kind:'document',blocks:[{id:'b1',type:'text',text:'No diagram'}]}],['steps',{...plain,kind:'clarify',explanation:{...plain.explanation,nextQuestion:'  '}}],['explain',null]]){
  let requests=0;
  await assert.rejects(generateReading(async()=>{requests++;return JSON.stringify(value);},'source',null,{outputMode:mode}),{name:'OutputFormatError'});
  assert.equal(requests,2);
 }
 let requests=0;await assert.rejects(generateReading(async()=>{requests++;throw Error('HTTP 401');},'source',null,{outputMode:'diagram'}),/401/);assert.equal(requests,1);
});

test('recover single fenced JSON, nested plan envelopes, inline concept graph and an existing introduction',()=>{
 const {visual,...base}=fixtureFor(byMode.concept);
 const nested={plan:{...base,kind:'concept',graph:visual},explanation:'这是对象间的特例关系。'};
 const fenced='Here is the result:\n```JSON\n'+JSON.stringify(nested)+'\n```';
 const result=parseReading(fenced,[],{outputMode:'concept'});assert.deepEqual(result.visual.edges,visual.edges);assert.equal(result.answer.paragraphs[0].text,nested.explanation);
 const onlyPlan={...fixtureFor(byMode.compare),kind:'compare',explanation:undefined};
 assert.equal(parseReading(JSON.stringify(onlyPlan),[],{outputMode:'compare'}).answer.paragraphs[0].text,onlyPlan.reason);
 assert.throws(()=>parseReading(fenced+'\n'+fenced,[],{outputMode:'concept'}));
 const mixed=parseReading(JSON.stringify(documentResult),[],{outputMode:'compare'});assert.equal(mixed.plan.blocks[2].display.kind,'comparison');
 const bad=structuredClone(documentResult);bad.blocks[1].display.diagram.edges[1].label='';
 assert.throws(()=>parseReading(JSON.stringify(bad),[],{outputMode:'diagram'}),/标签/);
});

test('short introductions keep the requested visual, while an explicit prose-only question overrides it',async()=>{
 for(const [question,mode] of [['请只用文字解释这个立方体。','explain'],['Text only, please.','explain'],['Use two sentences to introduce this cube, then show the rotation.','3d'],['不用表格，演示立方体的旋转。','3d']]){
  const result=await generateReading(async(messages,id)=>{assert.equal(id,mode);assert.equal(JSON.parse(messages[0].content).requested_output,id);return JSON.stringify(fixtureFor(byMode['3d']));},'立方体',{excerpts:[]},{question,outputMode:'3d'});
  assert.equal(result.plan.kind,mode==='3d'?'geometry':'explain');
 }
});

test('questions with no selection, contradictory parameters and explicit clarification',async()=>{
 const tetra={...plain,kind:'tetrahedron',object:'正四面体',operation:'vertex'};
 assert.equal((await generateReading(async()=>JSON.stringify(tetra),'',null,{question:'演示正四面体绕顶点轴旋转',outputMode:'3d'})).plan.kind,'tetrahedron');
 const wrong={...fixtureFor(byMode['3d']),shape:'sphere'};
 let requests=0;await assert.rejects(generateReading(async()=>{requests++;return JSON.stringify(wrong);},byMode['3d'].selection,null,{outputMode:'3d'}),{name:'OutputFormatError'});assert.equal(requests,2);
 const wrongPerm={...fixtureFor(byMode.visualize),sigma:[3,1,2]};
 await assert.rejects(generateReading(async()=>JSON.stringify(wrongPerm),byMode.visualize.selection,null,{outputMode:'visualize'}),{name:'OutputFormatError'});
 const question='Which axis did you measure?',clarify={...plain,kind:'clarify',explanation:{...plain.explanation,nextQuestion:question}};
 const result=await generateReading(async()=>JSON.stringify(clarify),'原文缺少旋转轴。',null,{question:'Draw the measured 3D rotation.',outputMode:'3d'});
 assert.equal(result.answer.nextQuestion,question);
 const chat=createConversations();const token=chat.ensure({text:'cube'},'Draw');chat.complete(token,'Draw',result.answer,result.plan,{pendingOutput:'3d'});
 const restored=createConversations();restored.restore(chat.current);assert.equal(restored.current.turns.at(-1).pendingOutput,'3d');assert.equal(restored.history().at(-1).nextQuestion,question);
});

test('empty truncated reply gets one compact repair with the original images and no empty assistant block',async()=>{
 const image={image:'data:image/png;base64,AA==',label:'figure'},controller=new AbortController();let first;
 await generateReading(async(messages)=>{
  if(!first){first=messages[0].content;return '';}
  assert.deepEqual(messages[0].content,first);assert.equal(first.at(-1).image_url.url,image.image);assert.deepEqual(messages.map(m=>m.role),['user','user']);return JSON.stringify(plain);
 },'image',null,{outputMode:'explain',images:[image]});
 let calls=0;
 await assert.rejects(generateReading(async()=>{calls++;controller.abort();return '{';},'text',null,{outputMode:'compare',signal:controller.signal}),{name:'AbortError'});assert.equal(calls,1);
});
