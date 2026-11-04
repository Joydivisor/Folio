// Suggestions request a new answer; view tabs only reveal an existing result.
export function learningActions(plan,source={}){
 const text=[plan.object,source.text].join('\n'),actions=[];
 const add=(kind,zh,en)=>{if(plan.kind!==kind)actions.push({kind,zh,en});};
 if(/置换|permutation|σ|\\sigma/i.test(text))add('permutation','演示置换','Animate permutation');
 else if(/立方体|正方体|四面体|八面体|cube|tetrahedron|octahedron/i.test(text))add('geometry','旋转观察','Explore in 3D');
 else if(/(?:S[₃₄₅345]|S_\{?[345]).*(?:可解|导出|交换子)|derived series|solvab/i.test(text))add('derived','展开导出列','Explore derived series');
 if(/对比|区别|比较|不同|versus|compare|difference/i.test(text))add('comparison','对比概念','Compare concepts');
 if(!['derivation','process'].includes(plan.kind))add('derivation','逐步推导','Walk through steps');
 else add('example','看具体例子','See an example');
 if(actions.length<2)add('example','看具体例子','See an example');
 return actions.filter((a,i,all)=>all.findIndex(b=>b.kind===a.kind)===i).slice(0,2);
}
export function learningRequest(kind){
 const requests={derivation:'用 derivation 分步说明当前问题，展示每一步的依据，不补造前提。',comparison:'用 comparison 对照当前问题中实际涉及的对象、条件与差异。',permutation:'用 permutation 演示当前原文的具体置换和重复作用，准确恢复映射。',geometry:'用 geometry 展示当前对象的空间变换，保留原文几何体、轴与角度。',derived:'用 derived 展开当前对称群的导出列。',example:'用一个明确标为辅助示例的具体例子解释当前问题。不要把例子声称为原文。'};
 if(!requests[kind])throw Error('Unknown learning action');
 return '请保留当前问题的对象与参数。'+requests[kind]+' 如果原文确实缺少演示参数，说明具体缺少什么，不要替换原文对象。';
}
export function hasPresentation(version){return ['permutation','derived','geometry','tetrahedron','comparison','derivation','process','diagram','anatomy','document'].includes(version.plan.kind)||version.plan.kind==='concept'&&Boolean(version.visual);}
