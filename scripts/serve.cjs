const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'};
http.createServer((req,res)=>{
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root,relative);
  const inside = path.relative(root,target);
  if (inside.startsWith('..') || path.isAbsolute(inside) || inside.split(path.sep).some(part=>part.startsWith('.'))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(target,(error,body)=>{
    res.writeHead(error?404:200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(error?'Not found':body);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Social Pulse: http://127.0.0.1:${port}`));
