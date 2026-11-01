export const REFLOW_VERSION=2;
const union=boxes=>{const x=Math.min(...boxes.map(b=>b[0])),y=Math.min(...boxes.map(b=>b[1]));return [x,y,Math.max(...boxes.map(b=>b[0]+b[2]))-x,Math.max(...boxes.map(b=>b[1]+b[3]))-y];};
const normalize=(r,w,h)=>[Math.max(0,r[0]/w),Math.max(0,r[1]/h),Math.min(r[2]/w,1-Math.max(0,r[0]/w)),Math.min(r[3]/h,1-Math.max(0,r[1]/h))];
export function layoutText(items,viewport,page=1){
 const {width:w,height:h}=viewport;
 const tokens=items.filter(i=>typeof i.str==='string'&&i.str.trim()).map(i=>{const [x,y]=viewport.convertToViewportPoint(i.transform[4],i.transform[5]),size=Math.max(4,Math.hypot(i.transform[2],i.transform[3]));return {text:i.str,rect:[x,y-size,Math.max(i.width,1),size],size};}).sort((a,b)=>a.rect[1]-b.rect[1]||a.rect[0]-b.rect[0]);
 const rows=[];
 for(const t of tokens){let row=rows.findLast(r=>Math.abs(r.y-t.rect[1])<Math.min(r.size,t.size)*.4);if(!row){row={y:t.rect[1],size:t.size,tokens:[]};rows.push(row);}row.tokens.push(t);}
 const lines=[];
 for(const row of rows){let group=[];const finish=()=>{if(!group.length)return;const rect=union(group.map(t=>t.rect));lines.push({text:group.map((t,i)=>i&&t.rect[0]-(group[i-1].rect[0]+group[i-1].rect[2])>t.size*.15?' '+t.text:t.text).join(''),rect,size:Math.max(...group.map(t=>t.size))});group=[];};for(const t of row.tokens.sort((a,b)=>a.rect[0]-b.rect[0])){const last=group.at(-1);if(last&&t.rect[0]-last.rect[0]-last.rect[2]>Math.max(18,t.size*2.2))finish();group.push(t);}finish();}
 const median=[...lines].sort((a,b)=>a.size-b.size)[Math.floor(lines.length/2)]?.size||12;
 // Three or more aligned cells over consecutive rows form a conservative table.
 const tableLines=[],tableGroups=[];let cells=[];
 const flushTable=()=>{if(cells.length>=3){const all=cells.flat(),rect=union(all.map(l=>l.rect));tableGroups.push({text:cells.map(row=>row.map(l=>l.text).join(' | ')).join('\n'),rect,size:median,table:true});tableLines.push(...all);}cells=[];};
 for(const row of rows){const parts=lines.filter(l=>Math.abs(l.rect[1]-row.y)<median*.4).sort((a,b)=>a.rect[0]-b.rect[0]);if(parts.length>=3){if(cells.length&&row.y-cells.at(-1)[0].rect[1]>median*2.5)flushTable();cells.push(parts);}else flushTable();}flushTable();
 for(const line of tableLines)lines.splice(lines.indexOf(line),1);lines.push(...tableGroups);
 // Detect a sustained gutter. Full-width headings divide column sections.
 let split=null,best=0;
 for(let f=.35;f<=.65;f+=.025){const x=w*f,left=lines.filter(l=>l.rect[0]+l.rect[2]<x-5),right=lines.filter(l=>l.rect[0]>x+5);const crossing=lines.filter(l=>l.rect[0]<x&&l.rect[0]+l.rect[2]>x&&l.size<=median*1.15);const score=Math.min(left.length,right.length)-crossing.length*3;if(left.length>=3&&right.length>=3&&score>best){split=x;best=score;}}
 const full=l=>split&&l.rect[0]<split&&l.rect[0]+l.rect[2]>split;
 const ordered=[];let remaining=[...lines];
 for(const boundary of [...lines.filter(full).sort((a,b)=>a.rect[1]-b.rect[1]),null]){const band=remaining.filter(l=>l!==boundary&&(!boundary||l.rect[1]<boundary.rect[1]));band.sort((a,b)=>(split?(a.rect[0]>split)-(b.rect[0]>split):0)||a.rect[1]-b.rect[1]||a.rect[0]-b.rect[0]);ordered.push(...band);if(boundary)ordered.push(boundary);const used=new Set([...band,boundary]);remaining=remaining.filter(l=>!used.has(l));}
 const blocks=[];let group=[];
 const kind=l=>l.table?'table':l.size>median*1.25?'heading':/^(?:fig(?:ure)?\.?|table|图|表)\s*\d/i.test(l.text)?'caption':l.text.length<160&&/[=∑∏∫∈⊂⊆→↦≠≤≥]/.test(l.text)?'formula':'paragraph';
 const finish=()=>{if(!group.length)return;const rect=union(group.map(l=>l.rect));blocks.push({kind:kind(group[0]),text:group.map(l=>l.text).join(' '),rect:normalize(rect,w,h),rects:group.map(l=>normalize(l.rect,w,h))});group=[];};
 for(const l of ordered){const prev=group.at(-1);if(prev&&(kind(l)!=='paragraph'||kind(prev)!=='paragraph'||(split&&(l.rect[0]>split)!==(prev.rect[0]>split))||l.rect[1]-prev.rect[1]>median*1.85||l.rect[1]<=prev.rect[1]||Math.abs(l.rect[0]-prev.rect[0])>median*1.8||(/[.!?。！？]$/.test(prev.text)&&prev.rect[2]<w*(split?.3:.6))))finish();group.push(l);if(kind(l)!=='paragraph')finish();}finish();
 return {version:REFLOW_VERSION,page,width:w,height:h,columns:split?2:1,blocks:blocks.map((b,i)=>({...b,id:`p${page}-b${i}`})),text:blocks.map(b=>b.text).join('\n\n'),textRects:tokens.map(t=>normalize(t.rect,w,h))};
}
export function plainLayout(text,page=1){const blocks=String(text).split(/\n\s*\n/).filter(s=>s.trim()).map((text,i)=>({id:`p${page}-b${i}`,kind:'paragraph',text:text.trim(),rect:null,rects:[]}));return {version:REFLOW_VERSION,page,columns:1,blocks,text:blocks.map(b=>b.text).join('\n\n'),textRects:[]};}
export function blockContext(layout,ids){const selected=new Set(ids),found=layout.blocks.map((b,i)=>selected.has(b.id)?i:-1).filter(i=>i>=0);if(!found.length)return null;const start=Math.max(0,Math.min(...found)-1),end=Math.min(layout.blocks.length,Math.max(...found)+2);return {page:layout.page,blockIds:[...selected],heading:layout.blocks.slice(0,found[0]+1).filter(b=>b.kind==='heading').at(-1)?.text||'',text:layout.blocks.slice(start,end).map(b=>b.text).filter(Boolean).join('\n\n').slice(0,12000)};}
export function sentences(text){return [...new Intl.Segmenter('zh',{granularity:'sentence'}).segment(String(text))].map(s=>s.segment.trim()).filter(Boolean);}
