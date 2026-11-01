export const DISPLAY_KINDS=['comparison','derivation','process','geometry'];
const text=(v,max=4000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid display text');return v;};
export function parseDisplayPlan(value){const v=structuredClone(value),plan={kind:v.kind,object:text(v.object,160),reason:text(v.reason,600)};
 if(v.kind==='comparison'){if(!Array.isArray(v.columns)||v.columns.length<2||v.columns.length>5||!Array.isArray(v.rows)||!v.rows.length||v.rows.length>20)throw Error('Invalid comparison');plan.columns=v.columns.map(x=>text(x,100));plan.rows=v.rows.map(row=>{if(!Array.isArray(row)||row.length!==plan.columns.length)throw Error('Column count mismatch');return row.map(x=>text(x,2000));});}
 else if(['derivation','process'].includes(v.kind)){if(!Array.isArray(v.steps)||!v.steps.length||v.steps.length>20)throw Error('Invalid steps');plan.steps=v.steps.map(s=>({title:text(s.title,100),text:text(s.text),basis:['source','deduction','example'].includes(s.basis)?s.basis:'deduction'}));}
 else if(v.kind==='geometry'){if(!['cube','tetrahedron','octahedron'].includes(v.shape)||!Array.isArray(v.axis)||v.axis.length!==3||!v.axis.every(x=>Number.isFinite(x)&&Math.abs(x)<=100)||Math.hypot(...v.axis)<1e-8||!Number.isFinite(v.angle)||Math.abs(v.angle)>360)throw Error('Invalid geometric transformation');Object.assign(plan,{shape:v.shape,axis:v.axis,angle:v.angle});}
 else throw Error('Unsupported display');return plan;
}
