import {identity, compose} from './groups.js';

export function isPermutation(p) {
  return Array.isArray(p) && p.length >= 2 && p.length <= 8 && new Set(p).size === p.length && p.every(x => Number.isInteger(x) && x >= 0 && x < p.length);
}
export function mappingInput(text, n) {
  const values = text.trim().split(/[\s,，]+/).map(Number).map(x => x - 1);
  if (!isPermutation(values) || (n && values.length !== n)) throw new Error('请输入 2–8 个不重复的像，恰好包含 1 到 n；两个置换的底集须相同。');
  return values;
}
export function compositionTrace(a, b, order = 'right-first') {
  if (!isPermutation(a) || !isPermutation(b) || a.length !== b.length || !['right-first','left-first'].includes(order)) throw new Error('置换或复合约定无效。');
  const first = order === 'right-first' ? b : a, second = order === 'right-first' ? a : b;
  return {initial:identity(a.length), intermediate:[...first], result:compose(second, first), rows:first.map((mid,i) => [i+1,mid+1,second[mid]+1])};
}
export function permutationFacts(p) {
  if (!isPermutation(p)) throw new Error('需要有效的置换。');
  const seen = new Set(), lengths = [];
  for(let i=0;i<p.length;i++) { if(seen.has(i))continue; let j=i,length=0; while(!seen.has(j)){seen.add(j);length++;j=p[j];} lengths.push(length); }
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  const order=lengths.reduce((a,b)=>a*b/gcd(a,b),1);
  return {order,even:(p.length-lengths.length)%2===0,fixed:p.flatMap((v,i)=>v===i?[i+1]:[])};
}
export function inspectGeometry(original, points, tolerance=1e-6) {
  const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
  let edgeError=0;
  for(let i=0;i<original.length;i++)for(let j=i+1;j<original.length;j++)edgeError=Math.max(edgeError,Math.abs(distance(original[i],original[j])-distance(points[i],points[j])));
  const mapping=points.map(p=>original.findIndex(q=>distance(p,q)<tolerance));
  const isSymmetry=mapping.every(i=>i>=0)&&new Set(mapping).size===original.length;
  return {edgeError,rigid:edgeError<tolerance,isSymmetry,mapping};
}
