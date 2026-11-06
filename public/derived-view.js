import {permutations,derived,cycles,commutator} from './groups.js';
import {node,button,ui} from './workspace-ui.js';
export function mountDerived(host,plan,{saved={},onState=()=>{}}={}){
 let layers=[permutations(plan.n)],index=0;
 const choices=structuredClone(saved.choices||{});
 const stopped=()=>layers.at(-1).length===1||layers.length>1&&layers.at(-1).length===layers.at(-2).length;
 function next(){if(stopped())return;layers.push(derived(layers.at(-1)).group);index=layers.length-1;}
 for(let i=0;i<Math.min(5,saved.depth||0);i++)next();
 index=Math.max(0,Math.min(layers.length-1,saved.index||0));choices[index]??={a:saved.a||0,b:saved.b||0};
 const root=node('section',undefined,{className:'derived-view'}),chain=node('div',undefined,{className:'workspace-actions'}),result=node('p'),elements=node('p'),details=node('details'),a=node('select'),b=node('select'),product=node('p'),advance=node('button',ui('计算末层的导出子群','Compute the next subgroup'),{type:'button'});
 details.append(node('summary',ui('查看本层全部元素','Show all elements in this group')),elements);a.setAttribute('aria-label',ui('交换子元素 a','Commutator element a'));b.setAttribute('aria-label',ui('交换子元素 b','Commutator element b'));
 root.append(node('h2',plan.object),chain,result,details,a,b,product,advance);host.append(root);
 function compute(){choices[index]={a:Number(a.value),b:Number(b.value)};product.textContent='[a, b] = '+cycles(commutator(layers[index][Number(a.value)],layers[index][Number(b.value)]));onState({depth:layers.length-1,index,...choices[index],choices:structuredClone(choices)});}
 function draw(){
  chain.replaceChildren();layers.forEach((g,i)=>{const choice=button('G⁽'+i+'⁾ · '+g.length,()=>{index=i;draw();});choice.setAttribute('aria-current',String(index===i));chain.append(choice);});
  elements.textContent=layers[index].map(cycles).join('   ');
  for(const [name,input]of [['a',a],['b',b]]){input.replaceChildren();layers[index].forEach((g,i)=>input.append(node('option',cycles(g),{value:String(i)})));input.value=String(Math.max(0,Math.min(layers[index].length-1,choices[index]?.[name]||0)));}
  advance.disabled=stopped();
  result.textContent=layers.at(-1).length===1?ui('导出列到达平凡群：可解。','The derived series reaches the trivial group: solvable.'):stopped()?ui('导出列稳定于非平凡群：不可解。','The derived series stabilizes at a nontrivial group: not solvable.'):ui('继续计算，观察导出列。','Continue to inspect the derived series.');compute();
 }
 a.onchange=b.onchange=compute;advance.onclick=()=>{next();draw();};draw();return ()=>{};
}
