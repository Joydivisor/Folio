// Opt-in live evaluation with synthetic passages and the project's dedicated test key.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {makeServer} from '../server.mjs';
import {generateReading} from '../public/reading-response.js';
import {outputCases} from '../tests/output-mode-cases.mjs';
import {testCredential} from './test-credential.mjs';

const {values}=parseArgs({options:{mode:{type:'string'}}});
const examples=values.mode?outputCases.filter(c=>c.mode===values.mode):outputCases;
if(!examples.length)throw Error('Unknown output mode');
const model='deepseek-flash',port=4199;
const server=makeServer({port,sessionKey:await testCredential()});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
const planned=examples.length*2,results=[],jobs=[1,2].flatMap(round=>examples.map(example=>({round,example})));
let serviceError;
async function worker(){
 while(jobs.length&&!serviceError){
  const {round,example}=jobs.shift(),{selection,question,mode}=example;
  const row={round,mode,requests:0,passed:false},responses=[];
  const signal=AbortSignal.timeout(150000);
  try{
   const context={name:'Folio example',anchorPage:1,total:1,excerpts:[{page:1,text:selection}]};
   const result=await generateReading(async(messages,outputMode)=>{
    row.requests++;
    const res=await fetch('http://127.0.0.1:'+port+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseUrl:'https://api.deepseek.com',model,outputMode,answerLanguage:'zh-CN',responseFormat:'json',maxTokens:8192,messages}),signal});
    const data=await res.json();
    if(!res.ok){
     if([401,402,403].includes(res.status))serviceError='HTTP '+res.status;
     throw Error('HTTP '+res.status+' '+data.error);
    }
    responses.push(data.content);return data.content;
   },selection,context,{question,outputMode:mode,answerLanguage:'zh-CN',signal});
   row.kind=result.plan.kind;row.plan=result.plan;row.answer=result.answer;row.visual=result.visual;
   assert.equal(result.plan.kind,example.kind);example.check(result);row.passed=true;
  }catch(error){row.error=String(error.cause?.message||error.message);row.responses=responses;}
  results.push(row);console.log(JSON.stringify({round,mode,requests:row.requests,passed:row.passed,error:row.error}));
 }
}
try{await Promise.all([worker(),worker()]);}
finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
const passed=results.filter(r=>r.passed).length;
const folder=new URL('../tests/reports/output-modes/',import.meta.url);await mkdir(folder,{recursive:true});
await writeFile(new URL(values.mode?'live-'+values.mode+'.json':'live.json',folder),JSON.stringify({model,passed,attempted:results.length,planned,results},null,2));
console.log('Live output checks: '+passed+'/'+results.length+' passed ('+planned+' planned).');
if(passed!==planned)process.exitCode=1;
