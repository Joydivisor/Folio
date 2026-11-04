const text=(v,n=160)=>{if(typeof v!=='string'||!v.trim()||v.length>n)throw Error('Invalid illustration text');return v;};
const vector=(v,positive=false)=>{if(!Array.isArray(v)||v.length!==3||!v.every(n=>Number.isFinite(n)&&Math.abs(n)<=500&&(!positive||n>0)))throw Error('Invalid illustration vector');return [...v];};
const number=(v,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error('Invalid illustration parameter');return v;};
export function parseAnatomy(v){
 if(!v||v.version!==1||!Array.isArray(v.parts)||!v.parts.length||v.parts.length>80||!Array.isArray(v.controls||[])||(v.controls||[]).length>4)throw Error('Invalid illustration scene');
 const ids=new Set(),controls=(v.controls||[]).map(c=>{const id=text(c.id,40);if(!/^[a-z][\w-]*$/i.test(id)||ids.has(id))throw Error('Invalid control ID');ids.add(id);const min=number(c.min,-100,100),max=number(c.max,min+.001,100);return {id,label:text(c.label,80),min,max,value:number(c.value,min,max),unit:typeof c.unit==='string'?c.unit.slice(0,16):''};});
 const partIds=new Set(),parts=v.parts.map(p=>{const id=text(p.id,40);if(!/^[a-z][\w-]*$/i.test(id)||partIds.has(id)||!['box','cylinder','spring'].includes(p.type))throw Error('Invalid illustration part');partIds.add(id);
  const part={id,type:p.type,label:text(p.label,100),position:vector(p.position),size:vector(p.size,true),tone:['lo','mid','hi'].includes(p.tone)?p.tone:'mid',detail:typeof p.detail==='string'?p.detail.slice(0,1200):''};
  if(p.motion){if(!ids.has(p.motion.control))throw Error('Unknown motion control');part.motion={control:p.motion.control,translate:vector(p.motion.translate)};}
  if(p.type==='spring')part.turns=number(p.turns??8,2,24);return part;
 });
 return {version:1,caption:text(v.caption,1200),parts,controls};
}
export function anatomyPositions(scene,values={}){
 const controls=Object.fromEntries(scene.controls.map(c=>[c.id,Math.max(c.min,Math.min(c.max,Number.isFinite(values[c.id])?values[c.id]:c.value))]));
 return scene.parts.map(p=>({...p,position:p.position.map((n,i)=>n+(p.motion?p.motion.translate[i]*controls[p.motion.control]:0))}));
}
export const anatomyInstructions=`anatomy：用于机械结构、仪器、部件关系和受控平移的轴测示意，不用于普通流程图、真实测量或未提供模型的物理仿真。提供 scene={version:1,caption,controls:[],parts:[]}。零件最多80个，controls最多4个。每个零件 {id,type:"box|cylinder|spring",label,detail,position:[x,y,z],size:[宽,深,高],tone:"lo|mid|hi"}；z向上，所有尺寸为正数且<=500；cylinder 使用 size[0]/2 为半径，size[2]为高度；spring 为竖直弹簧，可填 turns=2到24。控制 {id,label,min,max,value,unit}，范围在-100到100。零件可有 motion:{control:"控制id",translate:[dx,dy,dz]}，最终坐标=position+控制值*translate。不输出HTML、JS、表达式、链接或工具调用；应用完成绘制。caption说明模型、单位和必要示意假设，不能冒充工程精度。例：{"version":1,"caption":"滑块沿导轨平移的结构示意，单位为示意坐标。","controls":[{"id":"travel","label":"位移","min":0,"max":40,"value":0,"unit":""}],"parts":[{"id":"base","type":"box","label":"底座","position":[0,0,0],"size":[120,60,8],"tone":"lo"},{"id":"rail","type":"box","label":"导轨","position":[12,25,8],"size":[96,10,8]},{"id":"slide","type":"box","label":"滑块","position":[20,15,16],"size":[30,30,18],"tone":"hi","motion":{"control":"travel","translate":[1,0,0]}}]}。此协议对所有模型相同，不依赖Claude工具。`;
