import {mountAnatomy} from './anatomy-view.js';
import {mountDisplay} from './display-view.js';
import {mountGeometry} from './geometry-view.js';
import {mountConcept} from './concept-view.js';
import {node} from './workspace-ui.js';
import {mountPermutation} from './permutation-view.js';
import {mountDerived} from './derived-view.js';

// Canvas and notebook use the same renderers and interaction schema.
export function mountArtifactVisual(host,version,{source={},onSave=()=>{},renderMath=()=>{},onState=()=>{}}={}){
 const p=version.plan,options={saved:version.interaction||{},onState,renderMath};
 if(p.kind==='permutation')return mountPermutation(host,p,onSave,options.saved.kind==='permutation-state'?options.saved:undefined,onState);
 if(p.kind==='derived')return mountDerived(host,p,options);
 if(p.kind==='tetrahedron')return mountGeometry(host,{...p,shape:'tetrahedron',axis:p.operation==='vertex'?[1,1,1]:[1,0,0],angle:p.operation==='vertex'?120:180},options);
 if(p.kind==='concept'&&version.visual)return mountConcept(host,version.visual,source,onSave,renderMath,null,options);
 return mountDocumentVisual(host,p,{...options,source,onSave});
}

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
