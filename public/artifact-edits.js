import {DISPLAY_KINDS,parseDisplayPlan} from './display-plan.js';
import {parseGraph} from './graph-schema.js';
// A model may change named fields, never paths, prototypes or executable content.
export function applyArtifactEdits(version,edits){
 if(!version||!Array.isArray(edits)||!edits.length||edits.length>24)throw Error('Invalid artifact edits');
 const next=structuredClone(version);
 for(const e of edits){
  if(!e||!e.changes||typeof e.changes!=='object'||Array.isArray(e.changes))throw Error('Invalid edit');
  let p=next.plan,block;if(e.blockId){block=p.blocks?.find(b=>b.id===e.blockId);if(!block)throw Error('Block no longer exists');p=block.display||p;}
  let target,allowed;
  if(e.target==='node'){target=(p.diagram||next.visual)?.nodes?.find(n=>n.id===e.id);allowed=['label','detail'];}
  else if(e.target==='edge'){target=(p.diagram||next.visual)?.edges?.find(n=>n.from===e.from&&n.to===e.to);allowed=['label'];}
  else if(e.target==='step'){if(!Number.isInteger(e.index)||e.index<0)throw Error('Invalid step index');target=p.steps?.[e.index];allowed=['title','text'];}
  else if(e.target==='text'){if(block?.type!=='text'&&(!Number.isInteger(e.index)||e.index<0))throw Error('Invalid text index');target=block?.type==='text'?block:next.answer.paragraphs[e.index];allowed=['text'];}
  else if(e.target==='part'){target=p.scene?.parts?.find(n=>n.id===e.id);allowed=['label','detail'];}
  if(!target||!allowed||!Object.keys(e.changes).length||Object.keys(e.changes).some(k=>!allowed.includes(k)||typeof e.changes[k]!=='string'||!e.changes[k].trim()||e.changes[k].length>4000))throw Error('Edit target or fields are invalid');
  Object.assign(target,e.changes);if(target.sources)target.sources=[];if(target.basis)target.basis='deduction';if(target.evidence){target.evidence='';target.evidenceVerified=false;}
 }
 if(DISPLAY_KINDS.includes(next.plan.kind)){const original=next.plan;next.plan=parseDisplayPlan(original);const preserve=(parsed,old)=>{if(old.presentation)parsed.presentation=old.presentation;if(parsed.steps)parsed.steps.forEach((s,i)=>{s.sources=structuredClone(old.steps[i].sources||[]);});if(parsed.blocks)parsed.blocks.forEach((b,i)=>{if(b.type==='visual')preserve(b.display,old.blocks[i].display);});};preserve(next.plan,original);}
 if(next.visual)next.visual=parseGraph(JSON.stringify(next.visual),(version.visual?.nodes||[]).filter(n=>n.evidenceVerified).map(n=>n.evidence).join('\n'));
 return {plan:next.plan,answer:next.answer,visual:next.visual,parameterEvidence:[],action:'revise'};
}
