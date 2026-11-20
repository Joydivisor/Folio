import assert from 'node:assert/strict';
import {diagram,anatomy} from './beta10-fixtures.mjs';

const steps=(...texts)=>texts.map((text,i)=>({title:'第 '+(i+1)+' 步',text,basis:'deduction',sources:[]}));
const concept={
 title:'正方形与矩形',summary:'正方形满足矩形的所有条件，还要求四边等长。',
 nodes:[{id:'square',label:'正方形',detail:'四个直角、四边等长的四边形。'},{id:'rectangle',label:'矩形',detail:'四个内角都是直角的四边形。'}],
 edges:[{from:'square',to:'rectangle',label:'是其特例'}],
};
const numeric=(text,n)=>new RegExp('(?:^|[^0-9])'+n+'(?:$|[^0-9])').test(text);
export const outputCases=[
 {mode:'visualize',selection:'在 {1,2,3} 上，σ = (1 2 3)。',question:'演示这个具体置换逐次作用。',kind:'permutation',selector:'.power-slider',
  fields:{n:3,sigma:[2,3,1],order:'right-first'},check:({plan})=>assert.deepEqual(plan.sigma,[1,2,0])},
 {mode:'diagram',selection:'先检查误差。若误差达标就结束，否则更新参数并返回检查。',question:'画出这条带回路的流程。',kind:'diagram',selector:'.graph-node',
  fields:{diagram:diagram.diagram},check:({plan})=>{
   const decision=plan.diagram.nodes.find(n=>n.type==='decision');assert.ok(decision);
   const edges=plan.diagram.edges;
   const queue=edges.filter(e=>e.from===decision.id).map(e=>e.to),seen=new Set();
   while(queue.length){const id=queue.shift();if(id===decision.id)return;if(!seen.has(id)){seen.add(id);queue.push(...edges.filter(e=>e.from===id).map(e=>e.to));}}
   assert.fail('The update path must return to the decision');
  }},
 {mode:'derive',selection:'已知 2x+3=11。',question:'用至少两步推导出 x 的值，每步用阿拉伯数字写出等式。',kind:'derivation',selector:'.reading-steps li',
  fields:{steps:steps('两侧同时减 3，得到 $2x=8$。','两侧同时除以 2，得到 $x=4$。')},check:({plan})=>{assert.ok(plan.steps.length>=2);assert.match(plan.steps.map(s=>s.text).join(''),/x\s*=\s*4/i);}},
 {mode:'compare',selection:'甲方案用时 2 天、费用 10 元，乙方案用时 3 天、费用 8 元。',question:'以方案为行、用时和费用为列，用阿拉伯数字比较甲乙。',kind:'comparison',selector:'.comparison-table td',
  fields:{columns:['方案','用时（天）','费用（元）'],rows:[['甲','2','10'],['乙','3','8']]},check:({plan})=>{
   for(const [name,days,cost] of [['甲',2,10],['乙',3,8]]){
    const row=plan.rows.find(r=>r.some(c=>c.includes(name)));assert.ok(row);
    const timeCol=plan.columns.findIndex(c=>/时|天/.test(c)),costCol=plan.columns.findIndex(c=>/费|成本|元/.test(c));
    assert.ok(timeCol>=0&&costCol>=0&&numeric(row[timeCol],days)&&numeric(row[costCol],cost));
   }
  }},
 {mode:'3d',selection:'立方体绕正 z 轴按右手定则旋转 90°。',question:'用两句话介绍，然后按原文演示这次三维旋转。',kind:'geometry',selector:'.geometry-view input[type=range]',
  fields:{shape:'cube',axis:[0,0,1],angle:90},check:({plan})=>{assert.equal(plan.shape,'cube');assert.equal(plan.axis[0],0);assert.equal(plan.axis[1],0);assert.equal((Math.sign(plan.axis[2])*plan.angle+360)%360,90);}},
 {mode:'anatomy',selection:'底座固定，滑块只沿正 x 轴平移。尺寸仅作示意。',question:'标出底座和滑块，用一个增大的位移控件让滑块沿正 x 移动。',kind:'anatomy',selector:'.anatomy-controls input',
  fields:{scene:anatomy.scene},check:({plan})=>{const base=plan.scene.parts.find(p=>p.label.includes('底座')),slide=plan.scene.parts.find(p=>p.label.includes('滑块'));assert.ok(base&&!base.motion&&slide?.motion);const [x,y,z]=slide.motion.translate;assert.ok(x>0&&y===0&&z===0);assert.ok(plan.scene.controls.some(c=>c.id===slide.motion.control));}},
 {mode:'concept',selection:'正方形有四个直角且四边相等，所以每个正方形都是矩形。',question:'用概念关系图说明正方形与矩形之间的包含关系。',kind:'concept',selector:'.graph-node',
  fields:{visual:concept},check:({visual})=>{const labels=visual.nodes.map(n=>n.label).join(' ');assert.match(labels,/正方形/);assert.match(labels,/矩形/);assert.ok(visual.edges.some(e=>e.label.trim()));}},
 {mode:'steps',selection:'从 2 开始，先乘 3，再加 1。',question:'依次演示每一步，用阿拉伯数字写明中间值和最终值。',kind:'process',selector:'.step-navigation',
  fields:{steps:steps('从 2 开始。','乘 3 得到 6。','加 1 得到 7。')},check:({plan})=>{assert.ok(plan.steps.length>=2);assert.ok(numeric(plan.steps.map(s=>s.text).join(' '),6));assert.ok(numeric(plan.steps.at(-1).text,7));}},
 {mode:'explain',selection:'一半可以写为 1/2。',question:'用一句话说明 1/2 对应的小数，请写出这个小数。',kind:'explain',selector:'.reading-answer p',
  fields:{},check:({answer})=>assert.match(answer.paragraphs.map(p=>p.text).join(' '),/0\.5/)},
];

export function fixtureFor(c){
 return {kind:c.kind,object:c.selection,reason:c.question,...c.fields,explanation:{title:c.mode,paragraphs:[{text:c.mode==='explain'?'一半的小数是 0.5。':c.selection,sources:[{page:1,quote:c.selection}]}]}};
}
