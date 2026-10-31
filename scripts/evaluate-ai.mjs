import {testCredential} from './test-credential.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {makeServer} from '../server.mjs';
import {requestUnderstanding,parseUnderstanding} from '../public/understanding.js';
import {selectionCases} from '../tests/selection-cases.mjs';
const apiKey=await testCredential();
if(!apiKey)throw new Error('No credential found.');
const port=4187,server=makeServer({port,sessionKey:apiKey});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const results=[],pending=[...selectionCases];
async function worker(){while(pending.length){const c=pending.shift(),start=Date.now();let actual,error,usage;
 try{const r=await fetch(`http://127.0.0.1:${port}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:JSON.stringify({baseUrl:'https://api.deepseek.com',model:'deepseek-flash',messages:[{role:'user',content:requestUnderstanding(c.text)}]}),signal:AbortSignal.timeout(130000)});const data=await r.json();usage=data.usage;if(!r.ok)throw new Error(data.error);actual=parseUnderstanding(data.content);}catch(e){error=e.message.replaceAll(apiKey,'[redacted]');}
 const mismatches=actual?Object.entries(c.expected).filter(([k,v])=>!isDeepStrictEqual(actual[k],v)).map(([k])=>k):['response'];const pass=!error&&!mismatches.length;
 results.push({...c,actual,error,pass,mismatches,elapsedMs:Date.now()-start,usage});console.log(JSON.stringify({id:c.id,pass,...(!pass?{expected:c.expected,actual,error,mismatches}:{})}));
}}
try{await Promise.all([worker(),worker()]);}finally{server.close();server.closeAllConnections();}
results.sort((a,b)=>selectionCases.findIndex(c=>c.id===a.id)-selectionCases.findIndex(c=>c.id===b.id));
const report={created:new Date().toISOString(),model:'deepseek-flash',total:results.length,passed:results.filter(r=>r.pass).length,results};
await mkdir(new URL('../tests/reports/',import.meta.url),{recursive:true});
const reportName=process.argv[2]||'ai-evaluation';
if(!/^[a-z0-9-]+$/.test(reportName))throw new Error('Invalid report name');
await writeFile(new URL('../tests/reports/'+reportName+'.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({total:report.total,passed:report.passed}));if(report.passed!==report.total)process.exitCode=1;
