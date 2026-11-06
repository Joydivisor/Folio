import {compositionTrace} from './experiment-math.js';
import {identity,compose} from './groups.js';
export function permutationPower(sigma,k){
 if(!Array.isArray(sigma)||sigma.length<2||sigma.length>8||new Set(sigma).size!==sigma.length||!sigma.every(x=>Number.isInteger(x)&&x>=0&&x<sigma.length)||!Number.isInteger(k)||k<0||k>10000)throw Error('Invalid permutation power');
 let result=identity(sigma.length);for(let i=0;i<k;i++)result=compose(sigma,result);return result;
}
export function validatePermutationSnapshot(value){
 const v=structuredClone(value),p=v?.plan;
 if(v?.kind!=='permutation-state'||v.version!==1||!p||!Number.isInteger(p.n)||p.n<2||p.n>8||!['right-first','left-first'].includes(p.order)||typeof p.object!=='string')throw Error('实验记录格式不受支持。');
 for(const map of [p.sigma,...(p.tau?[p.tau]:[]),v.state]){if(map?.length!==p.n)throw Error('实验记录的底集不一致。');permutationPower(map,0);}
 if(!Number.isInteger(v.steps)||v.steps<0||v.steps>10000)throw Error('实验步骤无效。');
 if(v.composition){const {product,stage}=v.composition;if(!p.tau||!['στ','τσ'].includes(product)||!Number.isInteger(stage)||stage<0||stage>2)throw Error('Invalid composition snapshot');const [a,b]=product==='στ'?[p.sigma,p.tau]:[p.tau,p.sigma],t=compositionTrace(a,b,p.order),expected=[t.initial,t.intermediate,t.result][stage];if(!expected.every((x,i)=>x===v.state[i])||v.steps!==stage)throw Error('Composition does not match snapshot');}
 return v;
}
