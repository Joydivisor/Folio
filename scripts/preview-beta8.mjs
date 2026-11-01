// Local component acceptance page; excluded from the distributable allowlist.
import {makeServer} from '../server.mjs';
import {readFile} from 'node:fs/promises';
const server=makeServer({port:4193}),serve=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 if(req.url==='/beta8-preview'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end(await readFile('tests/fixtures/beta8-preview.html'));}
 else if(req.url==='/beta8-results'){res.writeHead(200,{'Content-Type':'application/json'});res.end(await readFile('tests/reports/beta8-live.json'));}
 else serve(req,res);
});server.listen(4193,'127.0.0.1',()=>console.log('Beta 8 acceptance: http://127.0.0.1:4193/beta8-preview'));
