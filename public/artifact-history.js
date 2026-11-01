const clone=value=>structuredClone(value);
export function createArtifact(source,plan,answer,visual=null){return {id:crypto.randomUUID(),source:clone(source),cursor:0,versions:[{id:crypto.randomUUID(),date:new Date().toISOString(),label:'Initial',plan:clone(plan),answer:clone(answer),visual:clone(visual),interaction:{}}]};}
export function currentVersion(artifact){if(!artifact||!Array.isArray(artifact.versions)||!Number.isInteger(artifact.cursor)||!artifact.versions[artifact.cursor])throw Error('Invalid artifact history');return clone(artifact.versions[artifact.cursor]);}
export function reviseArtifact(artifact,baseId,changes,label='Revision'){
 const previous=currentVersion(artifact);if(previous.id!==baseId)throw Error('This result belongs to an older version. Your current edits were kept.');
 if(!changes||Object.keys(changes).some(k=>!['plan','answer','visual','interaction'].includes(k)))throw Error('Invalid artifact change');
 const next=clone(artifact);next.versions=next.versions.slice(0,next.cursor+1);next.versions.push({...previous,...clone(changes),id:crypto.randomUUID(),date:new Date().toISOString(),label:String(label).slice(0,100)});next.cursor=next.versions.length-1;return next;
}
export function moveVersion(artifact,index){currentVersion(artifact);if(!Number.isInteger(index)||index<0||index>=artifact.versions.length)throw Error('Version does not exist');const next=clone(artifact);next.cursor=index;return next;}
