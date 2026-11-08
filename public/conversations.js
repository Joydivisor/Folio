export const CHAT_STATE_KEY='folio-active-conversation';
const clone=value=>structuredClone(value);
function cleanSource(source={}){const {image,...saved}=source;return clone(saved);}
export function validateConversation(value){
 if(value===null)return null;
 if(!value||typeof value.id!=='string'||typeof value.question!=='string'||typeof value.createdAt!=='string'||!Array.isArray(value.turns)||value.turns.length>100000)throw Error('Invalid conversation');
 for(const t of value.turns)if(typeof t.id!=='string'||typeof t.question!=='string'||!Array.isArray(t.answer?.paragraphs)||t.answer.paragraphs.some(p=>typeof p.text!=='string'||!Array.isArray(p.sources)))throw Error('Invalid conversation turn');
 return clone(value);
}
export function createConversations({enabled=()=>false,save=()=>{},onChange=()=>{},id=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){
 let active=null;
 const changed=()=>onChange(active?clone(active):null);
 function snapshot(){if(!active?.turns.length)return null;
  const turns=structuredClone(active.turns),source={...active.source};
  const title=active.question.slice(0,120);
  const points=turns.map((turn,i)=>{const paragraphs=turn.answer.paragraphs.map(p=>p.text);const excerpt=[...new Set([paragraphs[0],paragraphs.at(-1)])].filter(Boolean);return '### '+(i+1)+'. '+turn.question+'\n\n'+excerpt.join('\n\n');});
  return {id:'conversation:'+active.id,kind:'conversation',title,question:active.question,source,turns,artifact:active.artifact?structuredClone(active.artifact):null,createdAt:active.createdAt,updatedAt:now(),date:new Date(active.createdAt).toLocaleString('zh-CN'),format:'markdown',text:'## 对话要点\n\n'+points.join('\n\n')};
 }
 return {
  get current(){return active;},restore(value){active=validateConversation(value);},
  begin(source,question){this.archive();active={id:id(),source:cleanSource(source),question,createdAt:now(),turns:[],artifact:null};changed();return active.id;},
  ensure(source,question){return active?.id||this.begin(source,question);},isCurrent(token){return active?.id===token;},
  complete(token,question,answer,plan,{source=active?.source,context=null}={}){
   if(!this.isCurrent(token))return false;
   active.source=cleanSource(source);active.turns.push({id:id(),question,source:cleanSource(source),context:clone(context),answer:clone(answer),plan:clone(plan)});changed();return true;
  },
  updateTurn(token,turnId,changes){if(!this.isCurrent(token))return false;const turn=active.turns.find(t=>t.id===turnId);if(!turn)return false;for(const key of ['quiz','quizAttempt','artifactId'])if(key in changes)turn[key]=clone(changes[key]);changed();return true;},
  setArtifact(token,artifact){if(this.isCurrent(token)){active.artifact=clone(artifact);changed();}},
  history(){return (active?.turns||[]).map(t=>({question:t.question,answer:t.answer.paragraphs.map(p=>p.text).join('\n'),source:cleanSource(t.source),context:t.context,plan:t.plan,...(t.quiz?{quiz:t.quiz,quizAttempt:t.quizAttempt}:{} )}));},
  snapshot,archive(){if(enabled()){const note=snapshot();if(note)save(note);}},reset(){this.archive();active=null;changed();}
 };
}
export function noteRoute(note){return '#/notes/'+encodeURIComponent(note.id);}
export function noteTrail(note){const s=note.source;return ['笔记',s?.name||'未关联文献',Number.isInteger(s?.page)&&s.page>0?'第 '+s.page+' 页':null,note.title||note.question||'手动笔记'].filter(Boolean);}
