// Text-only edits retain camera, selection, playback and slider positions.
export function sameArtifactParameters(a,b){
 if(a.kind!==b.kind)return false;
 const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
 if(!['n','sigma','tau','order','shape','axis','angle','operation','vertices','faces'].every(k=>same(a[k],b[k])))return false;
 if(a.steps?.length!==b.steps?.length)return false;
 const scene=s=>s&&{controls:s.controls.map(({id,min,max,value})=>({id,min,max,value})),parts:s.parts.map(({id,type,position,size,motion,turns})=>({id,type,position,size,motion,turns}))};
 if(!same(scene(a.scene),scene(b.scene)))return false;
 if(a.blocks||b.blocks)return a.blocks?.length===b.blocks?.length&&a.blocks.every((block,i)=>block.id===b.blocks[i].id&&block.type===b.blocks[i].type&&(block.type==='text'||sameArtifactParameters(block.display,b.blocks[i].display)));
 return true;
}
