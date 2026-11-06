// Explicit output choices are an additional input; automatic intent stays unchanged.
export const OUTPUT_COMMANDS=[
 {id:'visualize',label:['交互可视化','Interactive visual'],description:['选择适合内容的交互演示','Choose a suitable interactive view'],kinds:['permutation','derived','geometry','tetrahedron','anatomy','process','concept','diagram'],aliases:['可视化','交互']},
 {id:'diagram',label:['流程图','Flowchart'],description:['呈现分支、循环和依赖','Show branches, loops and dependencies'],kinds:['diagram'],aliases:['流程图','flowchart']},
 {id:'derive',label:['分步推导','Derivation'],description:['逐步展开证明与公式','Work through a proof or formula'],kinds:['derivation'],aliases:['推导','证明']},
 {id:'compare',label:['对照表','Comparison'],description:['按相同维度比较对象','Compare objects on shared dimensions'],kinds:['comparison'],aliases:['对比','表格']},
 {id:'3d',label:['三维演示','3D view'],description:['旋转观察几何关系','Explore spatial relationships'],kinds:['geometry','tetrahedron'],aliases:['三维']},
 {id:'anatomy',label:['结构示意','Structure'],description:['展示部件与相对位置','Show parts and their positions'],kinds:['anatomy'],aliases:['结构']},
 {id:'concept',label:['关系图','Concept map'],description:['连接概念与条件','Connect concepts and conditions'],kinds:['concept'],aliases:['关系图']},
 {id:'steps',label:['过程演示','Process'],description:['按顺序展开每一步','Walk through an ordered process'],kinds:['process'],aliases:['步骤']},
 {id:'explain',label:['文字解释','Text explanation'],description:['用文字和公式解释','Explain with prose and formulas'],kinds:['explain'],aliases:['解释','文字']},
];
export const outputCommand=id=>OUTPUT_COMMANDS.find(c=>c.id===id||c.aliases.includes(id));
export function commandMatches(query=''){const q=query.toLowerCase();return OUTPUT_COMMANDS.filter(c=>[c.id,...c.label,...c.aliases].some(s=>s.toLowerCase().includes(q)));}
export function slashQuery(text,caret=text.length){const match=text.slice(0,caret).match(/(?:^|\n)\/([^\s/]*)$/);return match?{query:match[1],start:caret-match[1].length-1,end:caret}:null;}
export function parseOutputCommand(text){const m=String(text).match(/^\s*\/([^\s/]+)(?:\s+|$)/),command=m&&outputCommand(m[1].toLowerCase());return command?{command,text:text.slice(m[0].length).trim()}:{command:null,text};}
export function outputInstruction(id){const c=outputCommand(id);return c?`\n本次用户显式选择输出方式 /${c.id}（${c.label[0]}）。requested_output 是本次的输出要求，优先于自动形式判断；请使用 ${c.kinds.join('/')}，或包含这些形式的 document。不要改变原文对象或编造参数。资料不足或当前引擎无法表达时用 explain 说明具体缺失条件。用户问题若明确只要文字或禁止图示，仍遵守文字要求。\n`:'';}
export function satisfiesOutput(plan,id){const c=outputCommand(id);return !c||c.kinds.includes(plan.kind)||(plan.kind==='document'&&plan.blocks?.some(b=>b.type==='visual'&&c.kinds.includes(b.display?.kind)));}
