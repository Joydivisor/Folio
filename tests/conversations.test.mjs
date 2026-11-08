import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversations,noteTrail,noteRoute} from '../public/conversations.js';
const source={id:'book-a',name:'代数学',page:8,text:'定义σ=(1 2 3)。'};
const answer={title:'三阶循环',paragraphs:[{text:'σ³=e，其阶为3。',sources:[{page:8,quote:source.text}]}]};
test('memory off never archives; each new passage owns a fresh history and rejects late answers',()=>{
 const saved=[],c=createConversations({save:n=>saved.push(n)});const first=c.begin(source,'为何三次回原位');c.complete(first,'为何三次回原位',answer,{kind:'concept'});assert.equal(c.history().length,1);
 const next=c.begin({...source,page:9,text:'另一段'},'交换子是什么');assert.notEqual(first,next);assert.deepEqual(c.history(),[]);assert.equal(c.complete(first,'late',answer,{}),false);c.reset();assert.equal(saved.length,0);
});
test('opt-in archives complete conversations with stable book/page/question route and snapshot isolation',()=>{
 const saved=new Map();let enabled=true;const c=createConversations({enabled:()=>enabled,save:n=>saved.set(n.id,n)}),id=c.begin(source,'σ 的阶');c.complete(id,'σ 的阶',answer,{kind:'permutation'});c.complete(id,'为什么不等于1',answer,{kind:'concept'});c.setArtifact(id,{title:'阶',nodes:[],edges:[]});c.archive();c.archive();assert.equal(saved.size,1);const note=[...saved.values()][0];assert.equal(note.turns.length,2);assert.ok(note.text.includes('为什么不等于1'));assert.ok(note.text.includes('σ 的阶'));assert.equal(note.source.text,source.text);assert.deepEqual(noteTrail(note),['笔记','代数学','第 8 页','σ 的阶']);assert.ok(noteRoute(note).startsWith('#/notes/conversation%3A'));answer.paragraphs[0].text='changed';assert.notEqual(note.turns[0].answer.paragraphs[0].text,'changed');
 c.begin({id:'book-b',name:'生物学',page:2},'光反应');assert.equal(saved.size,1);assert.deepEqual(c.history(),[]);enabled=false;c.complete(c.current.id,'光反应',answer,{});c.reset();assert.equal(saved.size,1);
});
test('empty or cancelled sessions do not create placeholder notes',()=>{const saved=[],c=createConversations({enabled:()=>true,save:n=>saved.push(n)});c.begin(source,'未完成');c.reset();assert.equal(saved.length,0);assert.deepEqual(noteTrail({source:{name:'外部文字',page:'—'},text:'a'}),['笔记','外部文字','手动笔记']);});

test('long same-session history preserves every turn and full text until explicit new chat',()=>{
 const c=createConversations(),id=c.begin(source,'initial');for(let i=0;i<20;i++)c.complete(id,'问题'.repeat(500),{title:'回答',paragraphs:[{text:'解释'.repeat(3000),sources:[]}]},{});
 assert.equal(c.history().length,20);assert.equal(c.history()[0].question.length,1000);assert.equal(c.history()[0].answer.length,6000);
 assert.equal(c.ensure({id:'biology',name:'生物',page:1},'ATP'),id);assert.equal(c.history().length,20);c.reset();c.ensure(source,'New chat');assert.deepEqual(c.history(),[]);
});
