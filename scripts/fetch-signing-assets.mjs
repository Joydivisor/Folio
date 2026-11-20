import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {releaseNetworkEnv} from './release-network.mjs';
const env=(await releaseNetworkEnv()).env, exec=promisify(execFile);
const chunkSize=4*1024*1024;
const gh=async(args,options={})=>(await exec('gh',args,{env,timeout:45000,maxBuffer:chunkSize+16384,windowsHide:true,...options})).stdout;
const version=JSON.parse(await fs.readFile('package.json','utf8')).version, tag='v'+version, repo='Joydivisor/Folio';
const dir=path.resolve('releases',tag);await fs.mkdir(dir,{recursive:true});
const id=(await gh(['release','view',tag,'--repo',repo,'--json','databaseId','--jq','.databaseId'])).trim();
if(!/^\d+$/.test(id))throw Error('Invalid release ID');
const draft=JSON.parse(await gh(['api','repos/'+repo+'/releases/'+id]));
if(!draft.draft||draft.tag_name!==tag)throw Error('Expected the release draft');
await fs.writeFile(path.join(dir,'draft-metadata.json'),JSON.stringify(draft));
async function downloadVerified(asset, destination) {
  const cache=path.resolve('.installer-cache','release-downloads',String(asset.id)+'-'+asset.digest.slice(7));
  await fs.mkdir(cache,{recursive:true});
  const starts=Array.from({length:Math.ceil(asset.size/chunkSize)},(_,i)=>i*chunkSize);
  const partPath=start=>path.join(cache,String(start));
  let next=0;
  async function worker() {
    while(next<starts.length) {
      const start=starts[next++],end=Math.min(start+chunkSize,asset.size)-1,part=partPath(start);
      if((await fs.stat(part).catch(()=>null))?.size===end-start+1)continue;
      for(let attempt=1;;attempt++) {
        try {
          const raw=await gh(['api','--include','-H','Accept: application/octet-stream','-H','Range: bytes='+start+'-'+end,
            'repos/'+repo+'/releases/assets/'+asset.id+'?r='+start],{encoding:'buffer',timeout:85000});
          let headerEnd=raw.indexOf('\r\n\r\n'),skip=4;
          if(headerEnd<0){headerEnd=raw.indexOf('\n\n');skip=2;}
          const headers=raw.subarray(0,headerEnd).toString('ascii'),bytes=raw.subarray(headerEnd+skip);
          const range=headers.match(/^content-range:\s*(.+)$/im)?.[1].trim();
          if(headerEnd<0||!/^HTTP\/\S+ 206 /.test(headers)||range!=='bytes '+start+'-'+end+'/'+asset.size||bytes.length!==end-start+1)throw Error('Unexpected byte range');
          await fs.writeFile(part+'.'+process.pid,bytes);
          await fs.rename(part+'.'+process.pid,part);
          break;
        } catch(error) {
          if(attempt===3)throw Error('Failed to download '+asset.name+' at byte '+start,{cause:error});
          await new Promise(resolve=>setTimeout(resolve,1000*attempt));
        }
      }
    }
  }
  await Promise.all([worker(),worker(),worker()]);
  const staging=destination+'.'+process.pid+'.partial',file=await fs.open(staging,'w'),hash=createHash('sha256');
  try {
    for(const start of starts){const bytes=await fs.readFile(partPath(start));hash.update(bytes);await file.writeFile(bytes);}
  } finally {await file.close();}
  if('sha256:'+hash.digest('hex')!==asset.digest) {
    await fs.unlink(staging);
    for(const start of starts)await fs.unlink(partPath(start)).catch(()=>{});
    throw Error('CI artifact digest mismatch: '+asset.name);
  }
  await fs.rename(staging,destination);
}
await Promise.all(['mac-arm64.dmg','mac-x64.dmg','linux-x64.deb'].map(async suffix=>{
  const name='Folio-'+version+'-'+suffix,file=path.join(dir,name),asset=draft.assets.find(a=>a.name===name);
  if(!asset || asset.state!=='uploaded'||!/^sha256:[a-f0-9]{64}$/.test(asset.digest))throw Error('Missing CI asset: '+name);
  const matches=async()=>{try{return (await fs.stat(file)).size===asset.size && 'sha256:'+createHash('sha256').update(await fs.readFile(file)).digest('hex')===asset.digest;}catch{return false;}};
  if(!await matches()) {
    console.log('Fetching '+name);
    await downloadVerified(asset,file);
  }
  console.log('Verified '+name);
}));
