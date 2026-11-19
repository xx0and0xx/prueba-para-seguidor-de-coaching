#!/usr/bin/env node
/*
 * Prueba de integración del backend (apps-script/*.gs) contra un simulador en memoria de
 * Google Sheets / Drive / Mail / Cache / Properties. No sustituye una prueba real en Google,
 * pero ejecuta de punta a punta la API: ingreso, bloqueo, coachees, mediciones, tablero,
 * informe PDF, correo, cambio de contraseña, sincronización y borrado.
 *
 * Uso: node tests/backend.mock.test.js   (o: npm run test:backend)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert');

const DIR = path.join(__dirname, '..', 'apps-script');

/* ============================================================================
 * Simulador de Google Apps Script
 * ========================================================================== */

const { crearEntorno, cargarBackend } = require('./gas-sim');

/* ============================================================================
 * Escenario
 * ========================================================================== */

let pasadas = 0, falladas = 0;
function prueba(nombre, fn) {
  try { fn(); pasadas++; console.log('  ✔ ' + nombre); }
  catch (e) { falladas++; console.log('  ✘ ' + nombre + '\n      ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n      ') : e)); }
}

const api = (accion, datos, token) => JSON.parse(doPost({ postData: { contents: JSON.stringify({ token: token || '', accion, datos: datos || {} }) } }).s);
const ok = (accion, datos, token) => { const r = api(accion, datos, token); assert.ok(r.ok, `${accion} falló: ${r.error}`); return r.data; };

const IND = ['E1', 'E2', 'E3', 'P1', 'P2', 'P3', 'R1', 'R2', 'R3', 'C1', 'C2', 'C3', 'O1', 'O2', 'O3', 'A1', 'A2', 'A3'];
const LB = [1, 2, 2, 3, 3, 2, 3, 2, 2, 1, 1, 2, 3, 2, 2, 3, 3, 2];
const MF = [4, 4, 4, 4, 4, 5, 4, 4, 4, 3, 3, 4, 4, 4, 4, 5, 4, 4];

console.log('\nBackend de Apps Script (simulador)');
const ss = crearEntorno();
cargarBackend();
let token, id, id2;

prueba('inicializar() crea las 8 hojas con los datos por defecto', () => {
  inicializar();
  ['Configuración', 'Coaches', 'Coachees', 'Evaluación', 'Indicadores', 'Escala', 'Fundamentación_Teórica', 'Tablero']
    .forEach(n => assert.ok(ss.getSheetByName(n), 'falta ' + n));
  assert.strictEqual(ss.getSheetByName('Indicadores').getLastRow(), 19);
  assert.strictEqual(ss.getSheetByName('Escala').getLastRow(), 6);
  assert.strictEqual(ss.getSheetByName('Fundamentación_Teórica').getLastRow(), 11);
  assert.strictEqual(ss.getSheetByName('Configuración').getLastRow(), 10);
  assert.ok(ss.getSheetByName('Evaluación').f['1,11'].includes('ARRAYFORMULA'), 'falta la fórmula de Puntaje actual');
  assert.ok(ss.getSheetByName('Tablero').f['45,2'].includes('FILTER'), 'falta el FILTER del Tablero');
  inicializar(); // idempotente
  assert.strictEqual(ss.getSheetByName('Indicadores').getLastRow(), 19);
});

prueba('El enlace de configuración y los valores por defecto se leen bien', () => {
  const c = leerConfig_();
  assert.strictEqual(c.meta, 4); assert.strictEqual(c.duracion, 9); assert.strictEqual(c.intensidad, 12);
  assert.strictEqual(c.programa, 'Avance en Coaching Ejecutivo');
});

prueba('Contraseña en texto plano se cifra con onEdit y en cada lectura', () => {
  const h = ss.getSheetByName('Coaches');
  h.getRange(2, 1, 1, 3).setValues([['Ana@X.com', 'Ana Pérez', 'secreto123']]);
  h.getRange(3, 1, 1, 3).setValues([['luis@x.com', 'Luis Gómez', 'otraClave1']]);
  onEdit({ range: h.getRange(2, 3) });
  assert.ok(String(h.getRange(2, 3).getValue()).startsWith('🔒 '));
  assert.ok(!String(h.getRange(2, 3).getValue()).includes('secreto123'));
  leerCoaches_();
  assert.ok(String(h.getRange(3, 3).getValue()).startsWith('🔒 '));
});

prueba('Acciones: sin token, inexistentes y lista blanca', () => {
  assert.strictEqual(api('catalogos').error, 'SESION_INVALIDA');
  assert.strictEqual(api('borrarTodo', {}, 'x'.repeat(64)).error, 'Acción no permitida.');
  assert.strictEqual(api('constructor').error, 'Acción no permitida.');
  assert.strictEqual(JSON.parse(doPost({ postData: { contents: 'no es json' } }).s).ok, false);
  assert.strictEqual(api('configPublica').ok, true);
});

prueba('Login correcto devuelve token; incorrecto no revela si el correo existe', () => {
  const r = ok('login', { correo: ' ANA@x.com ', clave: 'secreto123' });
  token = r.token;
  assert.strictEqual(r.nombre, 'Ana Pérez');
  assert.strictEqual(api('login', { correo: 'ana@x.com', clave: 'mala' }).error, 'Correo o contraseña incorrectos.');
  assert.strictEqual(api('login', { correo: 'nadie@x.com', clave: 'mala' }).error, 'Correo o contraseña incorrectos.');
  assert.strictEqual(ok('sesion', {}, token).correo, 'ana@x.com');
  // el token en claro nunca se guarda
  assert.ok(![...__props.keys()].some(k => k.includes(token)) && ![...__props.values()].some(v => v.includes(token)));
});

prueba('5 intentos fallidos bloquean 15 minutos (incluso con la clave correcta)', () => {
  for (let i = 0; i < 4; i++) assert.strictEqual(api('login', { correo: 'luis@x.com', clave: 'x' + i }).error, 'Correo o contraseña incorrectos.');
  assert.ok(/15 minutos/.test(api('login', { correo: 'luis@x.com', clave: 'x5' }).error));
  assert.ok(/15 minutos/.test(api('login', { correo: 'luis@x.com', clave: 'otraClave1' }).error));
});

prueba('Configuración: carpeta inválida se rechaza y la válida se guarda', () => {
  assert.ok(!api('guardarConfiguracion', { programa: 'P', organizacion: 'O', carpeta: 'https://drive.google.com/drive/folders/NOEXISTE00000', meta: 4, duracion: 9, remitente: 'R' }, token).ok);
  assert.ok(!api('guardarConfiguracion', { programa: 'P', organizacion: 'O', carpeta: '', meta: 9, duracion: 9, remitente: 'R' }, token).ok);
  const r = ok('guardarConfiguracion', {
    programa: 'Avance en Coaching Ejecutivo', organizacion: 'Training Skills', carpeta: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp',
    meta: 4, duracion: 9, remitente: 'Training Skills Coaching', enlaceApp: 'https://ejemplo.github.io/app/'
  }, token);
  assert.strictEqual(r.config.remitente, 'Training Skills Coaching');
  assert.strictEqual(ok('verificarCarpeta', { carpeta: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp' }, token).nombre, 'Informes');
});

prueba('Catálogos: 18 indicadores y escala de 5 niveles', () => {
  const c = ok('catalogos', {}, token);
  assert.strictEqual(c.indicadores.length, 18);
  assert.strictEqual(c.escala.length, 5);
  assert.strictEqual(ok('fundamentacion', {}, token).tarjetas.length, 10);
});

prueba('Crear coachee: ID, estado, fechas programadas y 18 filas en Evaluación', () => {
  const r = ok('guardarCoachee', { nombre: 'Carlos Ruiz', cargo: 'Gerente', correo: 'carlos@empresa.com', coach: 'ana@x.com', objetivo: 'Liderar mejor', inicio: '2026-01-15', duracion: 9, estado: 'Activo', prog: { LB: '2026-01-15', M1: '2026-04-15', M2: '', MF: '' } }, token);
  id = r.id;
  assert.ok(/^CO-[0-9A-F]{8}$/.test(id));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.coachee.prog)), { LB: '2026-01-15', M1: '2026-04-15', M2: '2026-07-15', MF: '2026-10-15' });
  assert.strictEqual(ok('obtenerEvaluacion', { id }, token).filas.length, 18);
  assert.ok(!api('guardarCoachee', { nombre: '', coach: '' }, token).ok);
  assert.ok(!api('guardarCoachee', { nombre: 'X', correo: 'no-es-correo' }, token).ok);
  assert.ok(!api('guardarCoachee', { nombre: 'X', coach: 'fantasma@x.com' }, token).ok);
});

prueba('Registrar medición: línea base y final, fecha real y validaciones', () => {
  const med = (arr, ev) => IND.map((c, i) => ({ codigo: c, valor: arr[i], evidencia: ev && i === 0 ? ev : '' }));
  assert.ok(!api('guardarMedicion', { id, momento: 'LB', fecha: '2026-01-15', mediciones: med(LB.map(() => 7)) }, token).ok, 'acepta puntaje 7');
  assert.ok(!api('guardarMedicion', { id, momento: 'LB', fecha: '2026-01-15', mediciones: med(LB.map(() => null)) }, token).ok, 'acepta todo vacío');
  assert.ok(!api('guardarMedicion', { id, momento: 'XX', fecha: '2026-01-15', mediciones: med(LB) }, token).ok);
  assert.ok(!api('guardarMedicion', { id, momento: 'LB', fecha: '15/01/2026', mediciones: med(LB) }, token).ok);
  ok('guardarMedicion', { id, momento: 'LB', fecha: '2026-01-15', mediciones: med(LB, '=HYPERLINK("http://malo.com")') }, token);
  ok('guardarMedicion', { id, momento: 'MF', fecha: '2026-10-20', mediciones: med(MF) }, token);
  const e = ok('obtenerEvaluacion', { id }, token);
  assert.deepStrictEqual(e.filas.map(f => f.lb), LB);
  assert.deepStrictEqual(e.filas.map(f => f.mf), MF);
  assert.strictEqual(e.coachee.real.LB, '2026-01-15');
  assert.strictEqual(e.coachee.real.MF, '2026-10-20');
  assert.strictEqual(e.coachee.real.M1, '');
  assert.ok(e.filas[0].ev.LB.startsWith(' ='), 'la evidencia con "=" debe quedar como texto, no fórmula');
});

prueba('Las columnas calculadas de Evaluación (K:N) nunca se escriben desde el backend', () => {
  const h = ss.getSheetByName('Evaluación');
  for (let r = 2; r <= h.getLastRow(); r++) for (let c = 11; c <= 14; c++) assert.strictEqual(h._get(r, c), '', `K:N escrito en fila ${r}`);
});

prueba('Meta editable por indicador', () => {
  ok('guardarMeta', { id, codigo: 'E1', meta: 5 }, token);
  assert.strictEqual(ok('obtenerEvaluacion', { id }, token).filas[0].meta, 5);
  assert.ok(!api('guardarMeta', { id, codigo: 'E1', meta: 6 }, token).ok);
  assert.ok(!api('guardarMeta', { id, codigo: 'ZZ', meta: 4 }, token).ok);
  ok('guardarMeta', { id, codigo: 'E1', meta: 4 }, token);
});

prueba('Tablero: índices y avance según el caso de aceptación', () => {
  const t = ok('tablero', {}, token);
  const c = t.coachees.find(x => x.id === id);
  assert.strictEqual(c.enMeta, 16); assert.strictEqual(c.total, 18);
  assert.strictEqual(Math.round(c.avance * 100), 96);
  assert.strictEqual(Calculos.fmt(c.lb), '2,2'); assert.strictEqual(Calculos.fmt(c.actual), '4,0');
  assert.strictEqual(c.nivel, 'Competente');
  assert.ok(Array.isArray(t.proximas));
  assert.ok(t.proximas.every(p => p.id === id && ['M1', 'M2'].includes(p.momento)), 'solo deben figurar momentos sin fecha real');
});

prueba('Textos del informe, vista previa, PDF en Drive y correo', () => {
  ok('guardarTextosInforme', { id, logros: 'Mejoró <b>mucho</b>', aprendizajes: 'A escuchar', areas: 'Calibración', recomendaciones: 'Seguir practicando' }, token);
  const v = ok('vistaPreviaInforme', { id }, token).html;
  assert.ok(v.includes('Carlos Ruiz') && v.includes('96 %') && v.includes('16/18') && v.includes('2,2 → 4,0'));
  assert.ok(v.includes('&lt;b&gt;mucho&lt;/b&gt;') && !v.includes('<b>mucho</b>'), 'el HTML de usuario debe ir escapado');
  assert.strictEqual((v.match(/class="salto"/g) || []).length, 1, 'un salto de página = dos páginas');
  const g = ok('generarInforme', { id }, token);
  assert.ok(/^Informe_Coaching_Carlos_Ruiz_\d{4}-\d{2}-\d{2}\.pdf$/.test(g.nombre), g.nombre);
  assert.strictEqual(ok('obtenerCoachee', { id }, token).coachee.informe, g.url);
  const n = __archivos.length;
  ok('enviarInforme', { id, destinatario: 'carlos@empresa.com', mensaje: 'Hola <script>', regenerar: false }, token);
  assert.strictEqual(__archivos.length, n, 'no debe regenerar el PDF si ya existe');
  const mail = __correos[0];
  assert.strictEqual(mail.to, 'carlos@empresa.com'); assert.strictEqual(mail.name, 'Training Skills Coaching');
  assert.strictEqual(mail.attachments.length, 1); assert.ok(!mail.htmlBody.includes('<script>'));
  ok('enviarInforme', { id, destinatario: 'carlos@empresa.com', regenerar: true }, token);
  assert.strictEqual(__archivos.length, n + 1);
  assert.ok(!api('enviarInforme', { id, destinatario: 'a@b.com, c@d.com' }, token).ok);
  assert.ok(!api('enviarInforme', { id, destinatario: 'malo' }, token).ok);
});

prueba('Coachee escrito a mano en la hoja: la app lo sincroniza solo', () => {
  const h = ss.getSheetByName('Coachees');
  h.getRange(3, 2).setValue('María Gómez');
  h.getRange(3, 8).setValue(new Date('2026-03-31T17:00:00Z'));
  const l = ok('listarCoachees', {}, token).coachees;
  const m = l.find(c => c.nombre === 'María Gómez');
  assert.ok(m && /^CO-/.test(m.id)); id2 = m.id;
  assert.strictEqual(m.estado, 'Activo'); assert.strictEqual(m.duracion, 9);
  assert.strictEqual(m.inicio, '2026-03-31');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(m.prog)), { LB: '2026-03-31', M1: '2026-06-30', M2: '2026-09-30', MF: '2026-12-31' });
  assert.strictEqual(ok('obtenerEvaluacion', { id: id2 }, token).filas.length, 18);
  const ev = ss.getSheetByName('Evaluación');
  assert.strictEqual(ev.d.filter((r, i) => i > 0 && r[0]).length, 36);
});

prueba('Sincronizar desde el menú es idempotente y actualiza nombres', () => {
  ss.getSheetByName('Coachees').getRange(3, 2).setValue('María G. Gómez');
  sincronizar();
  const e = ok('obtenerEvaluacion', { id: id2 }, token);
  assert.strictEqual(ss.getSheetByName('Evaluación').getRange(20, 2).getValue(), 'María G. Gómez');
  assert.strictEqual(e.filas.length, 18);
  assert.strictEqual(ss.getSheetByName('Evaluación').d.filter((r, i) => i > 0 && r[0]).length, 36);
});

prueba('Cambiar contraseña: valida, cierra otras sesiones y conserva la actual', () => {
  const otra = ok('login', { correo: 'ana@x.com', clave: 'secreto123' }).token;
  assert.ok(!api('cambiarClave', { actual: 'mala', nueva: 'nuevaClave9', confirmacion: 'nuevaClave9' }, token).ok);
  assert.ok(!api('cambiarClave', { actual: 'secreto123', nueva: '123', confirmacion: '123' }, token).ok);
  assert.ok(!api('cambiarClave', { actual: 'secreto123', nueva: 'nuevaClave9', confirmacion: 'distinta' }, token).ok);
  ok('cambiarClave', { actual: 'secreto123', nueva: 'nuevaClave9', confirmacion: 'nuevaClave9' }, token);
  assert.strictEqual(ok('sesion', {}, token).correo, 'ana@x.com', 'la sesión actual debe conservarse');
  assert.strictEqual(api('sesion', {}, otra).error, 'SESION_INVALIDA', 'la otra sesión debe cerrarse');
  assert.ok(!api('login', { correo: 'ana@x.com', clave: 'secreto123' }).ok);
  assert.ok(api('login', { correo: 'ana@x.com', clave: 'nuevaClave9' }).ok);
});

prueba('Si el administrador cambia la contraseña en la hoja, las sesiones dejan de valer', () => {
  ss.getSheetByName('Coaches').getRange(2, 3).setValue('claveDelAdmin');
  assert.strictEqual(api('sesion', {}, token).error, 'SESION_INVALIDA');
  assert.ok(api('login', { correo: 'ana@x.com', clave: 'claveDelAdmin' }).ok);
  token = ok('login', { correo: 'ana@x.com', clave: 'claveDelAdmin' }).token;
});

prueba('Si se borra al coach, su sesión deja de valer', () => {
  const t2 = ok('login', { correo: 'ana@x.com', clave: 'claveDelAdmin' }).token;
  const h = ss.getSheetByName('Coaches');
  const fila = h.getRange(2, 1, 1, 3).getValues()[0];
  h.getRange(2, 1, 1, 3).setValues([['', '', '']]);
  assert.strictEqual(api('sesion', {}, t2).error, 'SESION_INVALIDA');
  h.getRange(2, 1, 1, 3).setValues([fila]);
  token = ok('login', { correo: 'ana@x.com', clave: 'claveDelAdmin' }).token;
});

prueba('Cerrar y eliminar coachees (con sus filas de Evaluación)', () => {
  ok('cerrarCoachee', { id: id2 }, token);
  assert.strictEqual(ok('obtenerCoachee', { id: id2 }, token).coachee.estado, 'Cerrado');
  ok('eliminarCoachee', { id }, token);
  assert.ok(!api('obtenerCoachee', { id }, token).ok);
  assert.strictEqual(ss.getSheetByName('Evaluación').d.filter((r, i) => i > 0 && r[0]).length, 18);
  ok('eliminarCoachee', { id: id2 }, token);
  assert.strictEqual(ss.getSheetByName('Evaluación').d.filter((r, i) => i > 0 && r[0]).length, 0);
});

prueba('logout invalida el token', () => {
  ok('logout', {}, token);
  assert.strictEqual(api('sesion', {}, token).error, 'SESION_INVALIDA');
});

console.log('\n' + pasadas + ' pruebas correctas, ' + falladas + ' con error.');
process.exit(falladas ? 1 : 0);
