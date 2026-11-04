// Positions and label space are computed together; node order is not a layout.
export function wrapDiagramText(text, maxUnits=16){
 const lines=[];let line='',units=0;
 for(const char of String(text)){const size=/[\u0000-\u00ff]/.test(char)?.6:1;if(units+size>maxUnits&&line){lines.push(line);line='';units=0;}line+=char;units+=size;}
 if(line)lines.push(line);return lines.length?lines:[''];
}
export async function layoutConcept(data,engine){
 const nodes=data.nodes.map((n,i)=>{const lines=wrapDiagramText(n.label,12);return {id:n.id,width:n.type==='decision'?220:184,height:Math.max(n.type==='decision'?100:64,lines.length*20+(n.type==='decision'?60:26)),lines,index:i,layoutOptions:n.type==='start'?{'elk.layered.layering.layerConstraint':'FIRST_SEPARATE'}:n.type==='end'?{'elk.layered.layering.layerConstraint':'LAST_SEPARATE'}:{}};});
 const edges=data.edges.map((e,i)=>{
  const lines=wrapDiagramText(e.label,12),units=line=>[...line].reduce((sum,c)=>sum+(/[\u0000-\u00ff]/.test(c)?.6:1),0);
  return {id:'edge-'+i,sources:[e.from],targets:[e.to],labels:e.label?[{text:e.label,width:Math.max(...lines.map(units))*12+16,height:lines.length*18+10,lines,layoutOptions:{'elk.edgeLabels.placement':'CENTER'}}]:[]};
 });
 const layout=await engine.layout({id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':'DOWN','elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':'38','elk.spacing.edgeNode':'24','elk.spacing.edgeLabel':'12','elk.layered.spacing.nodeNodeBetweenLayers':'36','elk.layered.spacing.edgeNodeBetweenLayers':'16','elk.padding':'[top=28,left=28,bottom=28,right=28]','elk.layered.mergeEdges':'false','elk.separateConnectedComponents':'true'},children:nodes,edges});
 return {...layout,children:layout.children.map(n=>({...n,lines:nodes.find(x=>x.id===n.id).lines,index:nodes.find(x=>x.id===n.id).index})),edges:layout.edges.map((e,i)=>({...e,labels:(e.labels||[]).map((label,j)=>({...label,lines:edges[i].labels[j].lines}))}))};
}
