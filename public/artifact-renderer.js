import {mountAnatomy} from './anatomy-view.js';
import {mountDisplay} from './display-view.js';
import {mountGeometry} from './geometry-view.js';
import {mountConcept} from './concept-view.js';
import {node} from './workspace-ui.js';

export async function mountDocumentVisual(host,plan,{saved={},onState=()=>{},renderMath=()=>{},source={},onSave=()=>{}}={}){
 const options={saved,onState,renderMath};
 if(plan.kind==='anatomy')return mountAnatomy(host,plan,options);
 if(plan.kind==='diagram')return mountConcept(host,plan.diagram,source,onSave,renderMath,null,{...options,flowchart:true});
 if(plan.kind==='geometry')return mountGeometry(host,plan,options);
 if(['comparison','derivation','process'].includes(plan.kind))return mountDisplay(host,plan,options);
 if(plan.kind==='document'){
  const disposers=[],state=structuredClone(saved.blocks||{});
  for(const block of plan.blocks){const section=node('section',undefined,{className:'document-block'});section.dataset.blockId=block.id;host.append(section);
   if(block.type==='text'){for(const text of block.text.split(/\n\s*\n/))section.append(node('p',text));renderMath(section);}
   else disposers.push(await mountDocumentVisual(section,block.display,{...options,source,onSave,saved:state[block.id]||{},onState:value=>{state[block.id]=value;onState({blocks:structuredClone(state)});}}));
  }
  return ()=>disposers.forEach(dispose=>dispose?.());
 }
 return ()=>{};
}
