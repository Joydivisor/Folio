import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=['server.mjs',...['public','desktop','scripts'].flatMap(dir=>readdirSync(dir).filter(f=>/\.(?:js|mjs|cjs)$/.test(f)).map(f=>dir+'/'+f))];
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
console.log(`Syntax checked: ${files.length} modules`);
