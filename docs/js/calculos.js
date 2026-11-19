/*
 * calculos.js — Lógica de cálculo de "Avance en Coaching Ejecutivo" (Training Skills).
 *
 * FUENTE ÚNICA. Este archivo se usa:
 *   - en el navegador (docs/),
 *   - en Node (tests/calculos.test.js),
 *   - y, copiado como apps-script/Calculos.gs, en Google Apps Script.
 *
 * NO edites apps-script/Calculos.gs a mano: edita este archivo y ejecuta `npm run sync`.
 * Debe ser JavaScript puro (sin DOM ni APIs de Apps Script).
 */
var Calculos = (function () {
  'use strict';

  var EPS = 1e-9;
  var MOMENTOS = ['LB', 'M1', 'M2', 'MF'];
  var NOMBRE_MOMENTO = { LB: 'Línea base', M1: 'Medición 1', M2: 'Medición 2', MF: 'Medición final' };

  var ESCALA_DEFECTO = [
    { valor: 1, nivel: 'No evidenciado', descripcion: 'No muestra la conducta; no es consciente de ella.' },
    { valor: 2, nivel: 'Incipiente', descripcion: 'La muestra de forma ocasional y con mucha guía.' },
    { valor: 3, nivel: 'En desarrollo', descripcion: 'La aplica con esfuerzo en situaciones favorables; se le escapa bajo presión.' },
    { valor: 4, nivel: 'Competente', descripcion: 'La aplica de forma consistente, también en situaciones exigentes.' },
    { valor: 5, nivel: 'Maestría', descripcion: 'Es natural, la modela y la contagia a otros.' }
  ];

  /* ---------- utilidades numéricas ---------- */

  // Convierte a número o devuelve null (acepta coma decimal).
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  // Promedio de los valores numéricos (ignora null / vacíos). null si no hay ninguno.
  function promedio(arr) {
    var suma = 0, n = 0;
    for (var i = 0; i < arr.length; i++) {
      var v = num(arr[i]);
      if (v !== null) { suma += v; n++; }
    }
    return n ? suma / n : null;
  }

  /* ---------- reglas por indicador ---------- */

  // Puntaje actual: última medición registrada (MF, si no M2, si no M1, si no LB).
  function puntajeActual(f) {
    var orden = [f.mf, f.m2, f.m1, f.lb];
    for (var i = 0; i < orden.length; i++) {
      var n = num(orden[i]);
      if (n !== null) return n;
    }
    return null;
  }

  // % de avance = (actual − LB) ÷ (meta − LB), tope 100 %; si actual ≥ meta, 100 %.
  // Sin retroceso negativo: si actual < LB el avance es 0.
  // null cuando no se puede calcular (sin actual, sin meta, o sin LB y aún sin llegar a la meta).
  function avance(lb, actual, meta) {
    lb = num(lb); actual = num(actual); meta = num(meta);
    if (actual === null || meta === null) return null;
    if (actual + EPS >= meta) return 1;
    if (lb === null) return null;
    if (meta <= lb) return 0;
    var p = (actual - lb) / (meta - lb);
    return p < 0 ? 0 : p;
  }

  // Meta lograda (actual ≥ meta) · En camino (avance ≥ 50 %) · Prioridad (avance < 50 %).
  function estadoDe(actual, meta, av) {
    actual = num(actual); meta = num(meta);
    if (actual === null || meta === null) return '';
    if (actual + EPS >= meta) return 'Meta lograda';
    return (av !== null && av !== undefined && av + EPS >= 0.5) ? 'En camino' : 'Prioridad';
  }

  // f = { codigo, habilidad, lb, m1, m2, mf, meta }
  function calcularIndicador(f) {
    var lb = num(f.lb);
    var actual = puntajeActual(f);
    var meta = num(f.meta);
    var av = avance(lb, actual, meta);
    return {
      codigo: f.codigo,
      habilidad: f.habilidad,
      lb: lb,
      m1: num(f.m1),
      m2: num(f.m2),
      mf: num(f.mf),
      meta: meta,
      actual: actual,
      variacion: (actual !== null && lb !== null) ? actual - lb : null,
      avance: av,
      estado: estadoDe(actual, meta, av)
    };
  }

  /* ---------- nivel de la escala ---------- */

  // Valor de nivel (1-5) del promedio redondeado hacia abajo (3,7 → 3).
  function nivelValor(prom) {
    prom = num(prom);
    if (prom === null) return null;
    var v = Math.floor(prom + EPS);
    if (v < 1) v = 1;
    if (v > 5) v = 5;
    return v;
  }

  function nivelDe(prom, escala) {
    var v = nivelValor(prom);
    if (v === null) return '';
    escala = escala && escala.length ? escala : ESCALA_DEFECTO;
    for (var i = 0; i < escala.length; i++) {
      if (Number(escala[i].valor) === v) return escala[i].nivel;
    }
    return '';
  }

  /* ---------- agregados ---------- */

  // Resumen de un grupo de indicadores ya calculados (por habilidad o global).
  function resumirGrupo(items, escala) {
    var col = function (k) { return items.map(function (i) { return i[k]; }); };
    var lb = promedio(col('lb'));
    var actual = promedio(col('actual'));
    var meta = promedio(col('meta'));
    var av = promedio(col('avance'));
    var enMeta = 0;
    for (var i = 0; i < items.length; i++) if (items[i].estado === 'Meta lograda') enMeta++;
    return {
      lb: lb,
      m1: promedio(col('m1')),
      m2: promedio(col('m2')),
      mf: promedio(col('mf')),
      meta: meta,
      actual: actual,
      variacion: (actual !== null && lb !== null) ? actual - lb : null,
      indice: actual !== null ? actual / 5 : null,
      avance: av,
      estado: estadoDe(actual, meta, av),
      nivel: nivelDe(actual, escala),
      nivelValor: nivelValor(actual),
      brecha: (meta !== null && actual !== null) ? meta - actual : null,
      enMeta: enMeta,
      total: items.length
    };
  }

  // Nombre de la habilidad con el mayor valor de f(h); en empate, la primera.
  function mejor(habs, f) {
    var best = null, nombre = '';
    for (var i = 0; i < habs.length; i++) {
      var v = f(habs[i]);
      if (v !== null && v !== undefined && (best === null || v > best + 1e-12)) {
        best = v;
        nombre = habs[i].habilidad;
      }
    }
    return nombre;
  }

  // filas = [{ codigo, habilidad, lb, m1, m2, mf, meta }] de un coachee.
  // Devuelve indicadores calculados, resumen por habilidad, global e indicadores clave.
  function analizar(filas, escala) {
    var inds = filas.map(calcularIndicador);
    var orden = [];
    var porHab = Object.create(null);
    inds.forEach(function (i) {
      var h = i.habilidad || '';
      if (!porHab[h]) { porHab[h] = []; orden.push(h); }
      porHab[h].push(i);
    });
    var habilidades = orden.map(function (h) {
      var r = resumirGrupo(porHab[h], escala);
      r.habilidad = h;
      return r;
    });
    var g = resumirGrupo(inds, escala);
    var clave = {
      indiceLB: g.lb,
      indiceActual: g.actual,
      variacionIndice: g.variacion,
      desarrollo: g.indice,
      avance: g.avance,
      enMeta: g.enMeta,
      total: g.total,
      nivel: g.nivel,
      mayorCrecimiento: mejor(habilidades, function (h) { return h.variacion; }),
      masFuerte: mejor(habilidades, function (h) { return h.actual; }),
      mayorOportunidad: mejor(habilidades, function (h) { return h.brecha; })
    };
    return { indicadores: inds, habilidades: habilidades, global: g, clave: clave };
  }

  /* ---------- fechas (cadenas aaaa-mm-dd, sin zona horaria) ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s === null || s === undefined ? '' : s));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: mo, d: d };
  }

  function aISO(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }

  // Suma n meses conservando el día (o el último día del mes si no existe).
  function addMonths(iso, n) {
    var p = parseISO(iso);
    if (!p) return '';
    var total = (p.m - 1) + Math.round(n);
    var y = p.y + Math.floor(total / 12);
    var m = ((total % 12) + 12) % 12;
    var dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return aISO(y, m + 1, Math.min(p.d, dim));
  }

  // LB = inicio, M1 = +3 meses, M2 = +6 meses, MF = +duración.
  function fechasProgramadas(inicio, duracion) {
    if (!parseISO(inicio)) return {};
    var dur = num(duracion);
    var r = { LB: inicio, M1: addMonths(inicio, 3), M2: addMonths(inicio, 6) };
    if (dur !== null && dur > 0) r.MF = addMonths(inicio, dur);
    return r;
  }

  // Días de a hacia b (b − a); null si alguna fecha no es válida.
  function diasEntre(a, b) {
    var pa = parseISO(a), pb = parseISO(b);
    if (!pa || !pb) return null;
    return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
  }

  /* ---------- formato (es: coma decimal) ---------- */

  function redondear(n, dec) {
    var f = Math.pow(10, dec);
    return Math.round((n + (n >= 0 ? EPS : -EPS)) * f) / f;
  }

  function fmt(n, dec) {
    n = num(n);
    if (n === null) return '—';
    dec = dec === undefined ? 1 : dec;
    return redondear(n, dec).toFixed(dec).replace('.', ',');
  }

  function fmtPct(n) {
    n = num(n);
    if (n === null) return '—';
    return Math.round(n * 100 + EPS) + ' %';
  }

  function fmtVar(n) {
    n = num(n);
    if (n === null) return '—';
    var s = fmt(n, 1);
    return (n > 0 && s !== '0,0') ? '+' + s : s;
  }

  return {
    MOMENTOS: MOMENTOS,
    NOMBRE_MOMENTO: NOMBRE_MOMENTO,
    ESCALA_DEFECTO: ESCALA_DEFECTO,
    num: num,
    promedio: promedio,
    puntajeActual: puntajeActual,
    avance: avance,
    estadoDe: estadoDe,
    calcularIndicador: calcularIndicador,
    nivelValor: nivelValor,
    nivelDe: nivelDe,
    resumirGrupo: resumirGrupo,
    analizar: analizar,
    parseISO: parseISO,
    addMonths: addMonths,
    fechasProgramadas: fechasProgramadas,
    diasEntre: diasEntre,
    redondear: redondear,
    fmt: fmt,
    fmtPct: fmtPct,
    fmtVar: fmtVar
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Calculos; }
