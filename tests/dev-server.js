#!/usr/bin/env node
/* Servidor de desarrollo: sirve docs/ y una API simulada con datos de ejemplo (para ver la interfaz sin Google). */
const http = require('http'), fs = require('fs'), path = require('path');
const { crearEntorno, cargarBackend } = require('./gas-sim');
const DOCS = path.join(__dirname, '..', 'docs');
const PUERTO = +process.env.PORT || 8765;
const ss = crearEntorno(); cargarBackend(); inicializar();
ss.getSheetByName('Coaches').getRange(2, 1, 1, 3).setValues([['ana@x.com', 'Ana Pérez', 'secreto123']]);
const llamar = (accion, datos, token) => JSON.parse(doPost({ postData: { contents: JSON.stringify({ token: token || '', accion, datos }) } }).s);
const tk = llamar('login', { correo: 'ana@x.com', clave: 'secreto123' }).data.token;
const IND = llamar('catalogos', {}, tk).data.indicadores.map(i => i.codigo);
[['Carlos Ruiz', 'Gerente Comercial', '2026-01-15'], ['María Fernanda Gómez Restrepo', 'Directora de Talento Humano y Cultura', '2026-03-31'], ['Luis Torres', '', '2026-06-01']].forEach((x, k) => {
  const c = llamar('guardarCoachee', { nombre: x[0], cargo: x[1], correo: 'c' + k + '@e.com', coach: 'ana@x.com', objetivo: 'Liderar mejor', inicio: x[2], duracion: 9, estado: 'Activo' }, tk).data;
  llamar('guardarMedicion', { id: c.id, momento: 'LB', fecha: x[2], mediciones: IND.map((c2, i) => ({ codigo: c2, valor: 1 + ((i + k) % 3), evidencia: '' })) }, tk);
  if (k < 2) llamar('guardarMedicion', { id: c.id, momento: 'M1', fecha: '2026-07-01', mediciones: IND.map((c2, i) => ({ codigo: c2, valor: 2 + ((i + k) % 3), evidencia: '' })) }, tk);
});
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
  if (req.url === '/api') {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    let b = ''; req.on('data', d => b += d); req.on('end', () => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(doPost({ postData: { contents: b } }).s); });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(`const API_URL='http://localhost:${PUERTO}/api';`); }
  const f = path.join(DOCS, p);
  if (!f.startsWith(DOCS) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(PUERTO, () => console.log('Interfaz de prueba en http://localhost:' + PUERTO + '  (ana@x.com / secreto123)'));
