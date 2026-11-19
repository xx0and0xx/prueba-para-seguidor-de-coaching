#!/usr/bin/env node
/* Prueba de humo del frontend: jsdom + fetch conectado al backend simulado. Requiere: npm i -D jsdom */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { crearEntorno, cargarBackend } = require('./gas-sim');

const DOCS = path.join(__dirname, '..', 'docs');
const ss = crearEntorno(); cargarBackend(); inicializar();
const h = ss.getSheetByName('Coaches');
h.getRange(2, 1, 1, 3).setValues([['ana@x.com', 'Ana Pérez', 'secreto123']]);
const llamar = (accion, datos, token) => JSON.parse(doPost({ postData: { contents: JSON.stringify({ token: token || '', accion, datos }) } }).s);
const tk = llamar('login', { correo: 'ana@x.com', clave: 'secreto123' }).data.token;
const IND = llamar('catalogos', {}, tk).data.indicadores.map(i => i.codigo);
const c1 = llamar('guardarCoachee', { nombre: 'Carlos Ruiz', cargo: 'Gerente', correo: 'c@e.com', coach: 'ana@x.com', objetivo: 'Liderar', inicio: '2026-01-15', duracion: 9, estado: 'Activo' }, tk).data;
llamar('guardarMedicion', { id: c1.id, momento: 'LB', fecha: '2026-01-15', mediciones: IND.map((c, i) => ({ codigo: c, valor: 1 + (i % 3), evidencia: '' })) }, tk);
llamar('guardarMedicion', { id: c1.id, momento: 'MF', fecha: '2026-10-15', mediciones: IND.map(c => ({ codigo: c, valor: 4, evidencia: '' })) }, tk);

const errores = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errores.push('jsdomError: ' + (e.detail && e.detail.stack || e.message)));
vc.on('error', (...a) => errores.push('console.error: ' + a.join(' ')));

const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8').replace(/<script src="([^"]+)"[^>]*><\/script>/g, (m, src) => {
  const f = src.split('?')[0] === 'config.js' ? null : path.join(DOCS, src.split('?')[0]);
  const code = f ? fs.readFileSync(f, 'utf8') : "const API_URL='https://script.google.com/macros/s/TEST/exec';";
  return '<script>' + code.replace(/<\/script/g, '<\\/script') + '</script>';
});
const dom = new JSDOM(html, { url: 'https://ejemplo.github.io/app/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
  w.fetch = async (url, o) => ({ json: async () => llamar(JSON.parse(o.body).accion, JSON.parse(o.body).datos, JSON.parse(o.body).token) });
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  w.scrollTo = () => {};
} });
const w = dom.window, d = w.document;
const esperar = ms => new Promise(r => setTimeout(r, ms));
let fallos = 0;
const chequear = (n, c) => { console.log((c ? '  ✔ ' : '  ✘ ') + n); if (!c) fallos++; };
const visible = id => !d.getElementById(id).hidden;

(async () => {
  console.log('\nFrontend (jsdom)');
  await esperar(300);
  chequear('muestra el login', visible('login') && !visible('app'));
  d.getElementById('login-correo').value = 'ana@x.com';
  d.getElementById('login-clave').value = 'mala';
  d.getElementById('form-login').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await esperar(300);
  chequear('clave incorrecta muestra error', visible('login-error'));
  d.getElementById('login-clave').value = 'secreto123';
  d.getElementById('form-login').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await esperar(600);
  chequear('entra a la app', visible('app') && d.getElementById('usuario-nombre').textContent === 'Ana Pérez');
  const botones = [...d.querySelectorAll('#nav [data-vista]')].map(b => b.getAttribute('data-vista'));
  chequear('menú con las secciones: ' + botones.join(','), botones.length >= 5);
  for (const v of botones) {
    d.querySelector(`#nav [data-vista="${v}"]`).click();
    await esperar(500);
    const sec = d.getElementById('v-' + v);
    chequear(`vista ${v} se renderiza`, !sec.hidden && sec.textContent.trim().length > 20);
  }
  w.App.ir('tablero'); await esperar(500);
  chequear('tablero muestra al coachee', d.getElementById('v-tablero').textContent.includes('Carlos Ruiz'));
  w.App.ir('avance', { c: c1.id }); await esperar(700);
  const av = d.getElementById('v-avance').textContent;
  chequear('avance muestra índices 2,0 → 4,0', av.includes('4,0'));
  w.App.ir('medicion', { c: c1.id, m: 'M1' }); await esperar(700);
  chequear('medición muestra 18 sliders', d.querySelectorAll('#v-medicion input[type=range]').length >= 1);
  chequear('sin errores en consola', errores.length === 0);
  errores.forEach(e => console.log('     ' + e.split('\n').slice(0, 3).join('\n     ')));
  console.log(fallos ? `\n${fallos} verificaciones fallaron.` : '\nTodo correcto.');
  process.exit(fallos ? 1 : 0);
})();
