import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {releaseNetworkEnv} from './release-network.mjs';
const env=(await releaseNetworkEnv()).env, exec=promisify(execFile);
const gh=async(args,timeout=45000)=>(await exec('gh',args,{env,timeout,maxBuffer:4*1024*1024,windowsHide:true})).stdout;
const version=JSON.parse(await fs.readFile('package.json','utf8')).version, tag='v'+version, repo='Joydivisor/Folio';
const dir=path.resolve('releases',tag);await fs.mkdir(dir,{recursive:true});
const id=(await gh(['release','view',tag,'--repo',repo,'--json','databaseId','--jq','.databaseId'])).trim();
if(!/^\d+$/.test(id))throw Error('Invalid release ID');
const draft=JSON.parse(await gh(['api','repos/'+repo+'/releases/'+id]));
if(!draft.draft||draft.tag_name!==tag)throw Error('Expected the release draft');
await fs.writeFile(path.join(dir,'draft-metadata.json'),JSON.stringify(draft));
await Promise.all(['mac-arm64.dmg','mac-x64.dmg','linux-x64.deb'].map(async suffix=>{
  const name='Folio-'+version+'-'+suffix,file=path.join(dir,name),asset=draft.assets.find(a=>a.name===name);
  if(!asset || asset.state!=='uploaded'||!/^sha256:[a-f0-9]{64}$/.test(asset.digest))throw Error('Missing CI asset: '+name);
  const matches=async()=>{try{return (await fs.stat(file)).size===asset.size && 'sha256:'+createHash('sha256').update(await fs.readFile(file)).digest('hex')===asset.digest;}catch{return false;}};
  if(!await matches()) {
    console.log('Fetching '+name);
    await gh(['release','download',tag,'--repo',repo,'--pattern',name,'--dir',dir,'--clobber'],600000);
    if(!await matches())throw Error('CI artifact digest mismatch: '+name);
  }
  console.log('Verified '+name);
}));
