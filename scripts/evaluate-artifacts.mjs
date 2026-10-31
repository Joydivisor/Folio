import {testCredential} from './test-credential.mjs';
import {verifyPlanAgainstSource} from '../public/source-verification.js';
import {readFile,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {makeServer} from '../server.mjs';
import {requestUnderstanding,parseUnderstanding} from '../public/understanding.js';
import {requestGraph,parseGraph} from '../public/graph-schema.js';
const credential=await testCredential();
if(!credential)throw new Error('Missing local credential');
const cases=[
 {id:'new-p5',text:'在五个元素的集合上，σ=(1 4 2 5 3)，τ=(2 4)。请画出置换作用，右侧先作用。',expected:{kind:'permutation',n:5,sigma:[3,4,0,1,2],tau:[0,3,2,1,4],order:'right-first'}},
 {id:'new-p8',text:'底集为1到8，σ=(1 3 5 7)(2 4 6 8)，请用不同颜色追踪各元素。',expected:{kind:'permutation',n:8,sigma:[2,3,4,5,6,7,0,1]}},
 {id:'new-left',text:'Ω={1,2,3,4}，σ=(1 4)(2 3)，τ=(1 2 3)。本书采用左边先作用的复合约定。请演示。',expected:{kind:'permutation',sigma:[3,2,1,0],tau:[1,2,0,3],order:'left-first'}},
 {id:'new-derived',text:'研究S₄：先计算交换子子群，再对它继续取交换子子群，直到停止。',expected:{kind:'derived',n:4}},
 {id:'new-3d',text:'让正四面体沿一对对边中点的连线旋转半周，观察对应的置换。',expected:{kind:'tetrahedron',operation:'edge'}},
 {id:'new-ambiguous',text:'把上面那个旋转做成三维动画，角度按上面的式子。',expected:{kind:'clarify'}},
 {id:'new-cube',text:'正方体绕体对角线转120度，请做能操作的三维模型。',expected:{kind:'unsupported'}},
 {id:'new-concept',text:'群是一个集合G和一个二元运算，满足结合律，存在单位元，并且每个元素存在逆元。如果运算还满足交换律，这个群就是阿贝尔群。请梳理定义和条件。',expected:{kind:'concept'},graph:true},
 {id:'new-biology',text:'光合作用的光反应发生在类囊体膜上，利用光能产生ATP和NADPH，并释放氧气。卡尔文循环在叶绿体基质中利用ATP和NADPH固定二氧化碳。请展示两个阶段的关系。',expected:{kind:'concept'},graph:true}
];
const port=4188,server=makeServer({port,sessionKey:credential});await new Promise(r=>server.listen(port,'127.0.0.1',r));
async function ask(content){const r=await fetch(`http://127.0.0.1:${port}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:JSON.stringify({baseUrl:'https://api.deepseek.com',model:'deepseek-flash',messages:[{role:'user',content}]}),signal:AbortSignal.timeout(130000)});const data=await r.json();if(!r.ok)throw new Error(data.error);return data.content;}
const pending=[...cases],results=[];
async function worker(){while(pending.length){const c=pending.shift(),start=Date.now();let result;
 try {const rawPlan=parseUnderstanding(await ask(requestUnderstanding(c.text)));const plan=verifyPlanAgainstSource(rawPlan,c.text);const mismatches=Object.entries(c.expected).filter(([k,v])=>!isDeepStrictEqual(plan[k],v)).map(([k])=>k);let graph;
 if(c.graph){graph=parseGraph(await ask(requestGraph(c.text,'',plan.object)),c.text);if(!graph.nodes.some(n=>n.evidenceVerified))mismatches.push('no-source-evidence');}
 result={...c,rawPlan,plan,graph,pass:!mismatches.length,mismatches};
 }catch(e){result={...c,pass:false,error:e.message.replaceAll(credential,'[redacted]')};}
 results.push({...result,elapsedMs:Date.now()-start});console.log(JSON.stringify({id:c.id,pass:result.pass,mismatches:result.mismatches,error:result.error}));
}}
try{await Promise.all([worker(),worker()]);}finally{server.close();server.closeAllConnections();}
const report={created:new Date().toISOString(),model:'deepseek-flash',total:results.length,passed:results.filter(r=>r.pass).length,note:'New cases for this revision. Checks parameter extraction, schema and exact quote matching; not a proof of semantic accuracy for arbitrary content.',results};
await writeFile(new URL('../tests/reports/artifacts-revision-5.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({total:report.total,passed:report.passed}));if(report.passed!==report.total)process.exitCode=1;
