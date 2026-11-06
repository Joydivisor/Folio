import {node,ui} from './workspace-ui.js';
import {normalizeLatex} from './note-markdown.js';
export function mountDisplay(host,plan,{renderMath=()=>{},saved={},onState=()=>{}}={}){
 const root=node('section',undefined,{className:'step-view'});root.append(node('h2',normalizeLatex(plan.object)));host.append(root);
 if(plan.kind==='comparison'){const wrap=node('div',undefined,{className:'comparison-scroll'}),table=node('table',undefined,{className:'comparison-table'}),head=node('tr');for(const c of plan.columns)head.append(node('th',normalizeLatex(c)));table.append(head);for(const row of plan.rows){const tr=node('tr');for(const cell of row)tr.append(node('td',normalizeLatex(cell)));table.append(tr);}wrap.append(table);root.append(wrap);renderMath(root);return ()=>{};}
 let index=Math.max(0,Math.min(plan.steps.length-1,Number.isInteger(saved.index)?saved.index:0)),all=typeof saved.all==='boolean'?saved.all:plan.kind==='derivation';
 const steps=node('ol',undefined,{className:'reading-steps'}),nav=node('div',undefined,{className:'step-navigation'}),prev=node('button',ui('上一步','Previous'),{type:'button'}),next=node('button',ui('下一步','Next'),{type:'button'}),toggle=node('button','',{type:'button'}),status=node('output');
 for(const [i,step]of plan.steps.entries()){const li=node('li',undefined,{value:i+1});li.append(node('h3',normalizeLatex(step.title)),node('p',normalizeLatex(step.text)));steps.append(li);}
 nav.append(prev,status,next,toggle);root.append(nav,steps);renderMath(root);
 function draw(){[...steps.children].forEach((li,i)=>{li.hidden=!all&&i!==index;li.classList.toggle('is-current',i===index);if(i===index)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});prev.disabled=index===0;next.disabled=index===plan.steps.length-1;status.textContent=(index+1)+' / '+plan.steps.length;toggle.textContent=all?ui('逐步查看','One step at a time'):ui('展开全部','Show all steps');toggle.setAttribute('aria-pressed',String(all));onState({index,all});}
 prev.onclick=()=>{index=Math.max(0,index-1);draw();};next.onclick=()=>{index=Math.min(plan.steps.length-1,index+1);draw();};toggle.onclick=()=>{all=!all;draw();};draw();return ()=>{};
}
