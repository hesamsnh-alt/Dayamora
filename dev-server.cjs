const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 3000);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{'Allow':'GET, HEAD'});return res.end('Method not allowed');}
  let requestPath;
  try {requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch {res.writeHead(400);return res.end('Bad request');}
  const file=path.resolve(root,'.'+(requestPath==='/'?'/index.html':requestPath));
  const relative=path.relative(root,file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(p=>p.startsWith('.'))) {res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{
    if(err || !stat.isFile()) {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('File not found. Place package.json and dev-server.cjs next to index.html.');}
    res.writeHead(200,{'Content-Type':types[path.extname(file).toLowerCase()] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')return res.end();
    const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
  });
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?`Port ${port} is busy. Stop the previous server with Ctrl+C, or set PORT to another port.`:err.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`\nDayamora is ready: http://localhost:${port}\nRefresh the browser after saving changes. Stop with Ctrl+C.\n`));
