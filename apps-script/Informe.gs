/**
 * Informe.gs — Informe final en PDF y envío por correo.
 *
 * HTML con la marca (Training Skills) → PDF con HtmlService (getAs('application/pdf')),
 * dos páginas: (1) encabezado, datos, indicadores clave, tabla por habilidad, hallazgos
 * y textos; (2) detalle de los indicadores coloreado por nivel.
 * Se guarda en la carpeta de Drive de Configuración como
 * Informe_Coaching_<Nombre>_<aaaa-mm-dd>.pdf y su enlace queda en la columna Informe.
 */

/* ---------- utilidades ---------- */

function escHtml_(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Texto con saltos de línea → HTML escapado con <br>. */
function textoHtml_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  return s ? escHtml_(s).replace(/\n/g, '<br>') : '<span style="color:#61605f">Sin registrar.</span>';
}

function fechaLarga_(iso) {
  var p = Calculos.parseISO(iso);
  return p ? ('0' + p.d).slice(-2) + '/' + ('0' + p.m).slice(-2) + '/' + p.y : '—';
}

function nombreArchivo_(nombre) {
  return String(nombre).replace(/[\\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '_') || 'Coachee';
}

function carpetaInformes_() {
  var cfg = leerConfig_();
  if (!cfg.carpeta) falla_('Configura primero la carpeta de informes (en ⚙️ Configuración o en la hoja Configuración).');
  var id = idDriveDeEnlace_(cfg.carpeta);
  if (!id) falla_('El enlace de la carpeta de informes no es válido.');
  try {
    return DriveApp.getFolderById(id);
  } catch (e) {
    falla_('No se pudo abrir la carpeta de informes. Verifica el enlace y que la cuenta propietaria del sistema tenga acceso.');
  }
  return null;
}

/* ---------- datos ---------- */

function datosInforme_(id) {
  var c = buscarCoachee_(id);
  if (!c) falla_('No se encontró el coachee.');
  var filasHoja = evaluacionDeCoachee_(id);
  if (!filasHoja.length) falla_('El coachee todavía no tiene evaluación. Registra una medición primero.');
  var escala = leerEscala_();
  var a = Calculos.analizar(filasHoja.map(filaAnalisis_), escala);
  if (a.global.actual === null) falla_('Registra al menos una medición antes de generar el informe.');
  return {
    c: c, cfg: leerConfig_(), escala: escala, a: a,
    filas: filasHoja.map(filaEvalApi_), coaches: mapaCoaches_()
  };
}

/* ---------- HTML ---------- */

function cssInforme_() {
  return [
    'body{font-family:Nunito,Candara,Calibri,Arial,sans-serif;color:#1e1f35;font-size:11px;line-height:1.35;margin:0;}',
    'h2{font-family:Candara,Nunito,Calibri,Arial,sans-serif;color:#16375c;font-size:13px;margin:12px 0 5px;border-bottom:2px solid #3189ba;padding-bottom:2px;}',
    'table{border-collapse:collapse;width:100%;}',
    'td,th{padding:4px 6px;vertical-align:middle;}',
    '.cab{background:#16375c;color:#ffffff;}',
    '.cab td{padding:10px 12px;}',
    '.dato td{border-bottom:1px solid #cddce8;}',
    '.dato .k{color:#61605f;width:15%;}',
    '.tarjeta{background:#e8f2f9;border:1px solid #cddce8;text-align:center;padding:6px 4px;}',
    '.tarjeta .n{font-size:17px;font-weight:bold;color:#16375c;}',
    '.tarjeta .t{font-size:9px;color:#61605f;}',
    '.tab th{background:#16375c;color:#ffffff;font-size:9.5px;text-align:center;}',
    '.tab td{border-bottom:1px solid #cddce8;text-align:center;font-size:10.5px;}',
    '.tab td.l{text-align:left;}',
    '.chip{display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:bold;white-space:nowrap;}',
    '.caja{border:1px solid #cddce8;background:#ffffff;padding:6px 8px;margin-bottom:6px;}',
    '.caja b{color:#16375c;}',
    '.pie{color:#61605f;font-size:9px;text-align:center;margin-top:10px;}',
    '.salto{page-break-before:always;}'
  ].join('');
}

function chipEstado_(estado) {
  var col = { 'Meta lograda': ['#dcfce7', '#16a34a'], 'En camino': ['#fef3c7', '#d97706'], 'Prioridad': ['#fdeaea', '#c0464a'] }[estado];
  if (!col) return '<span style="color:#61605f">—</span>';
  return '<span class="chip" style="background:' + col[0] + ';color:' + col[1] + ';">' + escHtml_(estado) + '</span>';
}

function chipNivelNum_(v) {
  v = Calculos.num(v);
  if (v === null) return '<span style="color:#61605f">—</span>';
  var col = COLOR_NIVEL[Calculos.nivelValor(v)] || COLOR_NIVEL[3];
  return '<span class="chip" style="background:' + col[0] + ';color:' + col[1] + ';">' + Calculos.fmt(v, Math.floor(v) === v ? 0 : 1) + '</span>';
}

function chipNivelNombre_(promedio, nombre) {
  var v = Calculos.nivelValor(promedio);
  if (v === null || !nombre) return '<span style="color:#61605f">—</span>';
  var col = COLOR_NIVEL[v];
  return '<span class="chip" style="background:' + col[0] + ';color:' + col[1] + ';">' + escHtml_(nombre) + '</span>';
}

function barraHtml_(p) {
  p = Calculos.num(p);
  var w = p === null ? 0 : Math.max(0, Math.min(100, Math.round(p * 100)));
  return '<table style="width:100%;"><tr><td style="padding:0;width:70%;">' +
    '<div style="background:#dceef8;height:8px;border-radius:4px;"><div style="background:#3189ba;height:8px;border-radius:4px;width:' + w + '%;"></div></div>' +
    '</td><td style="padding:0 0 0 4px;font-size:10px;">' + Calculos.fmtPct(p) + '</td></tr></table>';
}

function encabezadoInforme_(dt, subtitulo) {
  var cfg = dt.cfg;
  return '<table class="cab"><tr>' +
    '<td><div style="font-size:9px;letter-spacing:1px;">' + escHtml_(cfg.organizacion).toUpperCase() + '</div>' +
    '<div style="font-size:17px;font-family:Candara,Nunito,Calibri,Arial,sans-serif;font-weight:bold;">' + escHtml_(cfg.programa) + '</div>' +
    '<div style="font-size:11px;">' + escHtml_(subtitulo) + '</div></td>' +
    '<td style="text-align:right;width:28%;font-size:10px;">' + escHtml_(dt.c.nombre) + '<br>' + fechaLarga_(hoyISO_()) + '</td>' +
    '</tr></table>';
}

function habilidadPorNombre_(a, nombre) {
  for (var i = 0; i < a.habilidades.length; i++) if (a.habilidades[i].habilidad === nombre) return a.habilidades[i];
  return null;
}

function hallazgosInforme_(dt) {
  var C = Calculos, k = dt.a.clave, out = [];
  out.push('El índice global pasó de <b>' + C.fmt(k.indiceLB) + '</b> a <b>' + C.fmt(k.indiceActual) + '</b> sobre 5 (' +
    C.fmtVar(k.variacionIndice) + '), con nivel global «' + escHtml_(k.nivel) + '».');
  out.push('Alcanzó la meta en <b>' + k.enMeta + ' de ' + k.total + '</b> indicadores; el avance promedio hacia la meta es <b>' + C.fmtPct(k.avance) + '</b>.');
  var hc = habilidadPorNombre_(dt.a, k.mayorCrecimiento);
  if (hc) out.push('Mayor crecimiento: <b>' + escHtml_(hc.habilidad) + '</b> (' + C.fmtVar(hc.variacion) + ' puntos).');
  var hf = habilidadPorNombre_(dt.a, k.masFuerte);
  if (hf) out.push('Habilidad más fuerte: <b>' + escHtml_(hf.habilidad) + '</b> (' + C.fmt(hf.actual) + ').');
  var ho = habilidadPorNombre_(dt.a, k.mayorOportunidad);
  if (ho && ho.brecha !== null && ho.brecha > 0) out.push('Mayor oportunidad: <b>' + escHtml_(ho.habilidad) + '</b> (a ' + C.fmt(ho.brecha) + ' puntos de la meta).');
  var prioridad = [];
  dt.a.indicadores.forEach(function (i) { if (i.estado === 'Prioridad') prioridad.push(i.codigo); });
  if (prioridad.length) out.push('Indicadores en prioridad: ' + escHtml_(prioridad.join(', ')) + '.');
  return '<ul style="margin:2px 0 0 16px;padding:0;">' + out.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
}

function htmlInforme_(dt) {
  var C = Calculos, c = dt.c, a = dt.a, k = a.clave, g = a.global;
  var h = [];
  h.push('<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + cssInforme_() + '</style></head><body>');

  // ----- Página 1 -----
  h.push(encabezadoInforme_(dt, 'Informe final de avance'));

  h.push('<h2>Datos del coachee</h2><table class="dato">');
  h.push('<tr><td class="k">Nombre</td><td><b>' + escHtml_(c.nombre) + '</b></td><td class="k">Cargo</td><td>' + escHtml_(c.cargo || '—') + '</td></tr>');
  h.push('<tr><td class="k">Coach</td><td>' + escHtml_(c.coach ? (dt.coaches[c.coach] || c.coach) : '—') + '</td><td class="k">Estado</td><td>' + escHtml_(c.estado) + '</td></tr>');
  h.push('<tr><td class="k">Inicio</td><td>' + fechaLarga_(c.inicio) + '</td><td class="k">Duración</td><td>' + (c.duracion !== '' ? escHtml_(c.duracion) + ' meses' : '—') + '</td></tr>');
  h.push('<tr><td class="k">Objetivo</td><td colspan="3">' + escHtml_(c.objetivo || '—') + '</td></tr>');
  var fechas = ['LB', 'M1', 'M2', 'MF'].map(function (m) {
    return C.NOMBRE_MOMENTO[m] + ': ' + (c.real[m] ? fechaLarga_(c.real[m]) : 'pendiente');
  });
  h.push('<tr><td class="k">Mediciones</td><td colspan="3">' + escHtml_(fechas.join('  ·  ')) + '</td></tr></table>');

  h.push('<h2>Indicadores clave</h2><table><tr>');
  var tarjetas = [
    [C.fmt(k.indiceLB) + ' → ' + C.fmt(k.indiceActual), 'Índice (línea base → actual)'],
    [C.fmtVar(k.variacionIndice), 'Variación del índice'],
    [C.fmtPct(k.avance), 'Avance a la meta'],
    [k.enMeta + '/' + k.total, 'Indicadores en meta'],
    [k.nivel || '—', 'Nivel global']
  ];
  tarjetas.forEach(function (t) {
    h.push('<td class="tarjeta" style="width:20%;"><div class="n">' + escHtml_(t[0]) + '</div><div class="t">' + escHtml_(t[1]) + '</div></td>');
  });
  h.push('</tr></table>');

  h.push('<h2>Resultados por habilidad</h2><table class="tab"><tr>' +
    '<th style="text-align:left;">Habilidad</th><th>LB</th><th>M1</th><th>M2</th><th>MF</th><th>Meta</th><th>Actual</th><th>Var.</th>' +
    '<th style="width:20%;">% avance</th><th>Estado</th><th>Nivel</th></tr>');
  a.habilidades.concat([{ habilidad: 'Global', lb: g.lb, m1: g.m1, m2: g.m2, mf: g.mf, meta: g.meta, actual: g.actual, variacion: g.variacion, avance: g.avance, estado: g.estado, nivel: g.nivel, nivelValor: g.nivelValor, global: true }])
    .forEach(function (x) {
      h.push('<tr' + (x.global ? ' style="background:#e8f2f9;font-weight:bold;"' : '') + '><td class="l">' + escHtml_(x.habilidad) + '</td>' +
        '<td>' + C.fmt(x.lb) + '</td><td>' + C.fmt(x.m1) + '</td><td>' + C.fmt(x.m2) + '</td><td>' + C.fmt(x.mf) + '</td>' +
        '<td>' + C.fmt(x.meta) + '</td><td><b>' + C.fmt(x.actual) + '</b></td><td>' + C.fmtVar(x.variacion) + '</td>' +
        '<td>' + barraHtml_(x.avance) + '</td><td>' + chipEstado_(x.estado) + '</td><td>' + chipNivelNombre_(x.actual, x.nivel) + '</td></tr>');
    });
  h.push('</table>');

  h.push('<h2>Hallazgos</h2>' + hallazgosInforme_(dt));

  h.push('<h2>Análisis del proceso</h2>');
  h.push('<table><tr><td style="width:50%;vertical-align:top;padding:0 3px 0 0;"><div class="caja"><b>Logros</b><br>' + textoHtml_(c.logros) + '</div>' +
    '<div class="caja"><b>Áreas a fortalecer</b><br>' + textoHtml_(c.areas) + '</div></td>' +
    '<td style="width:50%;vertical-align:top;padding:0 0 0 3px;"><div class="caja"><b>Aprendizajes</b><br>' + textoHtml_(c.aprendizajes) + '</div>' +
    '<div class="caja"><b>Recomendaciones</b><br>' + textoHtml_(c.recomendaciones) + '</div></td></tr></table>');

  // ----- Página 2 -----
  h.push('<div class="salto"></div>');
  h.push(encabezadoInforme_(dt, 'Detalle por indicador'));
  h.push('<h2>' + a.indicadores.length + ' indicadores conductuales</h2>');
  h.push('<table class="tab"><tr><th style="text-align:left;">Habilidad</th><th>Cód.</th><th style="text-align:left;">Indicador</th>' +
    '<th>LB</th><th>M1</th><th>M2</th><th>MF</th><th>Meta</th><th>Estado</th></tr>');
  var previa = null;
  dt.filas.forEach(function (f, i) {
    var calc = a.indicadores[i];
    var nuevaHab = f.habilidad !== previa;
    previa = f.habilidad;
    h.push('<tr' + (nuevaHab ? ' style="border-top:2px solid #3189ba;"' : '') + '><td class="l" style="font-weight:bold;color:#16375c;">' + (nuevaHab ? escHtml_(f.habilidad) : '') + '</td>' +
      '<td>' + escHtml_(f.codigo) + '</td><td class="l" style="font-size:9.5px;">' + escHtml_(f.indicador) + '</td>' +
      '<td>' + chipNivelNum_(f.lb) + '</td><td>' + chipNivelNum_(f.m1) + '</td><td>' + chipNivelNum_(f.m2) + '</td><td>' + chipNivelNum_(f.mf) + '</td>' +
      '<td>' + C.fmt(f.meta, 0) + '</td><td>' + chipEstado_(calc.estado) + '</td></tr>');
  });
  h.push('</table>');

  h.push('<h2>Escala de calificación</h2><table><tr>');
  dt.escala.forEach(function (e) {
    var col = COLOR_NIVEL[e.valor] || COLOR_NIVEL[3];
    h.push('<td style="width:20%;vertical-align:top;padding:2px;"><div class="chip" style="background:' + col[0] + ';color:' + col[1] + ';">' + e.valor + ' · ' + escHtml_(e.nivel) + '</div>' +
      '<div style="font-size:9px;color:#61605f;margin-top:2px;">' + escHtml_(e.descripcion) + '</div></td>');
  });
  h.push('</tr></table>');
  h.push('<div class="pie">' + escHtml_(dt.cfg.programa) + ' · ' + escHtml_(dt.cfg.organizacion) + ' · Generado el ' + fechaLarga_(hoyISO_()) + '</div>');
  h.push('</body></html>');
  return h.join('');
}

/* ---------- PDF ---------- */

function generarYGuardarInforme_(id) {
  var carpeta = carpetaInformes_();
  var dt = datosInforme_(id);
  var nombre = 'Informe_Coaching_' + nombreArchivo_(dt.c.nombre) + '_' + hoyISO_() + '.pdf';
  var blob = HtmlService.createHtmlOutput(htmlInforme_(dt)).getBlob().getAs('application/pdf').setName(nombre);
  var archivo = carpeta.createFile(blob);
  var url = archivo.getUrl();

  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    var c = buscarCoachee_(id);
    if (c) hoja_('COACHEES').getRange(c.fila, COL_COACHEE.informe + 1).setValue(url);
  } finally {
    candado.releaseLock();
  }
  return { url: url, nombre: nombre, archivoId: archivo.getId(), blob: blob };
}

function accionVistaPreviaInforme_(d) {
  return { html: htmlInforme_(datosInforme_(validarId_(d.id))) };
}

function accionGenerarInforme_(d) {
  var r = generarYGuardarInforme_(validarId_(d.id));
  return { url: r.url, nombre: r.nombre };
}

/* ---------- Correo ---------- */

function cuerpoCorreoHtml_(dt, mensaje) {
  var C = Calculos, k = dt.a.clave;
  var msg = String(mensaje || '').trim();
  return '<div style="font-family:Nunito,Calibri,Arial,sans-serif;color:#1e1f35;max-width:560px;">' +
    '<div style="background:#16375c;color:#ffffff;padding:14px 18px;border-radius:8px 8px 0 0;">' +
    '<div style="font-size:11px;letter-spacing:1px;">' + escHtml_(dt.cfg.organizacion).toUpperCase() + '</div>' +
    '<div style="font-size:18px;font-weight:bold;">' + escHtml_(dt.cfg.programa) + '</div></div>' +
    '<div style="border:1px solid #cddce8;border-top:0;padding:16px 18px;border-radius:0 0 8px 8px;">' +
    '<p>Hola,</p>' +
    (msg ? '<p>' + escHtml_(msg).replace(/\n/g, '<br>') + '</p>' : '') +
    '<p>Adjuntamos el informe final de avance en coaching de <b>' + escHtml_(dt.c.nombre) + '</b>.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:10px 0;"><tr>' +
    '<td style="background:#e8f2f9;padding:10px;text-align:center;border-radius:6px;"><div style="font-size:18px;font-weight:bold;color:#16375c;">' + C.fmt(k.indiceLB) + ' → ' + C.fmt(k.indiceActual) + '</div><div style="font-size:11px;color:#61605f;">Índice global</div></td>' +
    '<td style="width:8px;"></td>' +
    '<td style="background:#e8f2f9;padding:10px;text-align:center;border-radius:6px;"><div style="font-size:18px;font-weight:bold;color:#16375c;">' + k.enMeta + '/' + k.total + '</div><div style="font-size:11px;color:#61605f;">Indicadores en meta</div></td>' +
    '<td style="width:8px;"></td>' +
    '<td style="background:#e8f2f9;padding:10px;text-align:center;border-radius:6px;"><div style="font-size:18px;font-weight:bold;color:#16375c;">' + C.fmtPct(k.avance) + '</div><div style="font-size:11px;color:#61605f;">Avance a la meta</div></td>' +
    '</tr></table>' +
    '<p style="color:#61605f;font-size:12px;">Cordialmente,<br>' + escHtml_(dt.cfg.remitente || dt.cfg.organizacion) + '</p></div></div>';
}

function enviarInformeCorreo_(id, destinatario, mensaje, regenerar, responderA) {
  if (!destinatario || !EMAIL_RE_.test(destinatario) || /[,;\s]/.test(destinatario)) falla_('Escribe un correo de destinatario válido (uno solo).');
  var c = buscarCoachee_(id);
  if (!c) falla_('No se encontró el coachee.');
  var dt = datosInforme_(id);
  var blob = null;
  var nombre = '';
  var url = c.informe;

  var idArchivo = idDriveDeEnlace_(c.informe);
  if (!regenerar && idArchivo) {
    try {
      var f = DriveApp.getFileById(idArchivo);
      if (!f.isTrashed()) { blob = f.getBlob(); nombre = f.getName(); }
    } catch (e) {
      blob = null;
    }
  }
  if (!blob) {
    var r = generarYGuardarInforme_(id);
    blob = r.blob; nombre = r.nombre; url = r.url;
  }

  var opciones = {
    to: destinatario,
    subject: 'Informe final de avance en coaching — ' + c.nombre,
    htmlBody: cuerpoCorreoHtml_(dt, mensaje),
    body: 'Adjuntamos el informe final de avance en coaching de ' + c.nombre + '.',
    name: dt.cfg.remitente || dt.cfg.organizacion || 'Training Skills',
    attachments: [blob.setName(nombre || blob.getName())]
  };
  if (responderA) opciones.replyTo = responderA;
  MailApp.sendEmail(opciones);
  return { ok: true, destinatario: destinatario, url: url };
}

function accionEnviarInforme_(d, ctx) {
  var destinatario = String(d.destinatario === null || d.destinatario === undefined ? '' : d.destinatario).trim().toLowerCase();
  var mensaje = String(d.mensaje === null || d.mensaje === undefined ? '' : d.mensaje).trim().substring(0, 2000);
  return enviarInformeCorreo_(validarId_(d.id), destinatario, mensaje, !!d.regenerar, ctx.correo);
}
