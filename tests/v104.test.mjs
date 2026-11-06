import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {zipSync,unzipSync,strToU8} from 'fflate';
import {readTextDocument,parseDocxXML,paginateText,supportsDocument} from '../public/document-formats.js';
import {slashQuery,parseOutputCommand,commandMatches} from '../public/output-commands.js';
import {requestReading,parseReading} from '../public/reading-response.js';
import {needsOCR,ocrWords,createPDFOCR,OCR_VERSION} from '../public/pdf-ocr.js';

const xml=`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body><w:p><w:r><w:t>标题与 α</w:t></w:r></w:p><w:p><w:r><w:t>Before</w:t><w:tab/><w:t>after</w:t></w:r><w:del><w:r><w:delText>DELETED</w:delText></w:r></w:del><w:r><w:instrText>HYPERLINK secret</w:instrText></w:r><w:hyperlink><w:r><w:t>link text</w:t></w:r></w:hyperlink></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><m:oMath><m:f><m:num><m:r><m:t>x</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f></m:oMath></w:p><w:p><w:r><w:br w:type="page"/><w:t>Second page</w:t></w:r></w:p></w:body></w:document>`;
test('DOCX imports a real ZIP with Unicode paragraphs, table cells, formula and page breaks',async()=>{
 const file=new File([zipSync({'word/document.xml':strToU8(xml)})],'reading.DOCX');
 const pages=await readTextDocument(file,{unzip:unzipSync,Parser:DOMParser});
 assert.equal(pages.length,2);assert.match(pages[0],/标题与 α/);assert.match(pages[0],/Before\tafterlink text/);assert.match(pages[0],/A\tB/);assert.match(pages[0],/\(x\)\/\(2\)/);assert.equal(pages[1],'Second page');assert.doesNotMatch(pages.join(''),/DELETED|HYPERLINK|w:t/);
 assert.ok(supportsDocument('book.docx'));assert.ok(supportsDocument('notes.markdown'));assert.ok(!supportsDocument('macro.docm'));
});
test('DOCX rejects invalid ZIPs, missing document parts and XML declarations',async()=>{
 for(const bytes of [strToU8('not a zip'),zipSync({'other.xml':strToU8(xml)})])await assert.rejects(readTextDocument(new File([bytes],'bad.docx'),{unzip:unzipSync,Parser:DOMParser}),{name:'DocumentFormatError'});
 assert.throws(()=>parseDocxXML('<!DOCTYPE document SYSTEM "file:///secret">'+xml,DOMParser));
 assert.throws(()=>parseDocxXML('<document><body/></document>',DOMParser));
 const pages=paginateText('abc😀defghijkl',4);assert.equal(pages.join(''),'abc😀defghijkl');assert.ok(pages.every(s=>!/[\uD800-\uDBFF]$/.test(s)));
});
test('TXT and Markdown preserve legacy page boundaries and saved citation positions',async()=>{
 const text='line\n'.repeat(1800);for(const name of ['book.txt','notes.md'])assert.deepEqual(await readTextDocument(new File([text],name)),text.match(/[\s\S]{1,4200}/g));
});
test('slash choices leave ordinary prose and math divisions intact',()=>{
 assert.equal(slashQuery('a/b'),null);assert.equal(slashQuery('https://example.org'),null);assert.deepEqual(slashQuery('hello\n/der'),{query:'der',start:6,end:10});
 assert.equal(parseOutputCommand('/derive 解释这个定理').command.id,'derive');assert.equal(parseOutputCommand('/推导 解释这个定理').text,'解释这个定理');assert.equal(parseOutputCommand('/unknown message').command,null);assert.equal(commandMatches('对比')[0].id,'compare');
 const original=requestReading('passage',null,{question:'What is this?'});assert.equal(original,requestReading('passage',null,{question:'What is this?',outputMode:null}));assert.doesNotMatch(original,/requested_output/);
 assert.match(requestReading('passage',null,{question:'What is this?',outputMode:'diagram'}),/"requested_output":"diagram"/);
});
const explanation={kind:'explain',object:'An object',reason:'A reason',explanation:{title:'An explanation',paragraphs:[{text:'The answer.',sources:[]}]}};
test('explicit output requests repair a wrong representation without overriding a text-only question',()=>{
 assert.throws(()=>parseReading(JSON.stringify(explanation),[],{strictPlan:true,outputMode:'compare'}));
 assert.equal(parseReading(JSON.stringify(explanation),[],{strictPlan:false,outputMode:'compare'}).plan.kind,'explain');
 assert.equal(parseReading(JSON.stringify(explanation),[],{strictPlan:true,outputMode:'diagram',question:'只要文字解释'}).plan.kind,'explain');
 const clarified={...explanation,kind:'clarify',explanation:{...explanation.explanation,nextQuestion:'Which dimensions?'}};assert.equal(parseReading(JSON.stringify(clarified),[],{strictPlan:true,outputMode:'3d'}).answer.nextQuestion,'Which dimensions?');
});
test('OCR detects image-only pages and retains bounded word coordinates',()=>{
 assert.ok(needsOCR([]));assert.ok(needsOCR([{str:'12'}]));assert.ok(!needsOCR([{str:'This page has native selectable text.'}]));
 const data={blocks:[{paragraphs:[{lines:[{words:[{text:'Hello',bbox:{x0:10,y0:20,x1:50,y1:40}},{text:'world',bbox:{x0:60,y0:20,x1:100,y1:40}}]}]}]}]};
 assert.deepEqual(ocrWords(data,200,100),[{text:'Hello',rect:[.05,.2,.2,.2],eol:false,space:true},{text:'world',rect:[.3,.2,.2,.2],eol:true,space:false}]);
});
test('OCR reuses revision-specific cached text, skips native pages and cancels a batch',async()=>{
 const records=new Map([['book:r1:1',{ocr:true,ocrVersion:OCR_VERSION,text:'saved scan',page:1}]]),calls=[];
 const ocr=createPDFOCR({pdf:{numPages:3,getPage:async p=>{calls.push(p);return {getTextContent:async()=>({items:[{str:'Native text with enough readable characters'}]})};}},entry:{id:'book',revision:'r1'},store:{get:async(_,id)=>records.get(id)}});
 assert.equal((await ocr.recognize(1)).text,'saved scan');assert.equal(await ocr.recognize(2),null);assert.deepEqual(calls,[2]);
 const abort=new AbortController();await assert.rejects(ocr.recognizeAll({signal:abort.signal,onProgress:()=>abort.abort()}),{name:'AbortError'});
 ocr.destroy();await assert.rejects(ocr.recognize(3),{name:'AbortError'});
});
test('OCR upgrades stale machine caches while preserving manual corrections',async()=>{
 const records=new Map([['book:r1:1',{ocr:true,ocrVersion:1,text:'old machine OCR'}],['book:r1:2',{ocr:true,ocrVersion:1,corrected:true,text:'manually corrected'}]]);
 const ocr=createPDFOCR({pdf:{},entry:{id:'book',revision:'r1'},store:{get:async(_,id)=>records.get(id)}});
 assert.equal(await ocr.cached(1),null);assert.equal((await ocr.cached(2)).text,'manually corrected');assert.equal((await ocr.recognize(2)).text,'manually corrected');ocr.destroy();
});
