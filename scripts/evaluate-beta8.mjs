import {testCredential} from './test-credential.mjs';
import {makeServer} from '../server.mjs';
import {requestReading,parseReading} from '../public/reading-response.js';
import {requestStudyNote,parseStudyNote} from '../public/study-note.js';
import {requestStructured} from '../public/structured-response.js';
import {createArtifact} from '../public/artifact-history.js';
import {verifyPlanAgainstSource} from '../public/source-verification.js';
import {createNoteMarkdown} from '../public/note-markdown.js';
import MarkdownIt from 'markdown-it';
import katex from 'katex';
import {writeFile} from 'node:fs/promises';
const credential=await testCredential(),port=4192,server=makeServer({port,sessionKey:credential});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const cases=[
 {id:'automatic-permutation',text:'在 Ω={1,2,3} 上，σ=(1 2 3)。σ³=e，每个元素都回到原位。',kind:'permutation'},
 {id:'automatic-proof',text:'有限群 G 的元素 g 的阶整除 |G|：循环子群 <g> 的阶等于 g 的阶，根据拉格朗日定理，子群的阶整除群的阶。',kind:'derivation'},
 {id:'automatic-comparison',text:'比较光反应与卡尔文循环：前者在类囊体膜上生成 ATP 和 NADPH，后者在基质中消耗 ATP 和 NADPH 并固定二氧化碳。',kind:'comparison'},
 {id:'automatic-geometry',text:'立方体绕体对角线 (1,1,1) 旋转 120° 与自身重合。',kind:'geometry'},
 {id:'respect-prose',text:'只用一句文字解释，不要图和分步：群的单位元 e 满足 eg=ge=g。',kind:'explain'}
];
const results=[];let rawResponses=[];
async function ask(messages){const r=await fetch('http://127.0.0.1:'+port+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:'+port},body:JSON.stringify({baseUrl:'https://api.deepseek.com',model:'deepseek-flash',responseFormat:'json',messages}),signal:AbortSignal.timeout(130000)});const data=await r.json();if(!r.ok)throw Error(data.error);rawResponses.push(data.content);return data.content;}
async function run(c){
 try{
  rawResponses=[];
  const context={name:'Beta 8 evaluation',excerpts:[{page:1,text:c.text}],anchorPage:1,total:1};
  const result=await requestStructured(ask,requestReading(c.text,context),(raw,{attempt})=>parseReading(raw,context.excerpts,{strictPlan:attempt===0,question:c.text}));
  result.plan=verifyPlanAgainstSource(result.plan,c.text+'\n'+result.parameterEvidence.map(e=>e.quote).join('\n'));
  const issues=[];if(result.plan.kind!==c.kind)issues.push('Expected '+c.kind+', received '+result.plan.kind);
  if(c.kind!=='explain'&&result.answer.paragraphs.length>2)issues.push('Long preamble');
  let note;
  if(c.id==='automatic-proof'){
   note=await requestStructured(ask,requestStudyNote(createArtifact({name:context.name,page:1,text:c.text},result.plan,result.answer)),parseStudyNote);
   const visit=tokens=>{for(const t of tokens){if(t.type.startsWith('folio_math')){const d=t.content.startsWith('$$')?2:1;katex.renderToString(t.content.slice(d,-d),{throwOnError:true,trust:false});}if(t.children)visit(t.children);}};visit(createNoteMarkdown(MarkdownIt).parse(note.markdown,{}));
   if(!note.markdown.includes('$'))issues.push('Note contains no math delimiters');
  }
  results.push({id:c.id,pass:!issues.length,issues,...result,note,...(issues.length?{rawResponses}: {})});console.log(JSON.stringify({id:c.id,kind:result.plan.kind,pass:!issues.length,issues}));
 }catch(error){results.push({id:c.id,pass:false,error:error.message.replaceAll(credential,'[redacted]')});console.log(JSON.stringify({id:c.id,pass:false}));}
}
try{for(const c of cases.filter(c=>!process.env.EVAL_CASES||process.env.EVAL_CASES.split(',').includes(c.id)))await run(c);}finally{server.close();server.closeAllConnections();}
await writeFile('tests/reports/beta8-live.json',JSON.stringify({date:new Date().toISOString(),results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;

