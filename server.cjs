const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname,'dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer(async(req,res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root,'.'+(requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(root+path.sep)) { res.writeHead(403); return res.end(); }
    const data = await fs.readFile(file); res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream'}); res.end(data);
  } catch (_) { res.writeHead(404); res.end('Not found'); }
}).listen(4173,'127.0.0.1',() => console.log('Science Grade Matrix: http://127.0.0.1:4173'));
