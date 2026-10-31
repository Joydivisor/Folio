import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {menus,commandEnabled} from '../public/commands.js';
import {resolveLanguage,translate,dictionary} from '../public/i18n.js';
const require=createRequire(import.meta.url);
const {menuTemplate}=require('../desktop/menu.cjs');
test('language fallback supports Chinese regional locales and explicit preferences',()=>{
 assert.equal(resolveLanguage('system','zh-TW'),'zh-CN');assert.equal(resolveLanguage('system','ja-JP'),'en');assert.equal(resolveLanguage('en','zh-CN'),'en');assert.equal(resolveLanguage('zh-CN','en-US'),'zh-CN');
});
test('translations retain unknown document prose, mathematical notation and original Chinese',()=>{
 assert.equal(translate('设置','en'),'Settings');assert.equal(translate('Settings','zh-CN'),'Settings');assert.equal(translate('σ³ = e，置换的阶为 3','en'),'σ³ = e，置换的阶为 3');assert.equal(translate('设置','zh-CN'),'设置');assert.ok(Object.values(dictionary).every(v=>typeof v==='string'&&v.length>0));
});
test('reading and selection commands cannot run outside their context',()=>{
 const explore=menus.flatMap(m=>m.items).find(i=>i?.[0]==='explore');
 assert.equal(commandEnabled(explore,{reader:false,selection:true}),false);assert.equal(commandEnabled(explore,{reader:true,selection:false}),false);assert.equal(commandEnabled(explore,{reader:true,selection:true}),true);
 for(const item of menus.flatMap(m=>m.items).filter(i=>i?.[4]==='reader'))assert.equal(commandEnabled(item,{reader:false}),false);
});
test('native and visible menus share commands, translated labels and edit roles',()=>{
 const calls=[],native=menuTemplate(menus,'en',id=>calls.push(id));assert.deepEqual(native.map(m=>m.label),['File','Edit','View','Tools','Help']);
 native[0].submenu[0].click();assert.deepEqual(calls,['import']);assert.equal(native[0].submenu[0].accelerator,'CmdOrCtrl+O');assert.equal(native[1].submenu[0].role,'undo');assert.equal(menuTemplate(menus,'zh-CN',()=>{})[0].label,'文件');
});
import {withResponseLanguage} from '../public/response-language.js';
test('response language applies to user-only structured requests and preserves quotes and retries',()=>{
 const input=[{role:'user',content:'原文：σ³=e'},{role:'assistant',content:'invalid'},{role:'user',content:'repair'}];
 const result=withResponseLanguage(input,'en');assert.equal(result[0].role,'system');assert.match(result[0].content,/Use English/);assert.match(result[0].content,/quotations verbatim/);assert.deepEqual(result.slice(1),input);assert.equal(input.length,3);
 assert.match(withResponseLanguage(input,'zh-CN')[0].content,/Simplified Chinese/);assert.match(withResponseLanguage(input,'auto')[0].content,/explicitly requested/);
});
import {requestReading} from '../public/reading-response.js';
test('reading task ends with explicit response language and prioritizes user length constraints',()=>{
 const prompt=requestReading('原文：σ³=e',null,{question:'只用两句话解释',answerLanguage:'en'});
 assert.match(prompt,/OUTPUT REQUIREMENTS.*Use English/s);assert.match(prompt,/原文：σ³=e/);assert.ok(prompt.indexOf('OUTPUT REQUIREMENTS')>prompt.indexOf('只用两句话解释'));assert.ok(!prompt.includes('总计不超过900中文字'));
});
test('an open document can be closed from the library as well as the reader',()=>{
 const close=menus.flatMap(m=>m.items).find(i=>i?.[0]==='close');
 assert.equal(commandEnabled(close,{reader:false,document:true}),true);
 assert.equal(commandEnabled(close,{reader:true,document:true}),true);
 assert.equal(commandEnabled(close,{reader:false,document:false}),false);
});
