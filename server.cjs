const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const routes = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};

http.createServer((req, res) => {
  const route = routes[new URL(req.url, 'http://127.0.0.1:3000').pathname];
  if (req.method !== 'GET' || !route) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, {
    'Content-Type': route[1],
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  fs.createReadStream(path.join(__dirname, route[0])).pipe(res);
}).listen(3000, '127.0.0.1', () => {
  console.log('Inyo sandbox: http://127.0.0.1:3000');
});
