import {node} from './workspace-ui.js';
export function mountDisplay(host,plan,{renderMath=()=>{}}={}){
 const root=node('section',undefined,{className:'step-view'});root.append(node('h2',plan.object));host.append(root);
 if(plan.kind==='comparison'){const table=node('table',undefined,{className:'comparison-table'}),head=node('tr');for(const c of plan.columns)head.append(node('th',c));table.append(head);for(const row of plan.rows){const tr=node('tr');for(const cell of row)tr.append(node('td',cell));table.append(tr);}root.append(table);renderMath(root);return ()=>{};}
 const steps=node('ol',undefined,{className:'reading-steps'});
 for(const step of plan.steps){const li=node('li');li.append(node('h3',step.title),node('p',step.text));steps.append(li);}
 root.append(steps);renderMath(steps);return ()=>{};
}
