import test from 'node:test';
import assert from 'node:assert/strict';
import {learningActions,learningRequest,hasPresentation} from '../public/learning-actions.js';
import {originalStudyNote,parseStudyNote,requestStudyNote} from '../public/study-note.js';
import {createArtifact} from '../public/artifact-history.js';
import {preferredReadingKind} from '../public/reading-intent.js';
import {parseReading} from '../public/reading-response.js';
const answer={title:'Order',paragraphs:[{text:'$g^n=e$',sources:[]}]};
test('explicit prose wins over visualization and known intent triggers one structured repair',()=>{
 assert.equal(preferredReadingKind('只用一句文字解释 σ=(1 2 3)'), 'explain');
 assert.equal(preferredReadingKind('σ=(1 2 3)，作用三次'), 'permutation');
 assert.equal(preferredReadingKind('证明阶整除群阶'), 'derivation');
 assert.equal(preferredReadingKind('比较两个对象'), 'comparison');
 assert.equal(preferredReadingKind('什么是群'),null);
 const raw=JSON.stringify({kind:'explain',object:'Order',reason:'Read',explanation:answer});
 assert.throws(()=>parseReading(raw,[],{strictPlan:true,question:'证明阶整除群阶'}),/derivation/);
 assert.equal(parseReading(raw,[],{strictPlan:false,question:'证明阶整除群阶'}).plan.kind,'explain');
 const visual=JSON.stringify({kind:'geometry',object:'cube 3D',reason:'Rotate',shape:'cube',axis:[1,1,1],angle:120,explanation:answer});
 assert.equal(parseReading(visual,[],{strictPlan:true,question:'只用文字解释 cube 3D'}).plan.kind,'explain');
});
test('visible actions match the selected object, are bounded and do not request the current representation',()=>{
 assert.deepEqual(learningActions({kind:'explain',object:'置换 σ'}).map(x=>x.kind),['permutation','derivation']);
 assert.deepEqual(learningActions({kind:'explain',object:'立方体的旋转'}).map(x=>x.kind),['geometry','derivation']);
 assert.equal(learningActions({kind:'explain',object:'S₄ 的可解性'})[0].kind,'derived');
 assert.equal(learningActions({kind:'explain',object:'两个定义的区别'})[0].kind,'comparison');
 assert.ok(!learningActions({kind:'permutation',object:'置换 σ'}).some(x=>x.kind==='permutation'));
 assert.equal(learningActions({kind:'derivation',object:'证明'}).length,1);
 assert.throws(()=>learningRequest('execute-code'));
});
test('view tabs require a renderable result, including completed graph data',()=>{
 assert.equal(hasPresentation({plan:{kind:'explain'}}),false);
 assert.equal(hasPresentation({plan:{kind:'concept'}}),false);
 assert.equal(hasPresentation({plan:{kind:'concept'},visual:{nodes:[]}}),true);
 for(const kind of ['geometry','derived','permutation','derivation','comparison'])assert.equal(hasPresentation({plan:{kind}}),true);
});
test('note fallback preserves every derivation step and comparison cell, not only the short introduction',()=>{
 const steps=[{title:'Subgroup',text:'$\\langle g\\rangle$'},{title:'Lagrange',text:'$o(g)\\mid |G|$'}];
 const draft=originalStudyNote({answer,plan:{kind:'derivation',steps}});
 for(const step of steps)assert.ok(draft.markdown.includes(step.text));
 const table=originalStudyNote({answer,plan:{kind:'comparison',columns:['A','B'],rows:[['a|b','line\nbreak']]}});
 assert.match(table.markdown,/a\\\|b/);assert.match(table.markdown,/line break/);
});
test('structured notes reject empty or oversized results and normalize math without rewriting formula semantics',()=>{
 assert.throws(()=>parseStudyNote('{"title":"x","markdown":""}'));
 assert.throws(()=>parseStudyNote(JSON.stringify({title:'x',markdown:'x'.repeat(16001)})));
 assert.deepEqual(parseStudyNote(JSON.stringify({title:'Order',markdown:'\\(g^n=e\\)'})),{title:'Order',markdown:'$g^n=e$'});
 const record=createArtifact({name:'Book A',page:7,text:'Original passage'}, {kind:'explain',object:'Order'},answer);
 const prompt=requestStudyNote(record,'en');assert.match(prompt,/Book A/);assert.match(prompt,/Original passage/);assert.match(prompt,/g\^n=e/);
});
