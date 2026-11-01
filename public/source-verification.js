import {identity,compose,cycles} from './groups.js';

// Deliberately narrow: explicit numeric cycles only. Never guess from prose.
export function cycleMapping(notation,n,order='right-first') {
  const groups=[...notation.matchAll(/\(([^()]*)\)/g)].map(m=>m[1].trim().split(/[\s,，]+/).map(Number));
  if(!groups.length)throw new Error('没有可核对的循环记号。');
  const maps=groups.map(labels=>{
    if(new Set(labels).size!==labels.length||labels.some(x=>!Number.isInteger(x)||x<1||x>n))throw new Error('原文循环记号包含重复标签或超出识别底集的元素，请核对。');
    const p=identity(n);labels.forEach((x,i)=>p[x-1]=labels[(i+1)%labels.length]-1);return p;
  });
  return (order==='right-first'?[...maps].reverse():maps).reduce((result,p)=>compose(p,result),identity(n));
}
export function verifyPlanAgainstSource(plan,source) {
  if(plan.kind==='tetrahedron'){
    const object=String(plan.object||'');
    const wrongShape=/正方体|立方体|球体|圆柱|正八面体|正十二面体|正二十面体|cube|octahedron|dodecahedron|icosahedron/i;
    if(wrongShape.test(object)||(!/四面体|tetrahedron/i.test(object)&&wrongShape.test(source))||!/四面体|tetrahedron/i.test(source))return {kind:'explain',object:plan.object,reason:'保留原文对象的讲解，不替换为其它几何体。'};
  }
  if(plan.kind!=='permutation')return plan;
  const next={...plan},checked=[],corrected=[];
  const normalized=source.replaceAll('（','(').replaceAll('）',')');
  for(const [field,name] of [['sigma','σ'],['tau','τ']]){
    const expression=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+name+'|\\\\'+field+'|\\b'+field+'\\b)\\s*=\\s*((?:\\(\\s*\\d+(?:[\\s,，]+\\d+)*\\s*\\)\\s*)+)','giu');
    const matches=[...normalized.matchAll(expression)].filter(m=>!/^\s*(?:\^|⁻|²|³)/.test(normalized.slice(m.index+m[0].length)));
    if(!matches.length)continue;
    const maps=matches.map(m=>cycleMapping(m[1],plan.n,plan.order));
    if(maps.some(p=>p.join(',')!==maps[0].join(',')))throw new Error('选段中 '+name+' 有多个不同定义，请只保留当前要操作的一组。');
    checked.push(name);
    if(next[field]?.join(',')!==maps[0].join(',')){next[field]=maps[0];corrected.push(name);}
  }
  next.verification={checked,corrected};
  if(corrected.length){
    next.object='σ = '+cycles(next.sigma)+(next.tau?'，τ = '+cycles(next.tau):'');
    next.reason='已根据原文循环记号重新计算 '+corrected.join('、')+'，修正模型映射。';
  }
  return next;
}
