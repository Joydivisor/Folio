export function resolveAnchor(text,anchor){
  if(!anchor||!anchor.exact)return null;
  if(text.slice(anchor.start,anchor.end)===anchor.exact)return {start:anchor.start,end:anchor.end};
  const candidates=[];let i=text.indexOf(anchor.exact);
  while(i>=0){if((!anchor.prefix||text.slice(Math.max(0,i-anchor.prefix.length),i)===anchor.prefix)&&(!anchor.suffix||text.slice(i+anchor.exact.length,i+anchor.exact.length+anchor.suffix.length)===anchor.suffix))candidates.push(i);i=text.indexOf(anchor.exact,i+1);}
  return candidates.length===1?{start:candidates[0],end:candidates[0]+anchor.exact.length}:null;
}
