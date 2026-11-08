import test from 'node:test';
import assert from 'node:assert/strict';
import {captureDroppedItems,readDroppedFiles} from '../public/file-drop.js';
import {createConversations,CHAT_STATE_KEY} from '../public/conversations.js';
import {makeBackup,readBackup,TABLES} from '../public/workspace-store.js';
import {assertContextFits,validateMessages,CHAT_CONTEXT_TOKENS} from '../public/chat-context.js';
import {usesVision,withImages} from '../public/vision-input.js';
import {modelRequest,modelError} from '../public/model-transport.js';
import {parseQuiz,gradeQuiz,quizPrompt} from '../public/self-check.js';
import {requestStructured} from '../public/structured-response.js';
import {supportsDocument} from '../public/document-formats.js';
const answer={title:'Answer',paragraphs:[{text:'The order is three.',sources:[]}]};
const image='data:image/png;base64,iVBORw0KGgo=';
test('drop captures all handles before awaiting and traverses nested folders with duplicate basenames',async()=>{
 let captures=0;
 const file=name=>({kind:'file',name,getFile:async()=>({name,size:3})}),folder=(name,children)=>({kind:'directory',name,async*values(){yield* children;}});
 const root=folder('Root',[folder('One',[file('notes.txt')]),folder('Two',[file('notes.txt')]),file('.hidden.txt'),file('ignore.exe')]);
 const captured=captureDroppedItems({items:[{kind:'file',getAsFileSystemHandle(){captures++;return Promise.resolve(root);},getAsFile(){return null;}}]});
 assert.equal(captures,1);const result=await readDroppedFiles(captured,supportsDocument);assert.deepEqual(result.files.map(f=>f.path),['Root/One/notes.txt','Root/Two/notes.txt']);assert.equal(result.skipped,1);
});
test('legacy directory reader consumes more than the first Chromium batch of 100 files',async()=>{
 const all=Array.from({length:205},(_,i)=>({name:i+'.md',isDirectory:false,file:resolve=>resolve({name:i+'.md'})}));let cursor=0;
 const entry={name:'Course',isDirectory:true,createReader(){return {readEntries(resolve){const next=all.slice(cursor,cursor+100);cursor+=100;resolve(next);}};}};
 const result=await readDroppedFiles([{entry}],supportsDocument);assert.equal(result.files.length,205);assert.equal(result.files.at(-1).path,'Course/204.md');
});
test('drop handles empty folders, unreadable files, modern fallback and explicit size bounds',async()=>{
 const bad={kind:'file',name:'lost.pdf',getFile:async()=>{throw Error('offline');}};
 assert.deepEqual((await readDroppedFiles([{handle:Promise.resolve(bad)}],supportsDocument)).errors,['lost.pdf']);
 assert.equal((await readDroppedFiles([{handle:Promise.resolve(null),file:{name:'ok.txt'}}],supportsDocument)).files.length,1);
 await assert.rejects(readDroppedFiles([{file:{name:'a.txt'}},{file:{name:'b.txt'}}],supportsDocument,{limit:1}),/最多/);
 assert.equal((await readDroppedFiles([],supportsDocument)).files.length,0);
});
test('cross-document turns preserve source, restart state, quiz attempts and reject cancelled chat results',async()=>{
 let state;const c=createConversations({onChange:v=>state=v}),first={id:'a',name:'A.pdf',page:1,text:'First source'},token=c.ensure(first,'First');c.complete(token,'First',answer,{kind:'explain'},{source:first});
 const second={id:'b',name:'B.pdf',page:2,text:'Second source'};assert.equal(c.ensure(second,'Second'),token);c.complete(token,'Second',answer,{kind:'explain'},{source:second,context:{excerpts:[{page:2,text:'Second source'}]}});
 const q={type:'blank',question:'The order is ____.',answers:['3'],explanation:'Three steps return to the identity.'};c.updateTurn(token,c.current.turns[1].id,{quiz:q,quizAttempt:{value:'3',correct:true}});
 const backup=await makeBackup({...Object.fromEntries(TABLES.map(t=>[t,[]])),state:[{id:CHAT_STATE_KEY,value:state}]});const restored=createConversations();restored.restore((await readBackup(backup)).state[0].value);
 assert.equal(restored.current.id,token);assert.equal(restored.history()[0].source.id,'a');assert.equal(restored.history()[1].source.id,'b');assert.equal(restored.history()[1].quizAttempt.correct,true);
 restored.reset();assert.equal(restored.complete(token,'Late',answer,{}),false);assert.equal(c.history().length,2);
});
test('1M budget accepts a near-capacity history and refuses overflow without modifying input',()=>{
 assert.equal(CHAT_CONTEXT_TOKENS,1000000);const messages=[{role:'user',content:'a'.repeat(2800000)}],copy=messages[0].content;
 assert.ok(assertContextFits(messages)>900000);assert.equal(messages[0].content,copy);assert.throws(()=>assertContextFits([{role:'user',content:'a'.repeat(3000000)}]),/1M/);
});
test('all user and assistant messages survive validation beyond sixteen turns',()=>{
 const m=Array.from({length:60},(_,i)=>({role:i%2?'assistant':'user',content:String(i)}));assert.deepEqual(validateMessages(m),m);
 assert.equal(validateMessages([{role:'user',content:'字'.repeat(60000)}])[0].content.length,60000);
});
test('vision data reaches both API envelopes and unsafe image sources are rejected',()=>{
 const messages=validateMessages([{role:'user',content:withImages('read the formula',[{image,label:'Page 2'}])}]);
 const openai=modelRequest('https://api.openai.com/v1',{model:'fixture'},messages,'System');assert.equal(openai.payload.messages[1].content[2].image_url.url,image);assert.equal(openai.payload.messages[1].content[2].image_url.detail,'high');
 const claude=modelRequest('https://api.anthropic.com/v1',{model:'fixture'},messages,'System');assert.deepEqual(claude.payload.messages[0].content[2],{type:'image',source:{type:'base64',media_type:'image/png',data:'iVBORw0KGgo='}});
 for(const url of ['https://remote.test/private.png','file:///private.png','data:image/svg+xml;base64,PHN2Zz4='])assert.throws(()=>validateMessages([{role:'user',content:[{type:'image_url',image_url:{url}}]}]),/图片/);
});
test('vision selection supports explicit override and context errors never propose hidden truncation',()=>{
 assert.equal(usesVision({baseUrl:'https://api.deepseek.com',model:'deepseek-flash'}),false);assert.equal(usesVision({imageInput:'vision',baseUrl:'http://localhost:99',model:'custom'}),true);assert.equal(usesVision({imageInput:'ocr',baseUrl:'https://api.anthropic.com/v1',model:'claude'}),false);
 assert.match(modelError(400,'maximum context length exceeded SECRET'),/聊天记录已保留/);assert.ok(!modelError(400,'maximum context length exceeded SECRET').includes('SECRET'));assert.match(modelError(400,'image not supported'),/视觉/);
});
test('quiz validation accepts both kinds, grades aliases and rejects ambiguous or invalid schemas',()=>{
 const choice={type:'choice',question:'Order?',options:['2','3','4'],correctIndex:1,explanation:'The third power first returns to the identity.'},blank={type:'blank',question:'The order is ____.',answers:['3','three'],explanation:'Three operations.'};
 assert.equal(gradeQuiz(parseQuiz(JSON.stringify(choice),'choice'),1),true);assert.equal(gradeQuiz(choice,0),false);assert.equal(gradeQuiz(parseQuiz(JSON.stringify(blank),'blank'),'  THREE '),true);assert.equal(gradeQuiz(blank,'-3'),false);
 assert.throws(()=>parseQuiz(JSON.stringify({...choice,options:['a','a']}),'choice'));
 assert.throws(()=>parseQuiz(JSON.stringify({...choice,correctIndex:9}),'choice'));assert.throws(()=>parseQuiz(JSON.stringify({...blank,question:'Missing blank'}),'blank'));
 assert.match(quizPrompt({question:'Test',source:{text:'source'},answer},'blank','en'),/requested_type/);
});
test('image attachments survive structured-output repair',async()=>{
 const prompt=withImages('Read this',[{image,label:'Source'}]),calls=[];
 await requestStructured(async messages=>{calls.push(messages);return calls.length===1?'invalid':'{"ok":true}';},prompt,JSON.parse);
 assert.deepEqual(calls[1][0].content,prompt);assert.equal(calls.length,2);
});
