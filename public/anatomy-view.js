import * as k from './vendor/anatomy/iso-kit.mjs';
import {parseAnatomy,anatomyPositions} from './anatomy-plan.js';
import {node,button,ui} from './workspace-ui.js';
export function mountAnatomy(host,plan,{saved={},onState=()=>{}}={}){
 const scene=parseAnatomy(plan.scene),root=node('section',undefined,{className:'anatomy-view iso'}),style=node('style',k.ISO_CSS),stage=node('div'),controls=node('div',undefined,{className:'anatomy-controls'}),detail=node('p',scene.caption,{className:'anatomy-caption'}),parts=node('div',undefined,{className:'anatomy-parts'});
 const values=Object.fromEntries(scene.controls.map(c=>[c.id,Number.isFinite(saved.values?.[c.id])?Math.max(c.min,Math.min(c.max,saved.values[c.id])):c.value]));
 root.append(style,node('h2',plan.object),stage,detail,controls,parts);host.append(root);
 // Fit all endpoint poses once; slider movement never changes the camera scale.
 const corners=[];for(const p of scene.parts){const c=scene.controls.find(c=>c.id===p.motion?.control);for(const value of c?[c.min,c.max]:[0]){const pos=p.position.map((x,i)=>x+(p.motion?p.motion.translate[i]*value:0)),radius=p.type==='box'?0:p.size[0]/2;corners.push(...k.boxCorners({x:pos[0]-radius,y:pos[1]-radius,w:p.type==='box'?p.size[0]:radius*2,d:p.type==='box'?p.size[1]:radius*2},pos[2],pos[2]+p.size[2]));}}
 const P=k.fitProjection(corners,640,400,{pad:30});
 function draw(){root.dataset.theme=document.documentElement.dataset.theme==='dark'?'dark':'light';const shapes=anatomyPositions(scene,values).sort((a,b)=>k.depthOf(a.position,P)-k.depthOf(b.position,P));
  const body=shapes.map(p=>{const [x,y,z]=p.position,[w,d,h]=p.size;if(p.type==='spring')return k.lineSvg(k.pathOf(Array.from({length:Math.ceil(p.turns*16)+1},(_,i)=>{const t=i/Math.ceil(p.turns*16),a=t*p.turns*2*Math.PI;return k.iso([x+w/2*Math.cos(a),y+w/2*Math.sin(a),z+h*t],P);})),{tone:p.tone});const paths=p.type==='box'?k.slabOf({x,y,w,d,r:Math.min(2,w/8,d/8)},z,h,P,8,.5):k.cylinder(x,y,w/2,z,h,P,32,.5);return k.solidSvg(paths,{tone:p.tone,lit:p.tone==='hi'});}).join('');
  // All markup comes from the trusted kit with finite numeric arguments, never model HTML.
  stage.innerHTML=k.figureSvg({width:640,height:400,label:plan.object,body});onState({values:{...values}});
 }
 for(const c of scene.controls){const label=node('label'),output=node('output'),slider=node('input',undefined,{type:'range',min:String(c.min),max:String(c.max),step:String((c.max-c.min)/200),value:String(values[c.id])});slider.setAttribute('aria-label',c.label);const update=()=>{output.textContent=Number(values[c.id].toFixed(2))+' '+c.unit;};label.append(node('span',c.label),output,slider);slider.oninput=()=>{values[c.id]=Number(slider.value);update();draw();};update();controls.append(label);}
 for(const p of scene.parts)parts.append(button(p.label,()=>{detail.textContent=p.label+(p.detail?'：'+p.detail:'');}));parts.append(button(ui('说明','Description'),()=>detail.textContent=scene.caption));
 const observer=new MutationObserver(draw);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});draw();return ()=>observer.disconnect();
}
