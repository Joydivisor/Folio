// A shared moving selection surface. Native buttons keep their existing actions.
let initialized=false,nextId=0;
export function enhanceSegments(){
 if(initialized)return;initialized=true;
 const groups=new Map(),selector='.tabs,.view-switch,.segmented';
 function mount(group){
  if(groups.has(group)||!group.isConnected)return;
  group.classList.add('sliding-segments');const tabs=group.classList.contains('tabs');
  group.setAttribute('role',tabs?'tablist':'group');
  let frame=0,drag=null,suppressClick=false,committing=false;
  const buttons=()=>[...group.children].filter(b=>b.tagName==='BUTTON'&&!b.hidden&&getComputedStyle(b).display!=='none');
  const set=(element,name,value)=>{if(element.getAttribute(name)!==String(value))element.setAttribute(name,String(value));};
  function place(button){
   if(!button||!group.clientWidth){if(group.classList.contains('segment-ready'))group.classList.remove('segment-ready');return;}
   const box=group.getBoundingClientRect(),rect=button.getBoundingClientRect();
   for(const [key,value] of Object.entries({x:rect.left-box.left-group.clientLeft,y:rect.top-box.top-group.clientTop,width:rect.width,height:rect.height}))group.style.setProperty('--segment-'+key,value+'px');
   if(!group.classList.contains('segment-ready'))group.classList.add('segment-ready');
  }
  function sync(){
   frame=0;const list=buttons(),active=list.find(b=>b.classList.contains('active'))||list[0];
   for(const button of list){
    const selected=button===active;set(button,'tabindex',selected?0:-1);
    if(tabs){
     button.id||=`folio-tab-${++nextId}`;set(button,'role','tab');set(button,'aria-selected',selected);
     if(button.dataset.tab){const panel=document.getElementById(button.dataset.tab+'Panel');if(panel){set(button,'aria-controls',panel.id);set(panel,'role','tabpanel');set(panel,'aria-labelledby',button.id);}}
    }else set(button,'aria-pressed',selected);
   }
   if(!drag?.moved)place(active);
  }
  const queue=()=>{if(!frame)frame=requestAnimationFrame(sync);};
  group.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   const list=buttons().filter(b=>!b.disabled),index=list.indexOf(document.activeElement);if(index<0)return;
   event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?list.length-1:(index+(event.key==='ArrowRight'?1:-1)+list.length)%list.length;
   list[next]?.focus({preventScroll:true});list[next]?.click();queue();
  });
  group.addEventListener('click',event=>{if(suppressClick&&!committing){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
  group.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;const button=event.target.closest('button');if(!button||button.disabled||button.parentElement!==group)return;
   const active=buttons().find(b=>b.classList.contains('active'))||button,rect=active.getBoundingClientRect(),box=group.getBoundingClientRect();
   drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left-box.left-group.clientLeft,width:rect.width,moved:false};
  });
  group.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;if(!(event.buttons&1)){finish(event,true);return;}const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
   if(!drag.moved){if(Math.abs(dx)<5||Math.abs(dx)<Math.abs(dy))return;drag.moved=true;group.setPointerCapture(event.pointerId);group.classList.add('segment-dragging');}
   event.preventDefault();const list=buttons(),box=group.getBoundingClientRect(),first=list[0]?.getBoundingClientRect(),last=list.at(-1)?.getBoundingClientRect();
   if(first&&last)group.style.setProperty('--segment-x',Math.max(first.left-box.left-group.clientLeft,Math.min(last.right-box.left-group.clientLeft-drag.width,drag.left+dx))+'px');
  });
  function finish(event,cancel=false){
   if(!drag||event.pointerId!==drag.id)return;const moved=drag.moved;drag=null;group.classList.remove('segment-dragging');
   if(group.hasPointerCapture(event.pointerId))group.releasePointerCapture(event.pointerId);
   if(moved&&!cancel){
    const list=buttons().filter(b=>!b.disabled),target=list.reduce((best,b)=>{const r=b.getBoundingClientRect(),distance=Math.abs(event.clientX-r.left-r.width/2);return !best||distance<best.distance?{button:b,distance}:best;},null)?.button;
    suppressClick=true;committing=true;target?.focus({preventScroll:true});target?.click();committing=false;setTimeout(()=>suppressClick=false,0);
   }queue();
  }
  group.addEventListener('pointerup',event=>finish(event));group.addEventListener('pointercancel',event=>finish(event,true));group.addEventListener('lostpointercapture',event=>finish(event,true));
  group.addEventListener('pointerleave',()=>{if(drag&&!drag.moved)drag=null;});
  const resize=new ResizeObserver(queue),changes=new MutationObserver(queue);resize.observe(group);
  changes.observe(group,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
  groups.set(group,()=>{resize.disconnect();changes.disconnect();cancelAnimationFrame(frame);});queue();
 }
 function scan(root){if(root.nodeType!==1&&root!==document)return;if(root.matches?.(selector))mount(root);root.querySelectorAll(selector).forEach(mount);}
 scan(document);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);for(const [group,dispose] of groups)if(!group.isConnected){dispose();groups.delete(group);}}).observe(document.body,{childList:true,subtree:true});
}
