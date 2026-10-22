'use strict';
require('dotenv').config({quiet:true});
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {handle,headers}=require('./lib/api.cjs');
const PUBLIC=path.join(__dirname,'public'),PORT=Number(process.env.PORT||3000);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm'};
const pages={'/':'/index.html','/admin':'/admin.html','/club':'/club.html','/setup':'/setup.html','/budget':'/budget.html','/shop':'/budget.html','/value':'/budget.html','/product':'/product.html'};
if(!process.env.DATABASE_URL){console.error('DATABASE_URL is missing. Add it to .env. To use the separate old SQLite version: npm run dev:local');process.exit(1)}
const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host;if(!host||!['localhost','127.0.0.1'].includes(host.split(':')[0])){res.writeHead(403);return res.end('Invalid host')}
    const url=new URL(req.url,'http://'+host);
    // DAYAMORA_OUTFIT_ROUTE: dedicated authenticated styling endpoint.
    if(url.pathname.startsWith('/outfit-api/')){
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
      const response=await require('./lib/outfits.cjs').handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if(url.pathname.startsWith('/api/')||/^\/(private-uploads|uploads)\//.test(url.pathname)){
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
      const response=await handle(request,{ip:req.socket.remoteAddress,allowSetup:true});res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end()}
    const name=pages[url.pathname]||decodeURIComponent(url.pathname),file=path.resolve(PUBLIC,'.'+name),relative=path.relative(PUBLIC,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found')}
    res.writeHead(200,{...headers,'Content-Type':mime[path.extname(file)]||'application/octet-stream'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
  }catch{if(!res.headersSent)res.writeHead(500);res.end('Request failed')}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port is busy. Stop the previous server with Ctrl+C.':e.code);process.exit(1)});
server.listen(PORT,'127.0.0.1',()=>console.log(`Dayamora Neon: http://localhost:${PORT}\nFirst admin setup: http://localhost:${PORT}/setup`));
