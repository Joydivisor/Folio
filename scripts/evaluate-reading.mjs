import {testCredential} from './test-credential.mjs';
import {requestStructured} from '../public/structured-response.js';
import {readFile,writeFile} from 'node:fs/promises';
import {verifyPlanAgainstSource} from '../public/source-verification.js';
import {makeServer} from '../server.mjs';
import {requestReading,parseReading} from '../public/reading-response.js';
const credential=await testCredential();
if(!credential)throw Error('Missing local credential');
const cases=[
{id:'same-element-powers',selection:'原文说交换复合顺序会改变结果，σ²是否也会因先左后右改变？',pages:['在集合Ω={1,2,3}上，σ=(1 2 3)，τ=(1 2)。','约定στ先作用τ再作用σ。στ=(1 3)，τσ=(2 3)，不同元素的复合顺序可能影响结果。'],terms:['不变|不影响|不会|不因']},
{id:'cross-page-sigma',selection:'为什么这里有 σ³=e？',pages:['在集合Ω={1,2,3}上，定义σ=(1 2 3)，即1→2→3→1。','连续三次作用σ，每个元素都回到原位，即σ³=e。'],terms:['3','循环|轮换|回到']},
{id:'referent-S4',selection:'该群为什么可解？',pages:['本节研究四次对称群S₄。其交换子子群为A₄。','A₄的交换子子群为Klein四元群V₄，V₄的交换子子群为{e}。因此该群可解。'],terms:['V','可解']},
{id:'referent-S5',selection:'为什么这里就不能继续降下去？',pages:['S₅的交换子子群是A₅。A₅是非阿贝尔单群，且[A₅,A₅]=A₅。','所以S₅的导出列到A₅后不再变小，不会到达平凡群。'],terms:['非阿贝尔','单群']},
{id:'biology-context',selection:'这一过程用到前一步的哪些产物？',pages:['光反应在类囊体膜进行，生成ATP和NADPH并释放氧气。','下一步为卡尔文循环，在叶绿体基质中固定二氧化碳，消耗光反应提供的ATP和NADPH。'],terms:['ATP','NADPH']},
{id:'chemistry-context',selection:'为什么得到这个产物？',pages:['乙烯CH₂=CH₂与氢气在镍催化、加热条件下发生加成反应，产物为乙烷CH₃CH₃。','碳碳双键中的π键断裂，每个碳原子各连接一个氢原子。'],terms:['乙烷','加成']},
{id:'cube-same-object',selection:'把这个旋转解释清楚，做出可视化。',pages:['正方体绕连接一对相对顶点的体对角线旋转120°，立方体与自身重合。','轴上的两个顶点固定，其余六个顶点分成两个长度为3的循环。'],terms:['120']},
{id:'order-graph',selection:'使一个群元素的正整数次幂首次等于恒等元的指数，称为该元素的阶。请梳理关系。',pages:['σ=(1 2 3)，连续三次作用σ，每个元素都回到原位，即σ³=e。','使一个群元素的正整数次幂首次等于恒等元的指数，称为该元素的阶。'],terms:['最小','3']}
];
cases.push({id:'explicit-comparison',selection:'请用对比表比较 S3 和 S4 的导出列及可解性。',pages:['S3 的导出列阶数为 6、3、1。S4 的导出列阶数为 24、12、4、1。两者都可解。'],terms:['可解'],kind:'comparison'},{id:'explicit-derivation',selection:'请分步推导为什么群元素的阶整除群的阶，不要概念图。',pages:['设 G 为有限群，g 属于 G。循环子群 <g> 的阶等于 g 的阶。由拉格朗日定理，子群的阶整除群的阶。'],terms:['拉格朗日'],kind:'derivation'},{id:'explicit-derived',selection:'请用可交互实验展示 S5 导出列的重复作用。',pages:['S5 的导出子群为 A5，A5 的导出子群仍是 A5，故 S5 不可解。'],terms:['A'],kind:'derived'},{id:'explicit-process',selection:'用分步过程展示光反应和卡尔文循环之间的物质传递。',pages:['光反应生成 ATP 和 NADPH。卡尔文循环消耗 ATP 和 NADPH 并固定二氧化碳。'],terms:['ATP','NADPH'],kind:'process'});
const port=4189,server=makeServer({port,sessionKey:credential});await new Promise(r=>server.listen(port,'127.0.0.1',r));
const queue=process.env.EVAL_CASES?cases.filter(c=>process.env.EVAL_CASES.split(',').includes(c.id)):[...cases],results=[];
async function worker(){while(queue.length){const c=queue.shift(),start=Date.now();try{
const context={name:'回归测试文献',anchorPage:2,total:c.pages.length,scanned:c.pages.length,excerpts:c.pages.map((text,i)=>({page:i+1,text})),failedPages:[],emptyPages:[]};
let retries=0;const ask=async messages=>{const r=await fetch(`http://127.0.0.1:${port}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:JSON.stringify({baseUrl:'https://api.deepseek.com',model:'deepseek-flash',responseFormat:'json',messages}),signal:AbortSignal.timeout(130000)});const data=await r.json();if(!r.ok)throw Error(data.error);return data.content;};
const parsed=await requestStructured(ask,requestReading(c.selection,context),(raw,{attempt})=>parseReading(raw,context.excerpts,{strictPlan:attempt===0,question:c.selection}),{onRepair:()=>retries++});parsed.plan=verifyPlanAgainstSource(parsed.plan,c.selection+'\n'+parsed.parameterEvidence.map(x=>x.quote).join('\n'));const text=parsed.answer.paragraphs.map(p=>p.text).join('\n');const issues=c.terms.filter(t=>!t.split('|').some(word=>text.includes(word))).map(t=>'missing:'+t);if(c.id==='cube-same-object'&& !(parsed.plan.kind==='geometry'&&parsed.plan.shape==='cube'))issues.push('wrong-geometry');if(c.id==='referent-S4'&&(!['derived','explain','derivation'].includes(parsed.plan.kind)||(parsed.plan.kind==='derived'&&parsed.plan.n!==4)))issues.push('wrong-group');if(c.id==='referent-S5'&&(!['derived','explain','derivation'].includes(parsed.plan.kind)||(parsed.plan.kind==='derived'&&parsed.plan.n!==5)))issues.push('wrong-group');if(c.kind&&parsed.plan.kind!==c.kind)issues.push('unexpected-view:'+parsed.plan.kind);if(parsed.answer.nextQuestion)issues.push('unnecessary-question');if(!parsed.answer.paragraphs.some(p=>p.sources.length))issues.push('no-verified-citation');
results.push({id:c.id,pass:!issues.length,issues,retries,...parsed,elapsedMs:Date.now()-start});console.log(JSON.stringify({id:c.id,pass:!issues.length,issues}));
}catch(e){results.push({id:c.id,pass:false,error:e.message.replaceAll(credential,'[redacted]')});console.log(JSON.stringify({id:c.id,pass:false}));}}}
try{await Promise.all([worker(),worker()]);}finally{server.close();server.closeAllConnections();}
const report={created:new Date().toISOString(),total:results.length,passed:results.filter(r=>r.pass).length,results};await writeFile(new URL('../tests/reports/'+(process.env.EVAL_CASES?'reading-targeted-beta5.json':'reading-integrated-beta5.json'),import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({total:report.total,passed:report.passed}));
