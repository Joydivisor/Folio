export const identity = n => Array.from({length:n},(_,i)=>i);
export const compose = (a,b) => b.map(i=>a[i]);
export function inverse(a) {const b=[];a.forEach((x,i)=>b[x]=i);return b;}
export const key = p => p.join(',');
export const commutator = (a,b) => compose(compose(compose(a,b),inverse(a)),inverse(b));
export function permutations(n) {if(n===0)return [[]]; return permutations(n-1).flatMap(p=>Array.from({length:n},(_,i)=>[...p.slice(0,i),n-1,...p.slice(i)]));}
export function cycles(p) {const seen=new Set(), parts=[];for(let i=0;i<p.length;i++){if(seen.has(i))continue;let j=i,c=[];while(!seen.has(j)){seen.add(j);c.push(j+1);j=p[j];}if(c.length>1)parts.push(`(${c.join(' ')})`);}return parts.join('')||'e';}
export function closure(generators,n) {const first=identity(n),out=[first],known=new Set([key(first)]);for(let i=0;i<out.length;i++)for(const g of generators){const p=compose(out[i],g),k=key(p);if(!known.has(k)){known.add(k);out.push(p);}}return out;}
export function derived(group) {const gens=new Map();for(const a of group)for(const b of group){const c=commutator(a,b);gens.set(key(c),c);}return {group:closure([...gens.values()],group[0].length),commutators:[...gens.values()]};}
