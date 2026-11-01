export function createConversations({enabled=()=>false,save=()=>{},id=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){
 let active=null;
 function snapshot(){if(!active?.turns.length)return null;
  const turns=structuredClone(active.turns),source={...active.source};
  const title=active.question.slice(0,120);
  const points=turns.map((turn,i)=>{const paragraphs=turn.answer.paragraphs.map(p=>p.text);const excerpt=[...new Set([paragraphs[0],paragraphs.at(-1)])].filter(Boolean);return '### '+(i+1)+'. '+turn.question+'\n\n'+excerpt.join('\n\n');});
  return {id:'conversation:'+active.id,kind:'conversation',title,question:active.question,source,turns,artifact:active.artifact?structuredClone(active.artifact):null,createdAt:active.createdAt,updatedAt:now(),date:new Date(active.createdAt).toLocaleString('zh-CN'),format:'markdown',text:'## 对话要点\n\n'+points.join('\n\n')};
 }
 return {get current(){return active;},begin(source,question){this.archive();active={id:id(),source:{id:source.id,documentId:source.documentId,revision:source.revision,name:source.name,page:source.page,text:source.text||'',...(source.rect?{rect:[...source.rect]}:{}),...(source.regionId?{regionId:source.regionId}:{})},question,createdAt:now(),turns:[],artifact:null};return active.id;},isCurrent(token){return active?.id===token;},complete(token,question,answer,plan){if(!this.isCurrent(token))return false;active.turns.push({question,answer:structuredClone(answer),plan:structuredClone(plan)});return true;},setArtifact(token,artifact){if(this.isCurrent(token))active.artifact=structuredClone(artifact);},history(){if(!active)return [];let budget=8000;const result=[];for(const t of [...active.turns].reverse().slice(0,6)){if(budget<600)break;const question=t.question.slice(0,500),answer=t.answer.paragraphs.map(p=>p.text).join('\n').slice(0,Math.min(2200,budget-question.length));result.unshift({question,answer});budget-=question.length+answer.length;}return result;},snapshot,archive(){if(enabled()){const note=snapshot();if(note)save(note);}},reset(){this.archive();active=null;}};
}
export function noteRoute(note){return '#/notes/'+encodeURIComponent(note.id);}
export function noteTrail(note){const s=note.source;return ['笔记',s?.name||'未关联文献',Number.isInteger(s?.page)&&s.page>0?'第 '+s.page+' 页':null,note.title||note.question||'手动笔记'].filter(Boolean);}
