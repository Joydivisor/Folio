import test from 'node:test';
import assert from 'node:assert/strict';
import {requestStructured} from '../public/structured-response.js';
test('malformed structured output is retried once and cancellation never retries',async()=>{
 let calls=0,repair=0;const value=await requestStructured(async messages=>{calls++;if(calls===1)return '{broken';assert.equal(messages.length,3);return '{"value":3}';},'JSON',JSON.parse,{onRepair:()=>repair++});assert.equal(value.value,3);assert.equal(calls,2);assert.equal(repair,1);
 calls=0;await assert.rejects(()=>requestStructured(async()=>{calls++;return '{bad';},'JSON',JSON.parse));assert.equal(calls,2);
 const controller=new AbortController();calls=0;await assert.rejects(()=>requestStructured(async()=>{calls++;controller.abort();return '{bad';},'JSON',JSON.parse,{signal:controller.signal}),{name:'AbortError'});assert.equal(calls,1);
});
