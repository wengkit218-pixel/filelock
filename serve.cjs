const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\TOSHIBA\\.qclaw\\workspace\\tools\\filelock';

http.createServer((req, res) => {
  let url = req.url === '/' ? '/FileLock.html' : req.url;
  const f = path.join(ROOT, url.split('?')[0]);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('not found'); }
    else { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(d); }
  });
}).listen(8799, () => console.log('server on http://localhost:8799'));
