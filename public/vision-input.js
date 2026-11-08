import {MAX_IMAGE_BYTES} from './chat-context.js';
export const isImageFile=file=>/\.(png|jpe?g|webp)$/i.test(file.name);
export function usesVision(config){
 if(config.imageInput==='vision')return true;if(config.imageInput==='ocr')return false;
 let host;try{host=new URL(config.baseUrl).hostname;}catch{return false;}
 return host==='api.anthropic.com'||host==='generativelanguage.googleapis.com'||(host==='api.openai.com'&&/^(gpt-(4o|4\.1|[5-9])|o[134])/.test(config.model));
}
const stop=signal=>{if(signal?.aborted)throw new DOMException('Stopped','AbortError');};
function encode(canvas){
 const image=canvas.toDataURL('image/jpeg',.92);
 if(image.length>Math.ceil(MAX_IMAGE_BYTES*4/3)+100)throw Error('图片过大，请缩小选区后重试。');
 return image;
}
export async function imageFromFile(file,{signal}={}){
 if(!isImageFile(file)||file.size>20*1024*1024)throw Error('请使用不超过 20 MB 的 PNG、JPEG 或 WebP 图片。');
 stop(signal);const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,2560/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
 try{stop(signal);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return encode(canvas);}
 finally{bitmap.close();canvas.width=0;canvas.height=0;}
}
export async function imageFromPDF(pdf,page,{rect,signal}={}){
 stop(signal);const p=await pdf.getPage(page),natural=p.getViewport({scale:1});stop(signal);
 const viewport=p.getViewport({scale:Math.min(3.5,3200/Math.max(natural.width,natural.height))}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 const render=p.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}),cancel=()=>render.cancel();signal?.addEventListener('abort',cancel,{once:true});
 let crop;
 try{await render.promise;stop(signal);if(!rect)return encode(canvas);
  crop=document.createElement('canvas');crop.width=Math.max(1,Math.ceil(rect[2]*canvas.width));crop.height=Math.max(1,Math.ceil(rect[3]*canvas.height));crop.getContext('2d').drawImage(canvas,rect[0]*canvas.width,rect[1]*canvas.height,crop.width,crop.height,0,0,crop.width,crop.height);return encode(crop);
 }finally{signal?.removeEventListener('abort',cancel);canvas.width=0;canvas.height=0;if(crop){crop.width=0;crop.height=0;}}
}
export function withImages(prompt,images=[]){return images.length?[{type:'text',text:prompt},...images.flatMap(({image,label})=>[{type:'text',text:label},{type:'image_url',image_url:{url:image,detail:'high'}}])]:prompt;}
