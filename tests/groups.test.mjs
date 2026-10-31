import test from 'node:test';
import assert from 'node:assert/strict';
import {identity,compose,inverse,cycles,permutations,derived,key} from '../public/groups.js';
test('rightmost permutation acts first; composition is noncommutative',()=>{const s=[1,2,0],t=[1,0,2];assert.equal(cycles(compose(s,t)),'(1 3)');assert.equal(cycles(compose(t,s)),'(2 3)');assert.deepEqual(compose(compose(s,s),s),identity(3));});
test('all S4 elements are distinct bijections with valid inverses',()=>{const g=permutations(4);assert.equal(new Set(g.map(key)).size,24);for(const p of g){assert.equal(new Set(p).size,4);assert.deepEqual(compose(p,inverse(p)),identity(4));}});
for(const [n,sizes] of [[3,[6,3,1]],[4,[24,12,4,1]],[5,[120,60,60]]])test(`S${n} derived series is ${sizes.join(' -> ')}`,()=>{let g=permutations(n);const actual=[g.length];for(let i=1;i<sizes.length;i++){const old=new Set(g.map(key));g=derived(g).group;assert.ok(g.every(p=>old.has(key(p))));actual.push(g.length);}assert.deepEqual(actual,sizes);if(n===5)assert.deepEqual(new Set(derived(g).group.map(key)),new Set(g.map(key)));});
