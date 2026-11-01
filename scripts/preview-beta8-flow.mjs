// Isolated UI flow with deterministic API fixtures. No key or external requests.
import {makeServer} from '../server.mjs';
const proof={kind:'derivation',object:'置换的阶',reason:'逐步证明',steps:[{title:'作用一次',text:'$1\\mapsto2\\mapsto3\\mapsto1$ 是一个三循环。',basis:'deduction',sources:[]},{title:'回到原位',text:'$\\sigma^3=e$ 且 $\\sigma\\ne e$、$\\sigma^2\\ne e$，所以阶为 $3$。',basis:'deduction',sources:[]}],explanation:{title:'为什么三次回到原位',paragraphs:[{text:'每次作用都前进一格，三次后回到原位。',sources:[]}]}};
const permutation={kind:'permutation',object:'置换 σ=(1 2 3)',reason:'演示重复作用',n:3,sigma:[2,3,1],order:'right-first',explanation:{title:'三次回到起点',paragraphs:[{text:'$\\sigma=(1\\,2\\,3)$ 连续作用三次回到原位，即 $\\sigma^3=e$。',sources:[]}]}};
const note={title:'三循环的阶',markdown:'## 定义\n\n元素的阶是使 $g^n=e$ 成立的最小正整数 $n$。\n\n## 推导\n\n1. $\\sigma\\ne e$。\n2. $\\sigma^2\\ne e$。\n3. $\\sigma^3=e$。\n\n$$\n\\operatorname{ord}(\\sigma)=3\n$$'};
makeServer({port:4195,sessionKey:'local-ui-fixture',fetchImpl:async(url,options)=>{
 const request=JSON.parse(options.body),prompt=request.messages.filter(m=>m.role==='user').at(-1).content;
 const value=prompt.includes('学习笔记')?note:prompt.includes('用 derivation')?proof:permutation;
 return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}),{headers:{'Content-Type':'application/json'}});
}}).listen(4195,'127.0.0.1',()=>console.log('Isolated UI flow: http://127.0.0.1:4195/'));
