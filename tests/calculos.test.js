#!/usr/bin/env node
/*
 * Pruebas de los cálculos (sin dependencias). Uso: npm test
 *
 * Verifica la misma lógica que usan la app (docs/js/calculos.js) y la hoja
 * (apps-script/Calculos.gs, copia generada). Caso de aceptación:
 *   Escucha 1,7 → 4,0 · Calibración 78 % "En camino" · índice global 2,2 → 4,0
 *   avance global 96 % · 16/18 indicadores en meta.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const RAIZ = path.join(__dirname, '..');
const RUTA_JS = path.join(RAIZ, 'docs', 'js', 'calculos.js');
const RUTA_GS = path.join(RAIZ, 'apps-script', 'Calculos.gs');

const fuente = fs.readFileSync(RUTA_JS, 'utf8');
const copiaGs = fs.readFileSync(RUTA_GS, 'utf8');

// La versión de Apps Script se evalúa tal como la ejecutaría Apps Script (script global).
function cargarGs(codigo) {
  const ctx = vm.createContext({});
  vm.runInContext(codigo, ctx);
  return vm.runInContext('Calculos', ctx);
}

let pasadas = 0;
let falladas = 0;
function prueba(nombre, fn) {
  try {
    fn();
    pasadas++;
    console.log('  ✔ ' + nombre);
  } catch (e) {
    falladas++;
    console.log('  ✘ ' + nombre + '\n      ' + (e && e.message ? e.message : e));
  }
}

/* ---------- Caso de aceptación ---------- */

// [código, habilidad, LB, M1, M2, MF, meta]
const D = [
  ['E1', 'Escucha', 1, null, null, 4, 4],
  ['E2', 'Escucha', 2, null, null, 4, 4],
  ['E3', 'Escucha', 2, null, null, 4, 4],
  ['P1', 'Pregunta', 3, null, null, 4, 4],
  ['P2', 'Pregunta', 3, null, null, 4, 4],
  ['P3', 'Pregunta', 2, null, null, 5, 4],
  ['R1', 'Rapport', 3, null, null, 4, 4],
  ['R2', 'Rapport', 2, null, null, 4, 4],
  ['R3', 'Rapport', 2, null, null, 4, 4],
  ['C1', 'Calibración', 1, null, null, 3, 4],
  ['C2', 'Calibración', 1, null, null, 3, 4],
  ['C3', 'Calibración', 2, null, null, 4, 4],
  ['O1', 'Foco en resultados', 3, null, null, 4, 4],
  ['O2', 'Foco en resultados', 2, null, null, 4, 4],
  ['O3', 'Foco en resultados', 2, null, null, 4, 4],
  ['A1', 'Autogestión y feedback', 3, null, null, 5, 4],
  ['A2', 'Autogestión y feedback', 3, null, null, 4, 4],
  ['A3', 'Autogestión y feedback', 2, null, null, 4, 4]
];
const FILAS = D.map(r => ({ codigo: r[0], habilidad: r[1], lb: r[2], m1: r[3], m2: r[4], mf: r[5], meta: r[6] }));

const implementaciones = [
  ['docs/js/calculos.js', require(RUTA_JS)],
  ['apps-script/Calculos.gs', cargarGs(copiaGs)]
];

console.log('\nCopia de Apps Script');
prueba('Calculos.gs es idéntico a docs/js/calculos.js (ejecuta `npm run sync` si falla)', () => {
  assert.ok(copiaGs.endsWith(fuente), 'apps-script/Calculos.gs está desactualizado respecto a docs/js/calculos.js');
});

implementaciones.forEach(([nombre, C]) => {
  console.log('\n' + nombre);

  const r = C.analizar(FILAS);
  const hab = n => r.habilidades.find(h => h.habilidad === n);
  const r1 = x => Math.round(x * 10) / 10;

  prueba('Escucha: promedio 1,7 → 4,0', () => {
    assert.strictEqual(r1(hab('Escucha').lb), 1.7);
    assert.strictEqual(r1(hab('Escucha').actual), 4.0);
    assert.strictEqual(C.fmt(hab('Escucha').lb), '1,7');
    assert.strictEqual(C.fmt(hab('Escucha').actual), '4,0');
  });

  prueba('Calibración: 78 % y estado "En camino"', () => {
    assert.strictEqual(Math.round(hab('Calibración').avance * 100), 78);
    assert.strictEqual(C.fmtPct(hab('Calibración').avance), '78 %');
    assert.strictEqual(hab('Calibración').estado, 'En camino');
  });

  prueba('Índice global: 2,2 → 4,0 (índice de desarrollo 80 %)', () => {
    assert.strictEqual(r1(r.clave.indiceLB), 2.2);
    assert.strictEqual(r1(r.clave.indiceActual), 4.0);
    assert.strictEqual(C.fmt(r.clave.indiceLB), '2,2');
    assert.strictEqual(C.fmt(r.clave.indiceActual), '4,0');
    assert.strictEqual(C.fmtPct(r.clave.desarrollo), '80 %');
    assert.strictEqual(C.fmtVar(r.clave.variacionIndice), '+1,8');
  });

  prueba('Avance global: 96 %', () => {
    assert.strictEqual(Math.round(r.clave.avance * 100), 96);
    assert.strictEqual(C.fmtPct(r.clave.avance), '96 %');
  });

  prueba('Indicadores en meta: 16/18', () => {
    assert.strictEqual(r.clave.enMeta, 16);
    assert.strictEqual(r.clave.total, 18);
  });

  prueba('Nivel global: Competente; habilidades clave', () => {
    assert.strictEqual(r.clave.nivel, 'Competente');
    assert.strictEqual(r.clave.mayorCrecimiento, 'Escucha');
    assert.strictEqual(r.clave.masFuerte, 'Pregunta');
    assert.strictEqual(r.clave.mayorOportunidad, 'Calibración');
  });

  /* ---------- reglas por indicador ---------- */

  prueba('Puntaje actual: MF, si no M2, si no M1, si no LB', () => {
    assert.strictEqual(C.puntajeActual({ lb: 1, m1: 2, m2: 3, mf: 4 }), 4);
    assert.strictEqual(C.puntajeActual({ lb: 1, m1: 2, m2: 3, mf: null }), 3);
    assert.strictEqual(C.puntajeActual({ lb: 1, m1: 2, m2: '', mf: '' }), 2);
    assert.strictEqual(C.puntajeActual({ lb: 1 }), 1);
    assert.strictEqual(C.puntajeActual({}), null);
  });

  prueba('% de avance: fórmula, tope 100 %, sin negativos', () => {
    assert.strictEqual(C.avance(2, 3, 4), 0.5);
    assert.strictEqual(C.avance(1, 3, 4), 2 / 3);
    assert.strictEqual(C.avance(2, 4, 4), 1);
    assert.strictEqual(C.avance(2, 5, 4), 1);
    assert.strictEqual(C.avance(4, 4, 4), 1);
    assert.strictEqual(C.avance(3, 2, 4), 0);
    assert.strictEqual(C.avance(5, 3, 4), 0);
    assert.strictEqual(C.avance(null, 3, 4), null);
    assert.strictEqual(C.avance(2, null, 4), null);
  });

  prueba('Estado: Meta lograda / En camino / Prioridad', () => {
    assert.strictEqual(C.estadoDe(4, 4, 1), 'Meta lograda');
    assert.strictEqual(C.estadoDe(5, 4, 1), 'Meta lograda');
    assert.strictEqual(C.estadoDe(3, 4, 0.5), 'En camino');
    assert.strictEqual(C.estadoDe(3, 4, 0.49), 'Prioridad');
    assert.strictEqual(C.estadoDe(2, 4, 0), 'Prioridad');
    assert.strictEqual(C.estadoDe(null, 4, null), '');
  });

  prueba('Variación del indicador = actual − línea base', () => {
    const i = C.calcularIndicador({ codigo: 'E1', habilidad: 'Escucha', lb: 1, m1: 2, m2: 3, mf: null, meta: 4 });
    assert.strictEqual(i.actual, 3);
    assert.strictEqual(i.variacion, 2);
    assert.strictEqual(i.estado, 'En camino');
  });

  prueba('Nivel: promedio redondeado hacia abajo (3,7 → En desarrollo)', () => {
    assert.strictEqual(C.nivelDe(3.7), 'En desarrollo');
    assert.strictEqual(C.nivelDe(4.0), 'Competente');
    assert.strictEqual(C.nivelDe(4.99), 'Competente');
    assert.strictEqual(C.nivelDe(5), 'Maestría');
    assert.strictEqual(C.nivelDe(1.2), 'No evidenciado');
    assert.strictEqual(C.nivelDe(null), '');
  });

  prueba('Sin mediciones: todo vacío y sin errores', () => {
    const v = C.analizar([{ codigo: 'E1', habilidad: 'Escucha', lb: null, m1: null, m2: null, mf: null, meta: 4 }]);
    assert.strictEqual(v.global.actual, null);
    assert.strictEqual(v.global.estado, '');
    assert.strictEqual(v.clave.nivel, '');
    assert.strictEqual(C.fmt(v.global.actual), '—');
  });

  /* ---------- fechas programadas ---------- */

  prueba('Fechas programadas: LB = inicio, M1 = +3, M2 = +6, MF = +duración', () => {
    const f = C.fechasProgramadas('2026-01-15', 9);
    assert.strictEqual(JSON.stringify(f), JSON.stringify({ LB: '2026-01-15', M1: '2026-04-15', M2: '2026-07-15', MF: '2026-10-15' }));
  });

  prueba('Suma de meses ajusta el último día del mes y cruza años', () => {
    assert.strictEqual(C.addMonths('2026-01-31', 1), '2026-02-28');
    assert.strictEqual(C.addMonths('2024-01-31', 1), '2024-02-29');
    assert.strictEqual(C.addMonths('2026-11-30', 3), '2027-02-28');
    assert.strictEqual(C.addMonths('2026-11-15', 14), '2028-01-15');
    assert.strictEqual(C.addMonths('no-fecha', 3), '');
    assert.strictEqual(JSON.stringify(C.fechasProgramadas('', 9)), '{}');
  });

  prueba('Días entre fechas y validación de fechas', () => {
    assert.strictEqual(C.diasEntre('2026-03-01', '2026-03-31'), 30);
    assert.strictEqual(C.diasEntre('2026-03-10', '2026-03-05'), -5);
    assert.strictEqual(C.diasEntre('x', '2026-03-05'), null);
    assert.strictEqual(C.parseISO('2026-02-30'), null);
  });
});

console.log('\n' + pasadas + ' pruebas correctas, ' + falladas + ' con error.');
process.exit(falladas ? 1 : 0);
