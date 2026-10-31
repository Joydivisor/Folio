import fs from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
const root=new URL('../',import.meta.url);
const image=await loadImage(await fs.readFile(new URL('public/assets/folio-desktop.svg',root)));
const sizes=[16,24,32,48,64,128,256];
const images=[];
for(const size of sizes){const c=createCanvas(size,size);c.getContext('2d').drawImage(image,0,0,size,size);images.push(c.toBuffer('image/png'));}
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
for(let i=0;i<sizes.length;i++){const start=6+i*16;header[start]=sizes[i]===256?0:sizes[i];header[start+1]=header[start];header.writeUInt16LE(1,start+4);header.writeUInt16LE(32,start+6);header.writeUInt32LE(images[i].length,start+8);header.writeUInt32LE(offset,start+12);offset+=images[i].length;}
await fs.writeFile(new URL('build/folio.ico',root),Buffer.concat([header,...images]));
const canvas=createCanvas(512,512);canvas.getContext('2d').drawImage(image,0,0,512,512);await fs.writeFile(new URL('build/folio.png',root),canvas.toBuffer('image/png'));
console.log('Built Folio 03 PNG and 7-size Windows icon.');
