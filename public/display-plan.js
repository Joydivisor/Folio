import {validateMesh} from './geometry-model.js';
import {parseDiagram} from './diagram-plan.js';
import {parseAnatomy} from './anatomy-plan.js';
export const DISPLAY_KINDS=['comparison','derivation','process','geometry','diagram','anatomy','document'];
const text=(v,max=4000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid display text');return v;};
export function parseDisplayPlan(value){const v=structuredClone(value),plan={kind:v.kind,object:text(v.object,160),reason:text(v.reason,600)};
 if(v.kind==='comparison'){if(!Array.isArray(v.columns)||v.columns.length<2||v.columns.length>5||!Array.isArray(v.rows)||!v.rows.length||v.rows.length>20)throw Error('Invalid comparison');plan.columns=v.columns.map(x=>text(x,100));plan.rows=v.rows.map(row=>{if(!Array.isArray(row)||row.length!==plan.columns.length)throw Error('Column count mismatch');return row.map(x=>text(x,2000));});}
 else if(['derivation','process'].includes(v.kind)){if(!Array.isArray(v.steps)||!v.steps.length||v.steps.length>20)throw Error('Invalid steps');plan.steps=v.steps.map(s=>({title:text(s.title,100),text:text(s.text),basis:['source','deduction','example'].includes(s.basis)?s.basis:'deduction'}));}
 else if(v.kind==='geometry'){if(!['cube','tetrahedron','octahedron','sphere','cylinder','cone','mesh'].includes(v.shape)||!Array.isArray(v.axis)||v.axis.length!==3||!v.axis.every(x=>Number.isFinite(x)&&Math.abs(x)<=100)||Math.hypot(...v.axis)<1e-8||!Number.isFinite(v.angle)||Math.abs(v.angle)>360)throw Error('Invalid geometric transformation');Object.assign(plan,{shape:v.shape,axis:v.axis,angle:v.angle});if(v.shape==='mesh')Object.assign(plan,validateMesh(v.vertices,v.faces));}
 else if(v.kind==='diagram')plan.diagram=parseDiagram(v.diagram);
 else if(v.kind==='anatomy')plan.scene=parseAnatomy(v.scene);
 else if(v.kind==='document'){
  if(!Array.isArray(v.blocks)||!v.blocks.length||v.blocks.length>12)throw Error('Invalid document blocks');const ids=new Set();
  plan.blocks=v.blocks.map(b=>{if(typeof b.id!=='string'||!/^[a-z][\w-]{0,39}$/i.test(b.id)||ids.has(b.id))throw Error('Invalid block ID');ids.add(b.id);if(b.type==='text')return {id:b.id,type:'text',text:text(b.text,8000)};if(b.type!=='visual'||!DISPLAY_KINDS.includes(b.display?.kind)||b.display.kind==='document')throw Error('Invalid visual block');return {id:b.id,type:'visual',display:parseDisplayPlan(b.display)};});
 }
 else throw Error('Unsupported display');return plan;
}
