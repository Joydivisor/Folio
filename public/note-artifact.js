import {mountArtifactVisual} from './artifact-renderer.js';
import {hasPresentation} from './learning-actions.js';
import {node,button,ui,showError} from './workspace-ui.js';

// A note owns its snapshot. Exploring it never mutates the original canvas.
export function mountNoteArtifact(host,note,{renderMath,onChanged=()=>{},open=false}={}){
 if(note.artifact?.kind!=='folio-artifact')return ()=>{};
 const record=note.artifact.record,version=record?.versions?.[record.cursor];if(!version||!hasPresentation(version))return ()=>{};
 const root=node('details',undefined,{className:'note-interactive',open}),summary=node('summary',ui('交互图示','Interactive illustration')),stage=node('div',undefined,{className:'note-artifact-stage'}),bar=node('div',undefined,{className:'note-artifact-actions'}),status=node('span','');
 let cleanup=null,token=0,disposed=false,mounted=false,hydrated=false,interaction=structuredClone(version.interaction||{}),baseline=JSON.stringify(interaction),initializing=false;
 status.setAttribute('role','status');
 const save=node('button',ui('保存当前状态','Save current state'),{type:'button'});
 save.onclick=async()=>{if(save.disabled)return;save.disabled=true;try{version.interaction=structuredClone(interaction);if(interaction.kind==='permutation-state')version.plan=structuredClone(interaction.plan);baseline=JSON.stringify(interaction);await onChanged();if(!disposed)status.textContent=ui('状态已保存','State saved');}catch(error){if(!disposed){save.disabled=false;showError(error.message);}}};
 const reset=button(ui('回到保存状态','Reset to saved state'),()=>mount(true));
 bar.append(save,reset,status);root.append(summary,bar,stage);host.append(root);save.disabled=true;
 function changed(value){interaction=structuredClone(value);if(!initializing){save.disabled=JSON.stringify(interaction)===baseline;status.textContent=save.disabled?'':ui('有未保存的操作','Unsaved interaction');}}
 async function mount(reset=false){
  const id=++token;cleanup?.();cleanup=null;stage.replaceChildren();mounted=true;initializing=true;if(reset)interaction=structuredClone(version.interaction||{});status.textContent='';save.disabled=true;
  try{const dispose=await mountArtifactVisual(stage,{...version,interaction},{source:record.source,renderMath,onState:value=>{if(!disposed&&id===token)changed(value);},onSave:async()=>{version.interaction=structuredClone(interaction);baseline=JSON.stringify(interaction);await onChanged();}});
   if(disposed||id!==token){dispose?.();return;}cleanup=dispose;if(reset||!hydrated)baseline=JSON.stringify(interaction);hydrated=true;
  }catch(error){if(!disposed&&id===token)stage.replaceChildren(node('p',ui('图示暂时无法打开：','Unable to open illustration: ')+error.message));}
  finally{if(id===token){initializing=false;changed(interaction);}}
 }
 root.ontoggle=()=>{if(root.open&&!mounted&&!disposed)mount();else if(!root.open&&mounted){cleanup?.();cleanup=null;token++;mounted=false;}};
 if(open)mount();
 return ()=>{disposed=true;token++;cleanup?.();cleanup=null;root.ontoggle=null;};
}
