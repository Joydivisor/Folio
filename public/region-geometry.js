export const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
export function rectangle(a,b){return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])];}
export function adjustRectangle(rect,handle,dx,dy){
 const [x,y,w,h]=rect;
 if(handle==='move')return [clamp(x+dx,0,1-w),clamp(y+dy,0,1-h),w,h];
 let left=x,top=y,right=x+w,bottom=y+h;
 if(handle.includes('w'))left=clamp(x+dx,0,right-.005);
 if(handle.includes('e'))right=clamp(right+dx,left+.005,1);
 if(handle.includes('n'))top=clamp(y+dy,0,bottom-.005);
 if(handle.includes('s'))bottom=clamp(bottom+dy,top+.005,1);
 return [left,top,right-left,bottom-top];
}
export function containsCenter(rect,glyph){return glyph.x+glyph.width/2>=rect[0]&&glyph.x+glyph.width/2<=rect[0]+rect[2]&&glyph.y+glyph.height/2>=rect[1]&&glyph.y+glyph.height/2<=rect[1]+rect[3];}
export function joinGlyphs(glyphs){
 const lines=[];
 for(const g of [...glyphs].sort((a,b)=>a.y-b.y||a.x-b.x)){
  let line=lines.find(l=>Math.abs(l.y-g.y)<Math.min(l.height,g.height)*.45);
  if(!line){line={y:g.y,height:g.height,items:[]};lines.push(line);}line.items.push(g);
 }
 return lines.sort((a,b)=>a.y-b.y).map(l=>{let previous=null,text='';for(const g of l.items.sort((a,b)=>a.x-b.x)){if(previous&&g.x-(previous.x+previous.width)>Math.max(g.height*.18,previous.width*.5)&&!/[\s]$/.test(text)&&!/^\s/.test(g.text))text+=' ';text+=g.text;previous=g;}return text.trimEnd();}).join('\n').trim();
}
