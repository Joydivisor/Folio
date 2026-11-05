import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {DOMParser} from '@xmldom/xmldom';
import {openWorkspace,makeBackup,readBackup,TABLES} from '../public/workspace-store.js';
import {createArtifact,currentVersion,reviseArtifact,moveVersion} from '../public/artifact-history.js';
import {parseZoteroRDF,safeAttachmentPath} from '../public/zotero-import.js';
import {parseDisplayPlan} from '../public/display-plan.js';
import {parseReading} from '../public/reading-response.js';
import {SHAPES,checkRigid} from '../public/geometry-view.js';
import {rotate} from '../public/geometry.js';
import {createDocumentIndex,selectContext} from '../public/document-context.js';
import {requestStructured} from '../public/structured-response.js';
import {normalizeOCRText} from '../public/ocr-text.js';
import {contextBelongsToSource} from '../public/selection-source.js';
import {compareVersions,validateRelease,isNewerRelease} from '../public/release-info.js';
const empty=()=>Object.fromEntries(TABLES.map(t=>[t,[]]));
const plan={kind:'explain',object:'Order',reason:'Proof'};
const answer={title:'Order',paragraphs:[{text:'The smallest positive exponent.',sources:[]}]};
test('migration preserves original records, restores atomically and recovers prior workspace',async()=>{
 globalThis.indexedDB=new IDBFactory();const store=openWorkspace(),original=JSON.stringify([{id:'n',text:'original'}]),storage={getItem:k=>k==='jianwei-notes'?original:null};
 await store.migrate(storage);assert.equal(storage.getItem('jianwei-notes'),original);assert.deepEqual((await store.get('state','jianwei-notes')).value,[{id:'n',text:'original'}]);
 const tables=empty();tables.state=[{id:'jianwei-notes',value:[{id:'new',text:'restored'}]}];await store.restore(await makeBackup(tables));assert.equal((await store.get('state','jianwei-notes')).value[0].id,'new');
 await store.rollback();assert.equal((await store.get('state','jianwei-notes')).value[0].id,'n');
 const bad=await store.snapshot();bad.tables.state[0].value[0].text='tampered';await assert.rejects(store.restore(bad),/checksum/);assert.equal((await store.get('state','jianwei-notes')).value[0].text,'original');
});
test('malformed migration leaves recoverable original records and no success marker',async()=>{
 globalThis.indexedDB=new IDBFactory();const store=openWorkspace();await assert.rejects(store.migrate({getItem:k=>k==='jianwei-notes'?'broken':null}),/malformed/);assert.equal(await store.get('recovery','legacy-v1'),undefined);
});
test('backup rejects credentials, external images, invalid versions and rectangles',async()=>{
 let t=empty();t.state=[{id:'apiKey',value:'not-a-real-key'}];await assert.rejects(makeBackup(t),/settings/);
 t=empty();t.regions=[{id:'r',source:{page:1},image:'https://tracker.invalid/image'}];await assert.rejects(makeBackup(t),/image/);
 t=empty();t.regions=[{id:'r',source:{page:1,rect:[.9,0,.5,.1]},image:'data:image/png;base64,AAAA'}];await assert.rejects(makeBackup(t),/rectangle/);
 t=empty();t.artifacts=[{id:'a',source:{page:1},cursor:2,versions:[]}];await assert.rejects(makeBackup(t),/history/);
 assert.deepEqual(await readBackup(await makeBackup(empty())),empty());
});
test('document identity survives renamed location and revision changes preserve its ID',async()=>{
 globalThis.indexedDB=new IDBFactory();const store=openWorkspace();const first=await store.identify({id:'path-a',name:'a.txt'},new Blob(['text']));const moved=await store.identify({id:'path-b',name:'b.txt'},new Blob(['text']));assert.equal(first.id,moved.id);const changed=await store.identify({id:'path-b',name:'b.txt'},new Blob(['new text']));assert.equal(changed.id,first.id);assert.notEqual(changed.revision,first.revision);
});
test('artifact edits reject stale responses and undo/redo snapshots stay isolated',()=>{
 const a=createArtifact({id:'doc',page:2},plan,answer);const b=reviseArtifact(a,currentVersion(a).id,{interaction:{step:2}},'snapshot');assert.equal(a.versions.length,1);assert.equal(b.versions.length,2);assert.throws(()=>reviseArtifact(b,currentVersion(a).id,{answer}),/older version/);const undo=moveVersion(b,0);const branch=reviseArtifact(undo,currentVersion(undo).id,{answer:{...answer,title:'Edited'}});assert.equal(branch.versions.length,2);assert.equal(currentVersion(branch).answer.title,'Edited');assert.equal(currentVersion(b).answer.title,'Order');const v=currentVersion(b);v.interaction.step=100;assert.equal(currentVersion(b).interaction.step,2);
});
test('persistent index reuses saved pages and retries failures',async()=>{
 const pages=[],reads=[];let fail=true;const options={id:'doc',name:'book',total:3,loadPages:async()=>pages,savePage:async p=>pages.push(p),readPage:async p=>{reads.push(p);if(p===2&&fail)throw Error('temporary');return 'Page '+p;}};
 const first=createDocumentIndex(options);assert.deepEqual((await first.retrieve('Page',1)).failedPages,[2]);fail=false;assert.deepEqual((await first.retrieve('Page',1)).failedPages,[]);assert.equal(reads.filter(n=>n===2).length,2);reads.length=0;await createDocumentIndex(options).retrieve('Page',1);assert.equal(reads.length,0);
});
test('display plans bound geometry and comparison dimensions; source labels require evidence',()=>{
 assert.throws(()=>parseDisplayPlan({...plan,kind:'geometry',shape:'cube',axis:[0,0,0],angle:90}));assert.throws(()=>parseDisplayPlan({...plan,kind:'comparison',columns:['a','b'],rows:[['a']]}));
 const r=parseReading(JSON.stringify({...plan,kind:'derivation',steps:[{title:'Step',text:'Claim',basis:'source',sources:[{page:2,quote:'Invented quote'}]}],explanation:answer}),[{page:2,text:'Actual source'}]);assert.equal(r.plan.steps[0].basis,'deduction');assert.deepEqual(r.plan.steps[0].sources,[]);
});
test('supported 3D rotations preserve geometry and only actual symmetries map vertices',()=>{
 for(const shape of ['cube','octahedron']){const points=SHAPES[shape].map(v=>rotate(v,[0,0,1],Math.PI/2));assert.ok(checkRigid(shape,points));assert.ok(points.every(p=>SHAPES[shape].some(v=>Math.hypot(...p.map((n,i)=>n-v[i]))<1e-6)));assert.equal(checkRigid(shape,points.map(v=>v.map(x=>x+100))),false);}
 const points=SHAPES.cube.map(v=>rotate(v,[0,0,1],.3));assert.ok(checkRigid('cube',points));assert.equal(points.every(p=>SHAPES.cube.some(v=>Math.hypot(...p.map((n,i)=>n-v[i]))<1e-6)),false);
});
test('Zotero RDF preserves nested authors, tags, collections, notes and attachment paths',()=>{
 const xml=`<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:z="http://www.zotero.org/namespaces/export#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:bib="http://purl.org/net/biblio#" xmlns:foaf="http://xmlns.com/foaf/0.1/" xmlns:link="http://purl.org/rss/1.0/modules/link/">
 <bib:Book rdf:about="https://www.zotero.org/users/1/items/ABC"><z:itemType>book</z:itemType><dc:title>Algebra</dc:title><dc:subject>groups</dc:subject><bib:authors><rdf:Seq><rdf:li><foaf:Person><foaf:givenName>Emmy</foaf:givenName><foaf:surname>Noether</foaf:surname></foaf:Person></rdf:li></rdf:Seq></bib:authors><link:link rdf:resource="#a"/><dcterms:isReferencedBy rdf:resource="#n"/></bib:Book>
 <z:Attachment rdf:about="#a"><dc:title>PDF</dc:title><z:path rdf:resource="files/1/algebra.pdf"/></z:Attachment><bib:Memo rdf:about="#n"><rdf:value>Read chapter 2</rdf:value></bib:Memo><z:Collection rdf:about="#c"><dc:title>Mathematics</dc:title><dcterms:hasPart rdf:resource="https://www.zotero.org/users/1/items/ABC"/></z:Collection></rdf:RDF>`;
 const data=parseZoteroRDF(xml,DOMParser);assert.equal(data.items[0].title,'Algebra');assert.deepEqual(data.items[0].creators,['Emmy Noether']);assert.deepEqual(data.items[0].tags,['groups']);assert.equal(data.items[0].attachments[0].safePath,'files/1/algebra.pdf');assert.equal(data.items[0].notes[0].text,'Read chapter 2');assert.equal(data.collections[0].members[0],data.items[0].id);assert.throws(()=>parseZoteroRDF('<!DOCTYPE x>'+xml,DOMParser));for(const p of ['../key.txt','C:/key.txt','https://example.org/file','%2e%2e/key'])assert.equal(safeAttachmentPath(p),null);
});
test('update metadata excludes redirects and credentials and orders beta releases correctly',()=>{
 assert.equal(compareVersions('1.0.0-beta.5','1.0.0-beta.4'),1);assert.equal(compareVersions('1.0.0','1.0.0-beta.5'),1);
 const r={version:'1.0.0-beta.5',downloads:[{id:'win-x64',url:'https://github.com/Joydivisor/Folio-downloads/releases/download/v1.0.0-beta.5/Folio.exe',sha256:'a'.repeat(64),sizeBytes:100}]};assert.equal(validateRelease(r),r);assert.throws(()=>validateRelease({...r,downloads:[{...r.downloads[0],url:'https://evil.invalid/Folio.exe'}]}));
});
test('update metadata accepts the public source repository while preserving the exact release boundary',()=>{
 const url='https://github.com/Joydivisor/Folio/releases/download/v1.0.1/Folio-1.0.1-mac-arm64.dmg';
 const release={version:'1.0.1',revision:'r1',downloads:[{id:'mac-arm64',url,sha256:'b'.repeat(64),sizeBytes:100}]};
 assert.equal(validateRelease(release),release);
 for(const invalid of [url.replace('/Joydivisor/','/someone/'),url.replace('/Folio/','/Folio-copy/'),url.replace('/v1.0.1/','/v1.0.0/'),url.replace('github.com','github.com.example.org'),url.replace('https:','http:'),url.replace('https://','https://name:password@'),url+'?redirect=1',url+'#download'])assert.throws(()=>validateRelease({...release,downloads:[{...release.downloads[0],url:invalid}]}));
});
test('malformed display receives one repair and retains explanation if repair is still unsupported',async()=>{
 const invalid={...plan,kind:'derivation',steps:[],explanation:answer},valid={...invalid,steps:[{title:'Step 1',text:'A valid argument',basis:'deduction'}]};let calls=0;
 const parsed=await requestStructured(async()=>JSON.stringify(++calls===1?invalid:valid),'task',(raw,{attempt})=>parseReading(raw,[],{strictPlan:attempt===0}));assert.equal(calls,2);assert.equal(parsed.plan.kind,'derivation');
 const fallback=await requestStructured(async()=>JSON.stringify(invalid),'task',(raw,{attempt})=>parseReading(raw,[],{strictPlan:attempt===0}));assert.equal(fallback.plan.kind,'explain');assert.equal(fallback.answer.title,answer.title);
});
test('explicit theorem reference ranks remote source above generic neighboring text',()=>{
 const pages=Array.from({length:40},(_,i)=>({page:i+1,text:('General group theory discussion. ').repeat(200)}));pages[34].text='Theorem 7.3 states the precise condition. '+pages[34].text;const selected=selectContext(pages,'Explain Theorem 7.3',2,{budget:4000});assert.ok(selected.some(p=>p.page===35));
});
test('OCR normalization joins Chinese glyphs while preserving English spaces and lines',()=>{assert.equal(normalizeOCRText('群 论 与 几 何\nPermutation groups'), '群论与几何\nPermutation groups');});
test('restored artifacts cannot request unbounded factorial group calculations',async()=>{const tables=empty();tables.artifacts=[createArtifact({id:'d',page:1},{kind:'derived',n:1000,object:'Group',reason:'Test'},answer)];await assert.rejects(makeBackup(tables));});
test('relinked sources share context only for the same canonical document revision',()=>{const source={id:'old',documentId:'doc',revision:'v1'};assert.equal(contextBelongsToSource(source,{id:'new',documentId:'doc',revision:'v1'}),true);assert.equal(contextBelongsToSource(source,{id:'new',documentId:'doc',revision:'v2'}),false);assert.equal(contextBelongsToSource({...source,external:true},{id:'old',documentId:'doc',revision:'v1'}),false);});

test('same-version installation revisions update monotonically',()=>{const current={version:'1.0.0-beta.9',revision:'r4'};assert(isNewerRelease({...current,revision:'r5'},current));assert(!isNewerRelease({...current,revision:'r3'},current));assert(!isNewerRelease(current,current));assert(isNewerRelease(current,{version:current.version}));assert(!isNewerRelease({...current,version:'1.0.0-beta.8',revision:'r99'},current));});
