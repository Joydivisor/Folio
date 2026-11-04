const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid diagram text');return v;};
export function parseDiagram(v){
 if(!v||!Array.isArray(v.nodes)||!v.nodes.length||v.nodes.length>24||!Array.isArray(v.edges)||v.edges.length>48)throw Error('Invalid diagram size');
 const ids=new Set(),nodes=v.nodes.map(n=>{const id=text(n.id,40);if(ids.has(id)||!/^[a-zA-Z][\w-]*$/.test(id))throw Error('Invalid diagram node ID');ids.add(id);if(!['start','end','action','decision','concept'].includes(n.type))throw Error('Invalid diagram node type');return {id,type:n.type,label:text(n.label,100),detail:typeof n.detail==='string'?n.detail.slice(0,4000):n.label};});
 const edges=v.edges.map(e=>{if(!ids.has(e.from)||!ids.has(e.to))throw Error('Missing diagram node');return {from:e.from,to:e.to,label:typeof e.label==='string'?e.label.slice(0,100):''};});
 for(const n of nodes)if(n.type==='decision'&&edges.filter(e=>e.from===n.id).length<2)throw Error('A decision needs at least two outgoing branches');
 return {title:typeof v.title==='string'?v.title.slice(0,120):'',summary:typeof v.summary==='string'?v.summary.slice(0,1000):'',nodes,edges};
}
