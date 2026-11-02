export const REFLOW_VERSION=3;
const union=boxes=>{const x=Math.min(...boxes.map(b=>b[0])),y=Math.min(...boxes.map(b=>b[1]));return [x,y,Math.max(...boxes.map(b=>b[0]+b[2]))-x,Math.max(...boxes.map(b=>b[1]+b[3]))-y];};
const normalize=(r,w,h)=>[Math.max(0,r[0]/w),Math.max(0,r[1]/h),Math.min(r[2]/w,1-Math.max(0,r[0]/w)),Math.min(r[3]/h,1-Math.max(0,r[1]/h))];

// Find repeated whitespace BEFORE joining rows. A narrow gutter is not a word space.
export function findColumnGutters(rows,width){
 const evidence=[];
 for(const row of rows){
  const ts=[...row.tokens].sort((a,b)=>a.rect[0]-b.rect[0]);
  if(ts.length<2||ts.at(-1).rect[0]+ts.at(-1).rect[2]-ts[0].rect[0]<width*.62)continue;
  let edge=ts[0].rect[0]+ts[0].rect[2];
  for(let i=1;i<ts.length;i++){
   const t=ts[i],gap=t.rect[0]-edge;
   if(gap>Math.max(4,row.size*.5)&&edge>width*.18&&t.rect[0]<width*.82){
    const left=ts.slice(0,i),right=ts.slice(i);
    if(left.map(t=>t.text).join('').length>14&&right.map(t=>t.text).join('').length>14)evidence.push({a:edge+1,b:t.rect[0]-1,y:row.y,size:row.size,start:t.rect[0]});
   }
   edge=Math.max(edge,t.rect[0]+t.rect[2]);
  }
 }
 const candidates=[];
 for(const e of evidence){
  const x=(e.a+e.b)/2,aligned=evidence.filter(g=>g.a<=x&&g.b>=x&&Math.abs(g.start-e.start)<Math.max(5,e.size*.6));
  const ys=[...new Set(aligned.map(g=>g.y))];
  if(ys.length<3||Math.max(...ys)-Math.min(...ys)<e.size*3)continue;
  const minY=Math.min(...ys),maxY=Math.max(...ys),crossing=rows.filter(r=>r.y>=minY&&r.y<=maxY&&r.tokens.some(t=>t.rect[0]<x&&t.rect[0]+t.rect[2]>x)).length;
  const score=ys.length-crossing*.5;
  if(score>=3)candidates.push({x,score});
 }
 candidates.sort((a,b)=>b.score-a.score);
 const chosen=[];
 for(const c of candidates)if(c.score>=candidates[0].score*.6&&chosen.every(x=>Math.abs(x-c.x)>width*.18)){chosen.push(c.x);if(chosen.length===2)break;}
 return chosen.sort((a,b)=>a-b);
}
export function layoutText(items,viewport,page=1){
 const {width:w,height:h}=viewport,scale=viewport.scale||1;
 const tokens=items.filter(i=>typeof i.str==='string').map((i,index)=>{
  const [x,y]=viewport.convertToViewportPoint(i.transform[4],i.transform[5]),size=Math.max(2,Math.hypot(i.transform[2],i.transform[3])*scale);
  return {text:i.str,index,baseline:y,rect:[x,y-size,Math.max(i.width*scale,1),size],size};
 }).filter(t=>t.text.trim()).sort((a,b)=>a.baseline-b.baseline||a.rect[0]-b.rect[0]);
 const rows=[];
 for(const t of tokens){
  let row=rows.findLast(r=>Math.abs(r.y-t.baseline)<Math.max(r.size,t.size)*.45);
  if(!row){row={y:t.baseline,size:t.size,tokens:[]};rows.push(row);}row.tokens.push(t);row.size=Math.max(row.size,t.size);
 }
 const gutters=findColumnGutters(rows,w),lines=[];
 for(const row of rows){
  let group=[];
  const finish=()=>{if(!group.length)return;const rect=union(group.map(t=>t.rect));lines.push({text:group.map((t,i)=>i&&t.rect[0]-(group[i-1].rect[0]+group[i-1].rect[2])>t.size*.15?' '+t.text:t.text).join(''),rect,baseline:row.y,size:Math.max(...group.map(t=>t.size)),indices:group.map(t=>t.index)});group=[];};
  for(const t of row.tokens.sort((a,b)=>a.rect[0]-b.rect[0])){const last=group.at(-1);if(last){const edge=last.rect[0]+last.rect[2];if(t.rect[0]-edge>Math.max(18,t.size*2.2)||gutters.some(x=>edge<=x&&t.rect[0]>=x))finish();}group.push(t);}finish();
 }
 const median=[...lines].sort((a,b)=>a.size-b.size)[Math.floor(lines.length/2)]?.size||12;
 const tableLines=[],tableGroups=[];let cells=[];
 const flushTable=()=>{if(cells.length>=3){const all=cells.flat(),rect=union(all.map(l=>l.rect));tableGroups.push({text:cells.map(row=>row.map(l=>l.text).join(' | ')).join('\n'),rect,baseline:all[0].baseline,size:median,table:true,indices:all.flatMap(l=>l.indices)});tableLines.push(...all);}cells=[];};
 for(const row of rows){const parts=lines.filter(l=>l.baseline===row.y).sort((a,b)=>a.rect[0]-b.rect[0]);if(parts.length>=3&&parts.every(l=>l.rect[2]<w*.2)){if(cells.length&&row.y-cells.at(-1)[0].baseline>median*2.5)flushTable();cells.push(parts);}else flushTable();}flushTable();
 for(const line of tableLines)lines.splice(lines.indexOf(line),1);lines.push(...tableGroups);
 // Retain the original broad-gap detector for short labels and sparse papers.
 if(!gutters.length){let split=null,best=0;for(let f=.35;f<=.65;f+=.025){const x=w*f,left=lines.filter(l=>l.rect[0]+l.rect[2]<x-5),right=lines.filter(l=>l.rect[0]>x+5),crossing=lines.filter(l=>l.rect[0]<x&&l.rect[0]+l.rect[2]>x&&l.size<=median*1.15);const score=Math.min(left.length,right.length)-crossing.length*3;if(left.length>=3&&right.length>=3&&score>best){split=x;best=score;}}if(split)gutters.push(split);}
 const full=l=>gutters.some(x=>l.rect[0]<x&&l.rect[0]+l.rect[2]>x),column=l=>full(l)?-1:gutters.filter(x=>l.rect[0]>x).length;
 const ordered=[];let remaining=[...lines];
 for(const boundary of [...lines.filter(full).sort((a,b)=>a.rect[1]-b.rect[1]),null]){const band=remaining.filter(l=>l!==boundary&&(!boundary||l.baseline<boundary.baseline));band.sort((a,b)=>column(a)-column(b)||a.baseline-b.baseline||a.rect[0]-b.rect[0]);ordered.push(...band);if(boundary)ordered.push(boundary);const used=new Set([...band,boundary]);remaining=remaining.filter(l=>!used.has(l));}
 const blocks=[];let group=[];
 const kind=l=>l.table?'table':l.size>median*1.25?'heading':/^(?:fig(?:ure)?\.?|table|图|表)\s*\d/i.test(l.text)?'caption':l.text.length<160&&/[=∑∏∫∈⊂⊆→↦≠≤≥]/.test(l.text)?'formula':'paragraph';
 const finish=()=>{if(!group.length)return;const rect=union(group.map(l=>l.rect));blocks.push({kind:kind(group[0]),column:column(group[0]),text:group.map(l=>l.text).join(' '),rect:normalize(rect,w,h),rects:group.map(l=>normalize(l.rect,w,h)),itemIndices:group.flatMap(l=>l.indices)});group=[];};
 for(const l of ordered){const prev=group.at(-1);if(prev&&(kind(l)!=='paragraph'||kind(prev)!=='paragraph'||column(l)!==column(prev)||l.baseline-prev.baseline>median*1.85||l.baseline<=prev.baseline||Math.abs(l.rect[0]-prev.rect[0])>median*1.8||(/[.!?。！？]$/.test(prev.text)&&prev.rect[2]<w*(gutters.length?.3:.6))))finish();group.push(l);if(kind(l)!=='paragraph')finish();}finish();
 return {version:REFLOW_VERSION,page,width:w,height:h,columns:gutters.length+1,gutters:gutters.map(x=>x/w),blocks:blocks.map((b,i)=>({...b,id:`p${page}-b${i}`})),text:blocks.map(b=>b.text).join('\n\n'),textRects:tokens.map(t=>normalize(t.rect,w,h))};
}
export function plainLayout(text,page=1){const blocks=String(text).split(/\n\s*\n/).filter(s=>s.trim()).map((text,i)=>({id:`p${page}-b${i}`,kind:'paragraph',text:text.trim(),rect:null,rects:[]}));return {version:REFLOW_VERSION,page,columns:1,blocks,text:blocks.map(b=>b.text).join('\n\n'),textRects:[]};}
export function blockContext(layout,ids){const selected=new Set(ids),found=layout.blocks.map((b,i)=>selected.has(b.id)?i:-1).filter(i=>i>=0);if(!found.length)return null;const start=Math.max(0,Math.min(...found)-1),end=Math.min(layout.blocks.length,Math.max(...found)+2);return {page:layout.page,blockIds:[...selected],heading:layout.blocks.slice(0,found[0]+1).filter(b=>b.kind==='heading').at(-1)?.text||'',text:layout.blocks.slice(start,end).map(b=>b.text).filter(Boolean).join('\n\n').slice(0,12000)};}
export function sentences(text){return [...new Intl.Segmenter('zh',{granularity:'sentence'}).segment(String(text))].map(s=>s.segment.trim()).filter(Boolean);}
