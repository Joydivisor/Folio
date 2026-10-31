import {identity,compose,cycles} from './groups.js';
import {compositionTrace,permutationFacts,mappingInput} from './experiment-math.js';
const colors=['#648bcc','#c58a57','#4c9b89','#a07aba','#bc6d88','#6c9c55','#ad984d','#749baa'];
export function mountPermutation(host, original, onSave){
 let plan={...original},state=identity(plan.n),steps=0,trace=null,stage=0,productName='',edited=false;
 host.innerHTML=`<div class="visual-heading"><small>PERMUTATION · 置换实验</small><h2></h2><p></p></div>
 <div class="permutation-diagram"></div><div class="artifact-legend"></div><div class="operation-row"></div><div class="compare-grid" style="margin-top:12px"></div>
 <div class="math-result" aria-live="polite"></div><div class="artifact-metrics"></div>
 <section class="artifact-section trace-section" hidden><h3>复合的每一步</h3><div class="trace-actions"><button data-step="back">上一步</button><span></span><button data-step="next">下一步</button></div><table class="trace-table"><thead></thead><tbody></tbody></table></section>
 <p class="verification"></p><button class="text-button permutation-reset">↺ 回到恒等置换</button>
 <details class="artifact-section"><summary>核对或修改识别参数</summary><form class="parameter-form"><label>σ 的像<input name="sigma" aria-label="σ 的像，依次填写 1 到 n 的像"></label><label>τ 的像<input name="tau" aria-label="τ 的像，可留空" placeholder="可留空"></label><label style="display:flex"><input type="checkbox" name="leftFirst">左侧先作用</label><button type="submit">应用参数</button><p class="parameter-error" role="alert"></p></form></details>
 <button class="wide-button permutation-save" style="margin-top:18px">保存实验到笔记</button>`;
 const q=s=>host.querySelector(s), form=q('form');
 function controls(){
  q('h2').textContent=edited?'自定义置换 · '+plan.n+' 个元素':plan.object;
  q('.visual-heading p').textContent='σ = '+cycles(plan.sigma)+(plan.tau?'，τ = '+cycles(plan.tau):'')+'。'+(plan.order==='right-first'?'复合时右侧先作用。':'复合时左侧先作用。');
  q('.artifact-legend').innerHTML=state.map((_,i)=>'<span style="--item-color:'+colors[i]+'"><i></i>元素 '+(i+1)+'</span>').join('');
  q('.operation-row').replaceChildren();q('.compare-grid').replaceChildren();
  for(const [name,p] of [['σ',plan.sigma],...(plan.tau?[['τ',plan.tau]]:[])]){
   const b=document.createElement('button');b.textContent='作用 '+name+'  '+cycles(p);b.onclick=()=>{trace=null;state=compose(p,state);steps++;render();};q('.operation-row').append(b);
  }
  if(plan.tau)for(const [name,a,b] of [['στ',plan.sigma,plan.tau],['τσ',plan.tau,plan.sigma]]){
   const button=document.createElement('button');button.textContent=name;const small=document.createElement('small');small.textContent='逐步观察复合';button.append(small);
   button.onclick=()=>{trace=compositionTrace(a,b,plan.order);productName=name;stage=0;showStep();};q('.compare-grid').append(button);
  }
  form.elements.sigma.value=plan.sigma.map(x=>x+1).join(', ');form.elements.tau.value=plan.tau?.map(x=>x+1).join(', ')||'';form.elements.leftFirst.checked=plan.order==='left-first';
 }
 function showStep(){state=[trace.initial,trace.intermediate,trace.result][stage];steps=stage;render();}
 function render(){
  const x=i=>30+i*330/(plan.n-1),label=state.map((v,i)=>(i+1)+' 映到 '+(v+1)).join('，');
  q('.permutation-diagram').innerHTML='<svg viewBox="0 0 390 195" class="perm-svg" role="img" aria-label="'+label+'"><defs>'+state.map((_,i)=>'<marker id="dynamicArrow'+i+'" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="'+colors[i]+'"/></marker>').join('')+'</defs>'+state.map((v,i)=>'<path class="mapping-line" d="M'+x(i)+' 45 C'+x(i)+' 86 '+x(v)+' 106 '+x(v)+' 146" stroke="'+colors[i]+'" stroke-width="2" opacity=".8" fill="none" marker-end="url(#dynamicArrow'+i+')"/>').join('')+state.map((_,i)=>'<circle cx="'+x(i)+'" cy="27" r="16" fill="'+colors[i]+'"/><text x="'+x(i)+'" y="32" text-anchor="middle" fill="white" font-size="13">'+(i+1)+'</text><circle cx="'+x(i)+'" cy="169" r="16" fill="none" stroke="'+colors[state.indexOf(i)]+'" stroke-width="1.5"/><text x="'+x(i)+'" y="174" text-anchor="middle" fill="var(--text)" font-size="13">'+(i+1)+'</text>').join('')+'</svg>';
  q('.math-result').textContent=(trace&&stage===2?productName+' = ':'')+cycles(state)+' · '+steps+' 次作用';
  const facts=permutationFacts(state);
  q('.artifact-metrics').innerHTML='<div><small>置换的阶</small><strong>'+facts.order+'</strong></div><div><small>奇偶性</small><strong>'+(facts.even?'偶置换':'奇置换')+'</strong></div><div><small>不动点</small><strong>'+(facts.fixed.join(', ')||'无')+'</strong></div>';
  q('.verification').textContent=(edited?'使用手动修正的参数。':plan.verification?.corrected.length?'已按原文修正 '+plan.verification.corrected.join('、')+' 的映射。':plan.verification?.checked.length?'已核对原文 '+plan.verification.checked.join('、')+' 的循环记号。':'识别参数可在下方核对。')+'复合、阶与奇偶性由本地计算。';
  q('.trace-section').hidden=!trace;
  if(trace){const first=plan.order==='right-first'?productName[1]:productName[0],second=plan.order==='right-first'?productName[0]:productName[1];
   q('.trace-actions span').textContent=['0 / 2 · 初始位置','1 / 2 · 先作用 '+first,'2 / 2 · 再作用 '+second][stage];
   q('[data-step="back"]').disabled=stage===0;q('[data-step="next"]').disabled=stage===2;
   q('thead').innerHTML='<tr><th>元素 x</th><th>经 '+first+'</th><th>再经 '+second+'</th></tr>';
   q('tbody').innerHTML=trace.rows.map((r,i)=>'<tr style="--item-color:'+colors[i]+'">'+r.map((v,j)=>'<td>'+(j<=stage?v:'—')+'</td>').join('')+'</tr>').join('');
  }
 }
 q('[data-step="back"]').onclick=()=>{stage=Math.max(0,stage-1);showStep();};q('[data-step="next"]').onclick=()=>{stage=Math.min(2,stage+1);showStep();};
 q('.permutation-reset').onclick=()=>{trace=null;state=identity(plan.n);steps=0;render();};
 form.onsubmit=e=>{e.preventDefault();try{const sigma=mappingInput(form.elements.sigma.value),tau=form.elements.tau.value.trim()?mappingInput(form.elements.tau.value,sigma.length):undefined;plan={...plan,n:sigma.length,sigma,tau,order:form.elements.leftFirst.checked?'left-first':'right-first'};trace=null;steps=0;state=identity(plan.n);edited=true;controls();render();q('.parameter-error').textContent='';}catch(error){q('.parameter-error').textContent=error.message;}};
 q('.permutation-save').onclick=()=>onSave(q('h2').textContent+'\n'+q('.visual-heading p').textContent+'\n'+(trace&&stage<2?'复合预览 · 第 '+stage+' 步\n':'')+'当前结果：'+cycles(state)+'\n'+state.map((v,i)=>(i+1)+' ↦ '+(v+1)).join('，'));
 controls();render();
}
