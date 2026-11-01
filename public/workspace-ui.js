import {language} from './i18n.js';
export const ui=(zh,en)=>language()==='en'?en:zh;
export function node(tag,text,props={}){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;Object.assign(el,props);return el;}
export function button(text,action){const el=node('button',text,{type:'button'});el.onclick=async event=>{if(el.disabled)return;el.disabled=true;try{await action(event);}catch(error){showError(error.message);}finally{if(el.isConnected)el.disabled=false;}};return el;}
export function modal(title){const root=node('dialog',undefined,{className:'workspace-dialog'}),head=node('header'),body=node('div',undefined,{className:'workspace-dialog-body'});head.append(node('h2',title),button('×',()=>root.close()));root.append(head,body);document.body.append(root);root.onclose=()=>root.remove();root.showModal();return {root,body};}
export function showError(text){const {body}=modal(ui('操作未完成','Action could not finish'));body.append(node('p',text));}
export function download(name,value,type='application/json'){const blob=value instanceof Blob?value:new Blob([typeof value==='string'?value:JSON.stringify(value)],{type}),url=URL.createObjectURL(blob),link=node('a',undefined,{href:url,download:name});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
