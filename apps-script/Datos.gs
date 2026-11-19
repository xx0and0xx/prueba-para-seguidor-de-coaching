/**
 * Datos.gs — Lectura/escritura de las hojas y acciones de datos de la API.
 *
 * Todo lo que se guarda desde la app queda en la hoja y todo lo que se escribe a mano
 * en la hoja se ve en la app (no hay copias intermedias ni caché de datos).
 */

/* ============================================================================
 * Utilidades generales
 * ========================================================================== */

var EMAIL_RE_ = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function tz_() { return ss_().getSpreadsheetTimeZone(); }

function hoja_(clave) {
  var s = ss_().getSheetByName(HOJAS[clave]);
  if (!s) falla_('Falta la hoja "' + HOJAS[clave] + '". Ejecuta el menú 🎯 Coaching ▸ Inicializar / aplicar estilos.');
  return s;
}

function hoyISO_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }

/** Minúsculas, sin tildes, emojis ni signos: sirve para reconocer las claves de Configuración. */
function normalizar_(s) {
  return String(s === null || s === undefined ? '' : s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Evita que un texto escrito por un usuario se interprete como fórmula en la hoja. */
function textoSeguro_(s) {
  s = String(s === null || s === undefined ? '' : s);
  return /^[=+\-@]/.test(s) ? ' ' + s : s;
}

/** Texto limpio: recorta, limita el largo y lo protege contra fórmulas. */
function limpiarTexto_(v, max) {
  var s = String(v === null || v === undefined ? '' : v).replace(/\r\n/g, '\n').trim();
  if (max && s.length > max) s = s.substring(0, max);
  return textoSeguro_(s);
}

function validarId_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!/^CO-[A-Za-z0-9]{4,16}$/.test(s)) falla_('Identificador de coachee inválido.');
  return s;
}

function validarPuntaje_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  if (!isFinite(n) || Math.floor(n) !== n || n < 1 || n > 5) falla_('Los puntajes deben ser números enteros de 1 a 5.');
  return n;
}

/** Fecha aaaa-mm-dd válida. Si no es obligatoria, '' se acepta. */
function validarFecha_(v, obligatoria) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) {
    if (obligatoria) falla_('Falta la fecha.');
    return '';
  }
  if (!Calculos.parseISO(s)) falla_('Fecha inválida: ' + s + '. Usa el formato aaaa-mm-dd.');
  return s;
}

/** Celda → aaaa-mm-dd (acepta fechas de Sheets, aaaa-mm-dd o dd/mm/aaaa). */
function fechaDeCelda_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) return '';
  if (Calculos.parseISO(s)) return s;
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    var iso = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return Calculos.parseISO(iso) ? iso : '';
  }
  return '';
}

/** aaaa-mm-dd → Date a las 12:00 (evita corrimientos de día por zona horaria). */
function fechaACelda_(iso) {
  if (!iso || !Calculos.parseISO(iso)) return '';
  return Utilities.parseDate(iso + ' 12:00', tz_(), 'yyyy-MM-dd HH:mm');
}

function idDriveDeEnlace_(t) {
  t = String(t === null || t === undefined ? '' : t).trim();
  if (!t) return '';
  var m = /\/folders\/([-\w]{10,})/.exec(t) || /\/d\/([-\w]{10,})/.exec(t) || /[?&]id=([-\w]{10,})/.exec(t);
  if (m) return m[1];
  return /^[-\w]{10,}$/.test(t) ? t : '';
}

function ultimaFilaCol_(hoja, col) {
  var max = hoja.getMaxRows();
  if (max < 1) return 1;
  var vals = hoja.getRange(1, col, max, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (vals[i][0] !== '' && vals[i][0] !== null) return i + 1;
  }
  return 1;
}

function nuevoId_(usados) {
  var id;
  do {
    id = 'CO-' + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();
  } while (usados && usados[id]);
  if (usados) usados[id] = true;
  return id;
}

/* ============================================================================
 * Configuración, catálogos
 * ========================================================================== */

function claveDeEtiqueta_(etiqueta) {
  var n = normalizar_(etiqueta);
  for (var i = 0; i < CONFIG_DEF.length; i++) {
    if (n.indexOf(CONFIG_DEF[i].prefijo) === 0) return CONFIG_DEF[i].k;
  }
  return '';
}

function leerConfig_() {
  var out = {};
  CONFIG_DEF.forEach(function (d) { out[d.k] = d.def; });
  var h = hoja_('CONFIG');
  var n = h.getLastRow();
  if (n >= 2) {
    var vals = h.getRange(2, 1, n - 1, 2).getDisplayValues();
    vals.forEach(function (r) {
      var k = claveDeEtiqueta_(r[0]);
      if (k && String(r[1]).trim() !== '') out[k] = String(r[1]).trim();
    });
  }
  var meta = Calculos.num(out.meta);
  out.meta = (meta !== null && meta >= 1 && meta <= 5) ? meta : 4;
  var dur = Calculos.num(out.duracion);
  out.duracion = (dur !== null && dur >= 1 && dur <= 60) ? Math.round(dur) : 9;
  var inten = parseFloat(String(out.intensidad).replace('%', '').replace(',', '.'));
  out.intensidad = isFinite(inten) ? Math.max(0, Math.min(100, inten)) : 12;
  return out;
}

function escribirConfig_(k, valor) {
  var h = hoja_('CONFIG');
  var n = h.getLastRow();
  var vals = n >= 2 ? h.getRange(2, 1, n - 1, 1).getValues() : [];
  var v = typeof valor === 'string' ? textoSeguro_(valor) : valor;
  for (var i = 0; i < vals.length; i++) {
    if (claveDeEtiqueta_(vals[i][0]) === k) {
      h.getRange(i + 2, 2).setValue(v);
      return;
    }
  }
  var def = null;
  CONFIG_DEF.forEach(function (d) { if (d.k === k) def = d; });
  h.getRange(Math.max(n, 1) + 1, 1, 1, 2).setValues([[def ? def.etiqueta : k, v]]);
}

function leerIndicadores_() {
  var cfg = leerConfig_();
  var h = hoja_('IND');
  var n = h.getLastRow();
  if (n < 2) return [];
  var vals = h.getRange(2, 1, n - 1, 5).getValues();
  var out = [];
  vals.forEach(function (r, i) {
    var codigo = String(r[0]).trim();
    if (!codigo) return;
    var meta = Calculos.num(r[3]);
    var orden = Calculos.num(r[4]);
    out.push({
      codigo: codigo,
      habilidad: String(r[1]).trim(),
      indicador: String(r[2]).trim(),
      meta: (meta !== null && meta >= 1 && meta <= 5) ? meta : cfg.meta,
      orden: orden !== null ? orden : i + 1,
      pos: i
    });
  });
  out.sort(function (a, b) { return a.orden - b.orden || a.pos - b.pos; });
  return out;
}

function leerEscala_() {
  var h = hoja_('ESCALA');
  var n = h.getLastRow();
  var out = [];
  if (n >= 2) {
    h.getRange(2, 1, n - 1, 3).getValues().forEach(function (r) {
      var v = Calculos.num(r[0]);
      if (v !== null) out.push({ valor: v, nivel: String(r[1]).trim(), descripcion: String(r[2]).trim() });
    });
  }
  out.sort(function (a, b) { return a.valor - b.valor; });
  return out.length === 5 ? out : Calculos.ESCALA_DEFECTO.slice();
}

function mapaCoaches_() {
  var m = {};
  leerCoaches_().forEach(function (c) { m[c.correo] = c.nombre || c.correo; });
  return m;
}

function accionCatalogos_() {
  var cfg = leerConfig_();
  return {
    config: {
      programa: cfg.programa, organizacion: cfg.organizacion, meta: cfg.meta, duracion: cfg.duracion,
      imagen: cfg.imagen, intensidad: cfg.intensidad, enlaceApp: cfg.enlaceApp
    },
    indicadores: leerIndicadores_().map(function (i) {
      return { codigo: i.codigo, habilidad: i.habilidad, indicador: i.indicador, meta: i.meta, orden: i.orden };
    }),
    escala: leerEscala_()
  };
}

function accionFundamentacion_() {
  var h = hoja_('FUND');
  var n = h.getLastRow();
  var out = [];
  if (n >= 2) {
    h.getRange(2, 1, n - 1, 7).getValues().forEach(function (r, i) {
      if (!String(r[3]).trim()) return;
      if (normalizar_(r[6]) === 'no') return;
      var orden = Calculos.num(r[0]);
      out.push({
        orden: orden !== null ? orden : i + 1,
        icono: String(r[1]).trim(),
        categoria: String(r[2]).trim(),
        titulo: String(r[3]).trim(),
        resumen: String(r[4]).trim(),
        contenido: String(r[5])
      });
    });
  }
  out.sort(function (a, b) { return a.orden - b.orden; });
  return { tarjetas: out };
}

function accionListarCoaches_() {
  return { coaches: leerCoaches_().map(function (c) { return { correo: c.correo, nombre: c.nombre || c.correo }; }) };
}

function accionObtenerConfiguracion_() {
  var cfg = leerConfig_();
  return {
    config: {
      programa: cfg.programa, organizacion: cfg.organizacion, carpeta: cfg.carpeta, meta: cfg.meta, duracion: cfg.duracion,
      remitente: cfg.remitente, enlaceApp: cfg.enlaceApp
    },
    coaches: accionListarCoaches_().coaches
  };
}

function verificarCarpeta_(enlace) {
  var id = idDriveDeEnlace_(enlace);
  if (!id) falla_('El enlace de la carpeta no es válido. Pega el enlace de una carpeta de Google Drive.');
  try {
    var carpeta = DriveApp.getFolderById(id);
    return { id: id, nombre: carpeta.getName() };
  } catch (e) {
    falla_('No se encontró la carpeta o la cuenta propietaria del sistema no tiene acceso a ella.');
  }
  return null;
}

function accionVerificarCarpeta_(d) {
  var r = verificarCarpeta_(d.carpeta);
  return { ok: true, nombre: r.nombre };
}

function accionGuardarConfiguracion_(d) {
  var programa = limpiarTexto_(d.programa, 120);
  if (!programa) falla_('El nombre del programa es obligatorio.');
  var organizacion = limpiarTexto_(d.organizacion, 120);
  var remitente = limpiarTexto_(d.remitente, 80);
  var meta = Number(d.meta);
  if (!isFinite(meta) || meta < 1 || meta > 5 || Math.floor(meta) !== meta) falla_('La meta sugerida debe ser un número entero de 1 a 5.');
  var duracion = Number(d.duracion);
  if (!isFinite(duracion) || duracion < 1 || duracion > 60 || Math.floor(duracion) !== duracion) falla_('La duración por defecto debe ser un número entero de meses entre 1 y 60.');
  var carpeta = String(d.carpeta === null || d.carpeta === undefined ? '' : d.carpeta).trim();
  if (carpeta) verificarCarpeta_(carpeta);

  escribirConfig_('programa', programa);
  escribirConfig_('organizacion', organizacion);
  escribirConfig_('carpeta', carpeta);
  escribirConfig_('meta', meta);
  escribirConfig_('duracion', duracion);
  escribirConfig_('remitente', remitente);
  var enlace = String(d.enlaceApp === null || d.enlaceApp === undefined ? '' : d.enlaceApp).trim();
  if (enlace) {
    if (!/^https:\/\/[^\s]+$/.test(enlace) || enlace.length > 500) falla_('El enlace de la app debe empezar por https://');
    escribirConfig_('enlaceApp', enlace);
  }
  return accionObtenerConfiguracion_();
}

/* ============================================================================
 * Coachees
 * ========================================================================== */

function filaACoachee_(r, fila) {
  var c = COL_COACHEE;
  var dur = Calculos.num(r[c.duracion]);
  return {
    fila: fila,
    id: String(r[c.id]).trim(),
    nombre: String(r[c.nombre]).trim(),
    cargo: String(r[c.cargo]).trim(),
    correo: String(r[c.correo]).trim(),
    coach: normCorreo_(r[c.coach]),
    objetivo: String(r[c.objetivo]).trim(),
    duracion: dur !== null ? dur : '',
    inicio: fechaDeCelda_(r[c.inicio]),
    real: { LB: fechaDeCelda_(r[c.realLB]), M1: fechaDeCelda_(r[c.realM1]), M2: fechaDeCelda_(r[c.realM2]), MF: fechaDeCelda_(r[c.realMF]) },
    prog: { LB: fechaDeCelda_(r[c.progLB]), M1: fechaDeCelda_(r[c.progM1]), M2: fechaDeCelda_(r[c.progM2]), MF: fechaDeCelda_(r[c.progMF]) },
    estado: String(r[c.estado]).trim() || 'Activo',
    logros: String(r[c.logros]),
    aprendizajes: String(r[c.aprendizajes]),
    areas: String(r[c.areas]),
    recomendaciones: String(r[c.recomendaciones]),
    informe: String(r[c.informe]).trim()
  };
}

/** Todas las filas de Coachees con nombre. */
function leerCoachees_() {
  var h = hoja_('COACHEES');
  var n = h.getLastRow();
  if (n < 2) return [];
  var vals = h.getRange(2, 1, n - 1, N_COL_COACHEE).getValues();
  var out = [];
  vals.forEach(function (r, i) {
    if (!String(r[COL_COACHEE.nombre]).trim()) return;
    out.push(filaACoachee_(r, i + 2));
  });
  return out;
}

function buscarCoachee_(id) {
  var lista = leerCoachees_();
  for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
  return null;
}

function coacheeApi_(c, coaches) {
  return {
    id: c.id, nombre: c.nombre, cargo: c.cargo, correo: c.correo, coach: c.coach,
    coachNombre: c.coach ? (coaches[c.coach] || c.coach) : '',
    objetivo: c.objetivo, duracion: c.duracion, inicio: c.inicio, real: c.real, prog: c.prog, estado: c.estado,
    logros: c.logros, aprendizajes: c.aprendizajes, areas: c.areas, recomendaciones: c.recomendaciones, informe: c.informe
  };
}

function accionListarCoachees_() {
  asegurarSync_();
  var coaches = mapaCoaches_();
  return {
    coachees: leerCoachees_().filter(function (c) { return c.id; }).map(function (c) { return coacheeApi_(c, coaches); })
  };
}

function accionObtenerCoachee_(d) {
  var c = buscarCoachee_(validarId_(d.id));
  if (!c) falla_('No se encontró el coachee.');
  return { coachee: coacheeApi_(c, mapaCoaches_()) };
}

/** Valida y normaliza los datos del formulario de coachee. */
function validarDatosCoachee_(d, cfg) {
  var nombre = limpiarTexto_(d.nombre, 120);
  if (!nombre) falla_('El nombre del coachee es obligatorio.');
  var correo = limpiarTexto_(d.correo, 120).toLowerCase();
  if (correo && !EMAIL_RE_.test(correo)) falla_('El correo del coachee no es válido.');
  var coach = normCorreo_(d.coach);
  if (coach && !buscarCoach_(coach)) falla_('El coach seleccionado no existe en la hoja Coaches.');
  var estado = String(d.estado || 'Activo');
  if (ESTADOS.indexOf(estado) < 0) falla_('Estado inválido.');
  var duracion = d.duracion === '' || d.duracion === null || d.duracion === undefined ? cfg.duracion : Number(d.duracion);
  if (!isFinite(duracion) || duracion < 1 || duracion > 60) falla_('La duración debe estar entre 1 y 60 meses.');
  var inicio = validarFecha_(d.inicio, false);
  var prog = {};
  var calc = Calculos.fechasProgramadas(inicio, duracion);
  var enviadas = d.prog && typeof d.prog === 'object' ? d.prog : {};
  MOMENTOS_.forEach(function (m) {
    var f = validarFecha_(enviadas[m], false);
    prog[m] = f || calc[m] || '';
  });
  return {
    nombre: nombre, cargo: limpiarTexto_(d.cargo, 120), correo: correo, coach: coach,
    objetivo: limpiarTexto_(d.objetivo, 1000), duracion: duracion, inicio: inicio, estado: estado, prog: prog
  };
}

function accionGuardarCoachee_(d, ctx) {
  var cfg = leerConfig_();
  var v = validarDatosCoachee_(d, cfg);
  var h = hoja_('COACHEES');
  var C = COL_COACHEE;

  if (d.id) {
    var id = validarId_(d.id);
    var actual = buscarCoachee_(id);
    if (!actual) falla_('No se encontró el coachee.');
    var rango = h.getRange(actual.fila, 1, 1, N_COL_COACHEE);
    var fila = rango.getValues()[0];
    fila[C.nombre] = v.nombre; fila[C.cargo] = v.cargo; fila[C.correo] = v.correo; fila[C.coach] = v.coach;
    fila[C.objetivo] = v.objetivo; fila[C.duracion] = v.duracion; fila[C.inicio] = fechaACelda_(v.inicio);
    fila[C.estado] = v.estado;
    fila[C.progLB] = fechaACelda_(v.prog.LB); fila[C.progM1] = fechaACelda_(v.prog.M1);
    fila[C.progM2] = fechaACelda_(v.prog.M2); fila[C.progMF] = fechaACelda_(v.prog.MF);
    rango.setValues([fila]);
    if (actual.nombre !== v.nombre) actualizarNombreEval_(id, v.nombre);
    return { id: id, coachee: coacheeApi_(buscarCoachee_(id), mapaCoaches_()) };
  }

  var usados = {};
  leerCoachees_().forEach(function (c) { if (c.id) usados[c.id] = true; });
  var nuevoIdCoachee = nuevoId_(usados);
  var nueva = [];
  for (var i = 0; i < N_COL_COACHEE; i++) nueva.push('');
  nueva[C.id] = nuevoIdCoachee; nueva[C.nombre] = v.nombre; nueva[C.cargo] = v.cargo; nueva[C.correo] = v.correo;
  nueva[C.coach] = v.coach; nueva[C.objetivo] = v.objetivo; nueva[C.duracion] = v.duracion;
  nueva[C.inicio] = fechaACelda_(v.inicio); nueva[C.estado] = v.estado;
  nueva[C.progLB] = fechaACelda_(v.prog.LB); nueva[C.progM1] = fechaACelda_(v.prog.M1);
  nueva[C.progM2] = fechaACelda_(v.prog.M2); nueva[C.progMF] = fechaACelda_(v.prog.MF);
  var destino = Math.max(h.getLastRow(), 1) + 1;
  if (destino > h.getMaxRows()) h.insertRowsAfter(h.getMaxRows(), 20);
  h.getRange(destino, 1, 1, N_COL_COACHEE).setValues([nueva]);
  agregarFilasFaltantes_([{ id: nuevoIdCoachee, nombre: v.nombre }]);
  return { id: nuevoIdCoachee, coachee: coacheeApi_(buscarCoachee_(nuevoIdCoachee), mapaCoaches_()) };
}

function accionCerrarCoachee_(d) {
  var c = buscarCoachee_(validarId_(d.id));
  if (!c) falla_('No se encontró el coachee.');
  hoja_('COACHEES').getRange(c.fila, COL_COACHEE.estado + 1).setValue('Cerrado');
  return { ok: true };
}

function accionEliminarCoachee_(d) {
  var id = validarId_(d.id);
  var c = buscarCoachee_(id);
  if (!c) falla_('No se encontró el coachee.');
  eliminarFilasEval_(id);
  hoja_('COACHEES').deleteRow(c.fila);
  return { ok: true };
}

function accionGuardarTextosInforme_(d) {
  var c = buscarCoachee_(validarId_(d.id));
  if (!c) falla_('No se encontró el coachee.');
  var vals = [[
    limpiarTexto_(d.logros, 4000), limpiarTexto_(d.aprendizajes, 4000),
    limpiarTexto_(d.areas, 4000), limpiarTexto_(d.recomendaciones, 4000)
  ]];
  hoja_('COACHEES').getRange(c.fila, COL_COACHEE.logros + 1, 1, 4).setValues(vals);
  return { ok: true };
}

/* ============================================================================
 * Evaluación
 * ========================================================================== */

function ultimaFilaEval_(h) { return ultimaFilaCol_(h, 1); }

/** Todas las filas de Evaluación (A:R) como arreglos. */
function leerEvaluacionTodo_() {
  var h = hoja_('EVAL');
  var n = ultimaFilaEval_(h);
  if (n < 2) return { h: h, n: n, vals: [] };
  return { h: h, n: n, vals: h.getRange(2, 1, n - 1, N_COL_EVAL).getValues() };
}

function ordenIndicadores_(inds) {
  var o = {};
  inds.forEach(function (i, k) { o[i.codigo] = k; });
  return o;
}

/** Agrupa filas de Evaluación por ID de coachee, en el orden de los indicadores. */
function agruparEval_(vals, orden) {
  var por = {};
  vals.forEach(function (r) {
    var id = String(r[COL_EVAL.id]).trim();
    if (!id) return;
    (por[id] = por[id] || []).push(r);
  });
  Object.keys(por).forEach(function (id) {
    por[id].sort(function (a, b) {
      var oa = orden[String(a[COL_EVAL.codigo]).trim()], ob = orden[String(b[COL_EVAL.codigo]).trim()];
      return (oa === undefined ? 999 : oa) - (ob === undefined ? 999 : ob);
    });
  });
  return por;
}

function filaAnalisis_(r) {
  var E = COL_EVAL;
  return {
    codigo: String(r[E.codigo]).trim(), habilidad: String(r[E.habilidad]).trim(),
    lb: r[E.lb], m1: r[E.m1], m2: r[E.m2], mf: r[E.mf], meta: r[E.meta]
  };
}

function filaEvalApi_(r) {
  var E = COL_EVAL;
  return {
    codigo: String(r[E.codigo]).trim(),
    habilidad: String(r[E.habilidad]).trim(),
    indicador: String(r[E.indicador]).trim(),
    lb: Calculos.num(r[E.lb]), m1: Calculos.num(r[E.m1]), m2: Calculos.num(r[E.m2]), mf: Calculos.num(r[E.mf]),
    meta: Calculos.num(r[E.meta]),
    ev: { LB: String(r[E.evLB]), M1: String(r[E.evM1]), M2: String(r[E.evM2]), MF: String(r[E.evMF]) }
  };
}

/** Filas de Evaluación de un coachee (ordenadas) para análisis e informe. */
function evaluacionDeCoachee_(id) {
  var ev = leerEvaluacionTodo_();
  var por = agruparEval_(ev.vals, ordenIndicadores_(leerIndicadores_()));
  return por[id] || [];
}

/** Crea las filas faltantes (coachee × indicador) y actualiza los nombres. Requiere candado. */
function agregarFilasFaltantes_(coachees) {
  var inds = leerIndicadores_();
  var ev = leerEvaluacionTodo_();
  var h = ev.h;
  var existentes = {};
  var nombresPorId = {};
  coachees.forEach(function (c) { nombresPorId[c.id] = c.nombre; });

  var cambiosNombre = 0;
  var nombresCol = [];
  var hayNombres = false;
  ev.vals.forEach(function (r, i) {
    var id = String(r[COL_EVAL.id]).trim();
    existentes[id + '|' + String(r[COL_EVAL.codigo]).trim()] = true;
    var nom = nombresPorId[id];
    if (nom !== undefined && String(r[COL_EVAL.nombre]) !== nom) {
      cambiosNombre++;
      hayNombres = true;
      nombresCol.push([nom]);
    } else {
      nombresCol.push([r[COL_EVAL.nombre]]);
    }
  });
  if (hayNombres && ev.vals.length) h.getRange(2, COL_EVAL.nombre + 1, ev.vals.length, 1).setValues(nombresCol);

  var nuevas = [];
  var metas = [];
  coachees.forEach(function (c) {
    inds.forEach(function (ind) {
      if (existentes[c.id + '|' + ind.codigo]) return;
      nuevas.push([c.id, c.nombre, ind.codigo, ind.habilidad, ind.indicador]);
      metas.push([ind.meta]);
    });
  });
  if (nuevas.length) {
    var inicio = ev.n + 1;
    var fin = inicio + nuevas.length - 1;
    if (fin > h.getMaxRows()) h.insertRowsAfter(h.getMaxRows(), fin - h.getMaxRows() + 50);
    h.getRange(inicio, 1, nuevas.length, 5).setValues(nuevas);
    h.getRange(inicio, COL_EVAL.meta + 1, nuevas.length, 1).setValues(metas);
  }
  return { filasNuevas: nuevas.length, nombres: cambiosNombre };
}

function actualizarNombreEval_(id, nombre) {
  var ev = leerEvaluacionTodo_();
  if (!ev.vals.length) return;
  var col = ev.vals.map(function (r) { return [String(r[COL_EVAL.id]).trim() === id ? nombre : r[COL_EVAL.nombre]]; });
  ev.h.getRange(2, COL_EVAL.nombre + 1, col.length, 1).setValues(col);
}

function eliminarFilasEval_(id) {
  var ev = leerEvaluacionTodo_();
  var filas = [];
  ev.vals.forEach(function (r, i) { if (String(r[COL_EVAL.id]).trim() === id) filas.push(i + 2); });
  // Borra por tramos contiguos, de abajo hacia arriba.
  var fin = filas.length - 1;
  while (fin >= 0) {
    var ini = fin;
    while (ini > 0 && filas[ini - 1] === filas[ini] - 1) ini--;
    ev.h.deleteRows(filas[ini], fin - ini + 1);
    fin = ini - 1;
  }
}

function accionObtenerEvaluacion_(d) {
  var id = validarId_(d.id);
  var c = buscarCoachee_(id);
  if (!c) falla_('No se encontró el coachee.');
  var inds = leerIndicadores_();
  var filas = evaluacionDeCoachee_(id);
  if (filas.length < inds.length) {
    var candado = LockService.getScriptLock();
    candado.waitLock(30000);
    try {
      agregarFilasFaltantes_([{ id: id, nombre: c.nombre }]);
    } finally {
      candado.releaseLock();
    }
    filas = evaluacionDeCoachee_(id);
  }
  return { coachee: coacheeApi_(c, mapaCoaches_()), filas: filas.map(filaEvalApi_) };
}

function accionGuardarMedicion_(d, ctx) {
  var id = validarId_(d.id);
  var momento = String(d.momento || '');
  if (MOMENTOS_.indexOf(momento) < 0) falla_('Momento de medición inválido.');
  var fecha = validarFecha_(d.fecha, true);
  var meds = Array.isArray(d.mediciones) ? d.mediciones : [];
  if (meds.length > 200) falla_('Demasiados indicadores en la solicitud.');
  var c = buscarCoachee_(id);
  if (!c) falla_('No se encontró el coachee.');

  agregarFilasFaltantes_([{ id: id, nombre: c.nombre }]);
  var ev = leerEvaluacionTodo_();
  var h = ev.h;
  var vals = ev.vals;
  var E = COL_EVAL;
  var idx = {};
  vals.forEach(function (r, i) { if (String(r[E.id]).trim() === id) idx[String(r[E.codigo]).trim()] = i; });

  var colVal = { LB: E.lb, M1: E.m1, M2: E.m2, MF: E.mf }[momento];
  var colEv = { LB: E.evLB, M1: E.evM1, M2: E.evM2, MF: E.evMF }[momento];
  var calificados = 0;
  meds.forEach(function (m) {
    var i = idx[String(m.codigo)];
    if (i === undefined) return;
    var v = validarPuntaje_(m.valor);
    vals[i][colVal] = v === null ? '' : v;
    vals[i][colEv] = limpiarTexto_(m.evidencia, 1000);
    if (v !== null) calificados++;
  });
  if (!calificados) falla_('Califica al menos un indicador antes de guardar.');

  // Solo se escriben las columnas de datos (F:I y O:R); K:N son fórmulas.
  var bloqueValores = vals.map(function (r) { return [r[E.lb], r[E.m1], r[E.m2], r[E.mf]]; });
  var bloqueEvidencias = vals.map(function (r) { return [r[E.evLB], r[E.evM1], r[E.evM2], r[E.evMF]]; });
  h.getRange(2, E.lb + 1, vals.length, 4).setValues(bloqueValores);
  h.getRange(2, E.evLB + 1, vals.length, 4).setValues(bloqueEvidencias);

  // Fecha real del momento y, si no tenía coach, se asigna el actual.
  var hc = hoja_('COACHEES');
  var colReal = { LB: COL_COACHEE.realLB, M1: COL_COACHEE.realM1, M2: COL_COACHEE.realM2, MF: COL_COACHEE.realMF }[momento];
  hc.getRange(c.fila, colReal + 1).setValue(fechaACelda_(fecha));
  if (!c.coach) hc.getRange(c.fila, COL_COACHEE.coach + 1).setValue(ctx.correo);
  SpreadsheetApp.flush();
  return { ok: true, fecha: fecha, calificados: calificados };
}

function accionGuardarMeta_(d) {
  var id = validarId_(d.id);
  var codigo = String(d.codigo || '').trim();
  var meta = Number(d.meta);
  if (!isFinite(meta) || meta < 1 || meta > 5 || Math.floor(meta) !== meta) falla_('La meta debe ser un número entero de 1 a 5.');
  var ev = leerEvaluacionTodo_();
  for (var i = 0; i < ev.vals.length; i++) {
    var r = ev.vals[i];
    if (String(r[COL_EVAL.id]).trim() === id && String(r[COL_EVAL.codigo]).trim() === codigo) {
      ev.h.getRange(i + 2, COL_EVAL.meta + 1).setValue(meta);
      return { ok: true };
    }
  }
  falla_('No se encontró el indicador de ese coachee.');
  return null;
}

/* ============================================================================
 * Tablero
 * ========================================================================== */

function accionTablero_() {
  asegurarSync_();
  var escala = leerEscala_();
  var inds = leerIndicadores_();
  var coaches = mapaCoaches_();
  var ev = leerEvaluacionTodo_();
  var por = agruparEval_(ev.vals, ordenIndicadores_(inds));
  var hoy = hoyISO_();
  var lista = [];
  var proximas = [];

  leerCoachees_().forEach(function (c) {
    if (!c.id) return;
    var filas = (por[c.id] || []).map(filaAnalisis_);
    var a = Calculos.analizar(filas, escala);
    var g = a.global;
    var medido = g.actual !== null;
    lista.push({
      id: c.id, nombre: c.nombre, cargo: c.cargo, coach: c.coach,
      coachNombre: c.coach ? (coaches[c.coach] || c.coach) : '',
      estado: c.estado, real: c.real, prog: c.prog,
      lb: g.lb, actual: g.actual, indice: g.indice, avance: g.avance,
      enMeta: g.enMeta, total: g.total, nivel: g.nivel, nivelValor: g.nivelValor, medido: medido
    });
    if (c.estado === 'Activo') {
      MOMENTOS_.forEach(function (m) {
        if (c.real[m] || !c.prog[m]) return;
        var dias = Calculos.diasEntre(hoy, c.prog[m]);
        if (dias === null || dias > 30) return;
        proximas.push({
          id: c.id, nombre: c.nombre, coach: c.coach, momento: m, momentoNombre: Calculos.NOMBRE_MOMENTO[m],
          fecha: c.prog[m], dias: dias
        });
      });
    }
  });
  proximas.sort(function (a, b) { return a.dias - b.dias || (a.nombre < b.nombre ? -1 : 1); });
  lista.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  return { hoy: hoy, coachees: lista, proximas: proximas };
}

/* ============================================================================
 * Sincronización (menú y automática al listar)
 * ========================================================================== */

/**
 * Asigna ID, Estado "Activo", duración y fechas programadas a los coachees escritos a mano,
 * crea sus filas en Evaluación y mantiene los nombres al día. Requiere candado.
 */
function sincronizar_() {
  var cfg = leerConfig_();
  var h = hoja_('COACHEES');
  var n = h.getLastRow();
  var resumen = { coacheesNuevos: 0, fechasAsignadas: 0, filasEvaluacion: 0, nombresActualizados: 0 };
  var coachees = [];
  if (n >= 2) {
    var C = COL_COACHEE;
    var vals = h.getRange(2, 1, n - 1, N_COL_COACHEE).getValues();
    var usados = {};
    vals.forEach(function (r) { var id = String(r[C.id]).trim(); if (id) usados[id] = true; });
    var colId = [], colDur = [], colEstado = [], colProg = [];
    var cambioId = false, cambioDur = false, cambioEstado = false, cambioProg = false;
    vals.forEach(function (r) {
      var nombre = String(r[C.nombre]).trim();
      var id = String(r[C.id]).trim();
      var dur = r[C.duracion];
      var estado = r[C.estado];
      var prog = [r[C.progLB], r[C.progM1], r[C.progM2], r[C.progMF]];
      if (nombre) {
        if (!id) { id = nuevoId_(usados); cambioId = true; resumen.coacheesNuevos++; }
        if (String(estado).trim() === '') { estado = 'Activo'; cambioEstado = true; }
        if (Calculos.num(dur) === null) { dur = cfg.duracion; cambioDur = true; }
        var inicio = fechaDeCelda_(r[C.inicio]);
        if (inicio) {
          var calc = Calculos.fechasProgramadas(inicio, dur);
          ['LB', 'M1', 'M2', 'MF'].forEach(function (m, k) {
            if ((prog[k] === '' || prog[k] === null) && calc[m]) {
              prog[k] = fechaACelda_(calc[m]);
              cambioProg = true;
              resumen.fechasAsignadas++;
            }
          });
        }
        coachees.push({ id: id, nombre: nombre });
      }
      colId.push([id]); colDur.push([dur]); colEstado.push([estado]); colProg.push(prog);
    });
    if (cambioId) h.getRange(2, C.id + 1, vals.length, 1).setValues(colId);
    if (cambioDur) h.getRange(2, C.duracion + 1, vals.length, 1).setValues(colDur);
    if (cambioEstado) h.getRange(2, C.estado + 1, vals.length, 1).setValues(colEstado);
    if (cambioProg) h.getRange(2, C.progLB + 1, vals.length, 4).setValues(colProg);
  }
  var r = agregarFilasFaltantes_(coachees);
  resumen.filasEvaluacion = r.filasNuevas;
  resumen.nombresActualizados = r.nombres;
  SpreadsheetApp.flush();
  return resumen;
}

/** Si hay coachees escritos a mano sin ID, sincroniza antes de listar. */
function asegurarSync_() {
  var h = hoja_('COACHEES');
  var n = h.getLastRow();
  if (n < 2) return;
  var vals = h.getRange(2, 1, n - 1, 2).getValues();
  var pendiente = false;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][1]).trim() && !String(vals[i][0]).trim()) { pendiente = true; break; }
  }
  if (!pendiente) return;
  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    sincronizar_();
  } finally {
    candado.releaseLock();
  }
}
