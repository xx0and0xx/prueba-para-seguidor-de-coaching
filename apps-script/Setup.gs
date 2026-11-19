/**
 * Setup.gs — Menú personalizado, inicialización de las hojas (estilos, fórmulas,
 * validaciones y protección de advertencia) y utilidades del menú.
 *
 * inicializar() es idempotente: se puede ejecutar de nuevo para reaplicar estilos
 * y fórmulas; solo carga datos por defecto en las hojas que están vacías.
 */

/* ============================================================================
 * Menú y disparadores simples
 * ========================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎯 Coaching')
    .addItem('Inicializar / aplicar estilos', 'inicializar')
    .addItem('Sincronizar coachees y tablero', 'sincronizar')
    .addSeparator()
    .addItem('Generar informe PDF (coachee del Tablero)', 'menuGenerarInforme')
    .addItem('Enviar informe por correo', 'menuEnviarInforme')
    .addSeparator()
    .addItem('Ver enlace de la app', 'menuVerEnlace')
    .addToUi();
}

/** Al salir de la celda de contraseña (hoja Coaches) se cifra de inmediato. */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var hoja = e.range.getSheet();
    if (hoja.getName() !== HOJAS.COACHES) return;
    if (e.range.getColumn() > 3 || e.range.getLastColumn() < 3) return;
    cifrarClavesPlanas_();
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
  }
}

function avisar_(mensaje) {
  try {
    SpreadsheetApp.getUi().alert(mensaje);
  } catch (e) {
    console.log(mensaje);
  }
}

function mensajeError_(err) {
  return err && err.app ? err.message : 'Error inesperado: ' + (err && err.message ? err.message : String(err));
}

/* ============================================================================
 * Acciones del menú
 * ========================================================================== */

function sincronizar() {
  var candado = LockService.getScriptLock();
  try {
    candado.waitLock(30000);
  } catch (e) {
    avisar_('El sistema está ocupado. Intenta de nuevo en unos segundos.');
    return;
  }
  var r;
  try {
    r = sincronizar_();
  } catch (err) {
    avisar_(mensajeError_(err));
    return;
  } finally {
    candado.releaseLock();
  }
  avisar_('Sincronización lista\n\n' +
    '• Coachees nuevos con ID asignado: ' + r.coacheesNuevos + '\n' +
    '• Fechas programadas asignadas: ' + r.fechasAsignadas + '\n' +
    '• Filas creadas en Evaluación: ' + r.filasEvaluacion + '\n' +
    '• Nombres actualizados en Evaluación: ' + r.nombresActualizados);
}

function idCoacheeTablero_() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJAS.TABLERO);
  if (!hoja) return '';
  return String(hoja.getRange('H3').getValue() || '').trim();
}

function menuGenerarInforme() {
  var id = idCoacheeTablero_();
  if (!id) { avisar_('Elige un coachee en la celda C3 del Tablero.'); return; }
  try {
    var r = generarYGuardarInforme_(id);
    avisar_('Informe generado y guardado en Drive:\n\n' + r.nombre + '\n\n' + r.url);
  } catch (err) {
    avisar_(mensajeError_(err));
  }
}

function menuEnviarInforme() {
  var id = idCoacheeTablero_();
  if (!id) { avisar_('Elige un coachee en la celda C3 del Tablero.'); return; }
  var ui = SpreadsheetApp.getUi();
  try {
    var c = buscarCoachee_(id);
    if (!c) { avisar_('No se encontró el coachee.'); return; }
    var p1 = ui.prompt('Enviar informe por correo',
      'Correo del destinatario' + (c.correo ? ' (correo del coachee: ' + c.correo + ')' : '') + ':', ui.ButtonSet.OK_CANCEL);
    if (p1.getSelectedButton() !== ui.Button.OK) return;
    var destino = String(p1.getResponseText()).trim().toLowerCase() || c.correo;
    var p2 = ui.prompt('Mensaje (opcional)', 'Texto que acompañará al informe:', ui.ButtonSet.OK_CANCEL);
    if (p2.getSelectedButton() !== ui.Button.OK) return;
    var regenerar = ui.alert('¿Regenerar el PDF con los datos actuales?',
      'Sí: genera un PDF nuevo antes de enviar.\nNo: usa el último informe guardado (si existe).', ui.ButtonSet.YES_NO) === ui.Button.YES;
    var r = enviarInformeCorreo_(id, destino, String(p2.getResponseText()).trim(), regenerar, '');
    avisar_('Informe enviado a ' + r.destinatario + '.');
  } catch (err) {
    avisar_(mensajeError_(err));
  }
}

function menuVerEnlace() {
  try {
    var cfg = leerConfig_();
    avisar_(cfg.enlaceApp ? 'Enlace de la app:\n\n' + cfg.enlaceApp
      : 'Aún no hay enlace de la app. Guárdalo en la hoja Configuración (fila "Enlace de la app") o desde ⚙️ Configuración en la app.');
  } catch (err) {
    avisar_(mensajeError_(err));
  }
}

/* ============================================================================
 * Inicialización
 * ========================================================================== */

function inicializar() {
  sal_(); // crea la sal secreta (una sola vez) antes de tomar el candado
  var candado = LockService.getScriptLock();
  try {
    candado.waitLock(30000);
  } catch (e) {
    avisar_('El sistema está ocupado. Intenta de nuevo en unos segundos.');
    return;
  }
  try {
    iniConfig_();
    iniCoaches_();
    iniCoachees_();
    iniEvaluacion_();
    iniIndicadores_();
    iniEscala_();
    iniFundamentacion_();
    iniTablero_();
    ordenarHojas_();
    SpreadsheetApp.flush();
  } finally {
    candado.releaseLock();
  }
  avisar_('✅ Hojas inicializadas.\n\n' +
    'Siguientes pasos:\n' +
    '1. En la hoja Coaches escribe tu correo, nombre y una contraseña inicial.\n' +
    '2. En Configuración pega el enlace de la carpeta de Drive para los informes.\n' +
    '3. Despliega el Apps Script como aplicación web y copia la URL en docs/config.js.');
}

/* ---------- ayudas de estilo ---------- */

function obtenerOCrear_(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(nombre) || ss.insertSheet(nombre);
}

function escribirEncabezado_(hoja, encabezados) {
  var r = hoja.getRange(1, 1, 1, encabezados.length);
  r.setValues([encabezados]);
  r.setBackground(MARCA.azul).setFontColor('#ffffff').setFontWeight('bold').setFontFamily('Nunito')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  hoja.setRowHeight(1, 40);
  hoja.setFrozenRows(1);
}

function anchos_(hoja, lista) {
  lista.forEach(function (w, i) { hoja.setColumnWidth(i + 1, w); });
}

function formatoColumna_(hoja, col, formato, desdeFila) {
  var inicio = desdeFila || 2;
  var n = hoja.getMaxRows() - inicio + 1;
  if (n > 0) hoja.getRange(inicio, col, n, 1).setNumberFormat(formato);
}

function fuenteCuerpo_(hoja, ancho) {
  var n = hoja.getMaxRows() - 1;
  if (n > 0) hoja.getRange(2, 1, n, ancho).setFontFamily('Nunito').setVerticalAlignment('middle');
}

function quitarProtecciones_(hoja) {
  hoja.getProtections(SpreadsheetApp.ProtectionType.RANGE).concat(hoja.getProtections(SpreadsheetApp.ProtectionType.SHEET))
    .forEach(function (p) {
      if (String(p.getDescription()).indexOf('🎯') === 0) p.remove();
    });
}

function reglasEstado_(rango) {
  function regla(texto, fondo, color) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(texto).setBackground(fondo).setFontColor(color).setRanges([rango]).build();
  }
  return [
    regla('Meta lograda', MARCA.verdeClaro, MARCA.verde),
    regla('En camino', MARCA.ambarClaro, MARCA.ambar),
    regla('Prioridad', MARCA.rosaClaro, MARCA.rosa)
  ];
}

function reglasNivel_(rango) {
  var out = [];
  for (var v = 1; v <= 5; v++) {
    out.push(SpreadsheetApp.newConditionalFormatRule().whenNumberEqualTo(v)
      .setBackground(COLOR_NIVEL[v][0]).setFontColor(COLOR_NIVEL[v][1]).setRanges([rango]).build());
  }
  return out;
}

/* ---------- Configuración ---------- */

function iniConfig_() {
  var h = obtenerOCrear_(HOJAS.CONFIG);
  escribirEncabezado_(h, ENC.CONFIG);
  var n = h.getLastRow();
  var existentes = {};
  if (n >= 2) {
    h.getRange(2, 1, n - 1, 1).getValues().forEach(function (r) {
      var k = claveDeEtiqueta_(r[0]);
      if (k) existentes[k] = true;
    });
  }
  CONFIG_DEF.forEach(function (d) {
    if (existentes[d.k]) return;
    var fila = Math.max(h.getLastRow(), 1) + 1;
    h.getRange(fila, 1, 1, 2).setValues([[d.etiqueta, d.def]]);
  });
  anchos_(h, [360, 520]);
  var ultima = Math.max(h.getLastRow(), 2);
  h.getRange(2, 1, ultima - 1, 1).setFontWeight('bold').setBackground(MARCA.azulPalido).setFontColor(MARCA.azul);
  h.getRange(2, 1, ultima - 1, 2).setFontFamily('Nunito').setVerticalAlignment('middle').setWrap(true)
    .setBorder(true, true, true, true, true, true, MARCA.borde, SpreadsheetApp.BorderStyle.SOLID);
  h.getRange(2, 2, ultima - 1, 1).setHorizontalAlignment('left');
  h.setTabColor(MARCA.azulMedio);
}

/* ---------- Coaches ---------- */

function iniCoaches_() {
  var h = obtenerOCrear_(HOJAS.COACHES);
  escribirEncabezado_(h, ENC.COACHES);
  anchos_(h, [280, 240, 420]);
  formatoColumna_(h, 1, '@'); formatoColumna_(h, 2, '@'); formatoColumna_(h, 3, '@');
  fuenteCuerpo_(h, 3);
  h.getRange('C1').setNote('Escribe una contraseña inicial y sal de la celda: se reemplaza por 🔒 + hash SHA-256. Si la cambias aquí, las sesiones de ese coach dejan de valer.');
  h.getRange('A1').setNote('Un coach por fila. Con este correo y su contraseña ingresa a la app.');
  h.setTabColor(MARCA.azulMedio);
}

/* ---------- Coachees ---------- */

function iniCoachees_() {
  var h = obtenerOCrear_(HOJAS.COACHEES);
  escribirEncabezado_(h, ENC.COACHEES);
  anchos_(h, [120, 190, 160, 200, 210, 260, 90, 105, 105, 105, 105, 105, 95, 260, 260, 260, 260, 220, 110, 110, 110, 110]);
  var C = COL_COACHEE;
  [C.id, C.nombre, C.cargo, C.correo, C.coach, C.objetivo, C.logros, C.aprendizajes, C.areas, C.recomendaciones, C.informe]
    .forEach(function (i) { formatoColumna_(h, i + 1, '@'); });
  [C.inicio, C.realLB, C.realM1, C.realM2, C.realMF, C.progLB, C.progM1, C.progM2, C.progMF]
    .forEach(function (i) { formatoColumna_(h, i + 1, 'yyyy-mm-dd'); });
  formatoColumna_(h, C.duracion + 1, '0');
  fuenteCuerpo_(h, N_COL_COACHEE);
  var filas = h.getMaxRows() - 1;
  h.getRange(2, C.estado + 1, filas, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build());
  h.getRange(2, C.coach + 1, filas, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(obtenerOCrear_(HOJAS.COACHES).getRange('A2:A'), true).setAllowInvalid(true).build());
  h.getRange(2, C.duracion + 1, filas, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberBetween(1, 60).setAllowInvalid(false).build());
  h.getRange(2, C.objetivo + 1, filas, 1).setWrap(true);
  h.getRange(2, C.logros + 1, filas, 4).setWrap(true);
  h.getRange(1, C.realLB + 1, 1, 4).setBackground(MARCA.azulMedio);
  h.getRange(1, C.progLB + 1, 1, 4).setBackground(MARCA.azulMedio);
  h.setFrozenColumns(2);
  h.getRange('A1').setNote('El ID (CO-xxxxxxxx) se asigna solo al sincronizar. No lo cambies.');
  h.getRange(1, C.realLB + 1).setNote('Las fechas reales las escribe la app al registrar cada medición.');
  h.setTabColor(MARCA.azulMedio);
}

/* ---------- Evaluación ---------- */

function iniEvaluacion_() {
  var h = obtenerOCrear_(HOJAS.EVAL);
  var E = COL_EVAL;
  escribirEncabezado_(h, ENC.EVAL);
  anchos_(h, [120, 180, 70, 160, 380, 85, 85, 85, 90, 70, 95, 90, 90, 115, 240, 240, 240, 240]);
  [E.id, E.nombre, E.codigo, E.habilidad, E.indicador, E.evLB, E.evM1, E.evM2, E.evMF]
    .forEach(function (i) { formatoColumna_(h, i + 1, '@'); });
  fuenteCuerpo_(h, N_COL_EVAL);
  var filas = h.getMaxRows() - 1;

  // Columnas calculadas: fórmulas ARRAYFORMULA en el encabezado (K1:N1).
  if (!h.getRange(1, E.actual + 1).getFormula()) {
    try { h.getRange(2, E.actual + 1, filas, 4).clearContent(); } catch (e) { /* nada que limpiar */ }
  }
  var F = "'Evaluación'!";
  h.getRange(1, E.actual + 1).setFormula(
    '={"' + ENC.EVAL[E.actual] + '";ARRAYFORMULA(IF(A2:A="","",IF(I2:I<>"",I2:I,IF(H2:H<>"",H2:H,IF(G2:G<>"",G2:G,IF(F2:F<>"",F2:F,""))))))}');
  h.getRange(1, E.variacion + 1).setFormula(
    '={"' + ENC.EVAL[E.variacion] + '";ARRAYFORMULA(IF(A2:A="","",IF((K2:K="")+(F2:F="")>0,"",K2:K-F2:F)))}');
  h.getRange(1, E.avance + 1).setFormula(
    '={"' + ENC.EVAL[E.avance] + '";ARRAYFORMULA(IF(A2:A="","",IF(K2:K="","",IF(K2:K>=J2:J,1,IF(F2:F="","",IF(J2:J<=F2:F,0,' +
    '((K2:K-F2:F)/(J2:J-F2:F+(J2:J<=F2:F)))*((K2:K-F2:F)>0)))))))}');
  h.getRange(1, E.estado + 1).setFormula(
    '={"' + ENC.EVAL[E.estado] + '";ARRAYFORMULA(IF(A2:A="","",IF(K2:K="","",IF(K2:K>=J2:J,"Meta lograda",IF(M2:M="","Prioridad",IF(M2:M>=0.5,"En camino","Prioridad"))))))}');

  var calc = h.getRange(1, E.actual + 1, h.getMaxRows(), 4);
  calc.setBackground(MARCA.azulFondo).setFontStyle('italic');
  h.getRange(1, E.actual + 1, 1, 4).setBackground(MARCA.azulMedio).setFontColor('#ffffff').setFontWeight('bold');
  formatoColumna_(h, E.actual + 1, '0.0');
  formatoColumna_(h, E.variacion + 1, '+0.0;-0.0;0.0');
  formatoColumna_(h, E.avance + 1, '0%');
  h.getRange(2, E.lb + 1, filas, 5).setNumberFormat('0').setHorizontalAlignment('center');
  h.getRange(2, E.actual + 1, filas, 4).setHorizontalAlignment('center');
  h.getRange(2, E.lb + 1, filas, 5).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberBetween(1, 5).setAllowInvalid(false).setHelpText('Escribe un valor de 1 a 5.').build());
  h.getRange(2, E.evLB + 1, filas, 4).setWrap(true);

  // Protección solo de advertencia en las columnas calculadas.
  quitarProtecciones_(h);
  var prot = h.getRange(1, E.actual + 1, h.getMaxRows(), 4).protect();
  prot.setDescription('🎯 Columnas calculadas (se llenan solas)').setWarningOnly(true);

  var reglas = [];
  reglas = reglas.concat(reglasEstado_(h.getRange(2, E.estado + 1, filas, 1)));
  reglas = reglas.concat(reglasNivel_(h.getRange(2, E.lb + 1, filas, 4)));
  reglas = reglas.concat(reglasNivel_(h.getRange(2, E.actual + 1, filas, 1)));
  h.setConditionalFormatRules(reglas);
  h.getRange(1, E.lb + 1).setNote('Valores de 1 a 5. Las columnas en cursiva con fondo celeste son fórmulas: no las escribas.');
  h.setTabColor(MARCA.azulMedio);
}

/* ---------- Indicadores ---------- */

function filaConfigDe_(k) {
  var h = obtenerOCrear_(HOJAS.CONFIG);
  var n = h.getLastRow();
  if (n < 2) return 0;
  var vals = h.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (claveDeEtiqueta_(vals[i][0]) === k) return i + 2;
  return 0;
}

function iniIndicadores_() {
  var h = obtenerOCrear_(HOJAS.IND);
  escribirEncabezado_(h, ENC.IND);
  if (h.getLastRow() < 2) {
    var filaMeta = filaConfigDe_('meta');
    var formulaMeta = filaMeta ? "='" + HOJAS.CONFIG + "'!$B$" + filaMeta : 4;
    var inds = indicadoresDefecto_();
    var vals = inds.map(function (r, i) { return [r[0], r[1], r[2], formulaMeta, i + 1]; });
    h.getRange(2, 1, vals.length, 5).setValues(vals);
  }
  anchos_(h, [80, 190, 560, 70, 70]);
  fuenteCuerpo_(h, 5);
  h.getRange(2, 3, h.getMaxRows() - 1, 1).setWrap(true);
  h.getRange(2, 1, h.getMaxRows() - 1, 1).setHorizontalAlignment('center').setFontWeight('bold');
  h.getRange(2, 4, h.getMaxRows() - 1, 2).setHorizontalAlignment('center');
  h.getRange('D1').setNote('Por defecto toma la meta sugerida de Configuración. Puedes escribir otro valor (1 a 5) para un indicador. Solo afecta a coachees nuevos.');
  h.setTabColor(MARCA.azulMedio);
}

/* ---------- Escala ---------- */

function iniEscala_() {
  var h = obtenerOCrear_(HOJAS.ESCALA);
  escribirEncabezado_(h, ENC.ESCALA);
  if (h.getLastRow() < 2) {
    h.getRange(2, 1, 5, 3).setValues(Calculos.ESCALA_DEFECTO.map(function (e) { return [e.valor, e.nivel, e.descripcion]; }));
  }
  anchos_(h, [70, 170, 620]);
  fuenteCuerpo_(h, 3);
  h.getRange(2, 3, h.getMaxRows() - 1, 1).setWrap(true);
  for (var v = 1; v <= 5; v++) {
    h.getRange(v + 1, 1, 1, 2).setBackground(COLOR_NIVEL[v][0]).setFontColor(COLOR_NIVEL[v][1]).setFontWeight('bold');
  }
  h.getRange(2, 1, 5, 1).setHorizontalAlignment('center');
  h.setTabColor(MARCA.azulMedio);
}

/* ---------- Fundamentación teórica ---------- */

function iniFundamentacion_() {
  var h = obtenerOCrear_(HOJAS.FUND);
  escribirEncabezado_(h, ENC.FUND);
  [2, 3, 4, 5, 6].forEach(function (c) { formatoColumna_(h, c, '@'); });
  if (h.getLastRow() < 2) {
    var filas = fundamentacionDefecto_();
    h.getRange(2, 1, filas.length, 7).setValues(filas);
  }
  anchos_(h, [70, 70, 130, 240, 380, 640, 100]);
  fuenteCuerpo_(h, 7);
  h.getRange(2, 4, h.getMaxRows() - 1, 3).setWrap(true);
  h.getRange(2, 1, h.getMaxRows() - 1, 2).setHorizontalAlignment('center');
  h.getRange(2, 7, h.getMaxRows() - 1, 1).setHorizontalAlignment('center').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Sí', 'No'], true).setAllowInvalid(false).build());
  h.getRange('F1').setNote('Formato por línea: ## Subtítulo · 1. Paso · > Frase destacada (recuadro azul) · ! Atención (recuadro ámbar) · - Viñeta · otra línea = párrafo.');
  h.setTabColor(MARCA.azulMedio);
}

/* ---------- Tablero ---------- */

function iniTablero_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = obtenerOCrear_(HOJAS.TABLERO);
  var ID = '$H$3';
  var Ev = "'" + HOJAS.EVAL + "'!";
  var evA = Ev + '$A$2:$A';
  var col = function (letra) { return Ev + '$' + letra + '$2:$' + letra; };
  var busca = function (letra) { return 'INDEX(Coachees!$' + letra + '$2:$' + letra + ',MATCH(' + ID + ',Coachees!$A$2:$A,0))'; };
  var buscaTxt = function (letra) { return '=IF(' + ID + '="","",IFERROR(' + busca(letra) + ',""))'; };
  var buscaFecha = function (letra) { return '=IF(' + ID + '="","",IFERROR(IF(' + busca(letra) + '="","",' + busca(letra) + '),""))'; };

  h.clear();
  h.clearConditionalFormatRules();
  try { h.getRange(1, 1, h.getMaxRows(), h.getMaxColumns()).breakApart(); } catch (e) { /* sin celdas combinadas */ }
  if (h.getMaxColumns() < 14) h.insertColumnsAfter(h.getMaxColumns(), 14 - h.getMaxColumns());
  if (h.getMaxRows() < 120) h.insertRowsAfter(h.getMaxRows(), 120 - h.getMaxRows());
  h.setHiddenGridlines(true);
  h.getRange(1, 1, h.getMaxRows(), 14).setFontFamily('Nunito').setFontSize(10).setVerticalAlignment('middle');
  [24, 200, 95, 95, 95, 95, 95, 95, 95, 95, 95, 130, 130, 80].forEach(function (w, i) { h.setColumnWidth(i + 1, w); });

  var seccion = function (fila, texto) {
    var r = h.getRange(fila, 2, 1, 12);
    r.merge();
    h.getRange(fila, 2).setValue(texto);
    r.setFontWeight('bold').setFontSize(12).setFontColor(MARCA.azul)
      .setBorder(null, null, true, null, null, null, MARCA.azulMedio, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  };
  var encTabla = function (rango) {
    rango.setBackground(MARCA.azul).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);
  };
  var etiqueta = function (rango, texto) {
    rango.setValue(texto).setFontWeight('bold').setFontColor(MARCA.azul).setBackground(MARCA.azulPalido);
  };
  var calculada = function (rango) { rango.setBackground(MARCA.azulFondo).setFontColor(MARCA.azulOscuro); };

  // Título
  h.getRange('B1:M1').merge();
  h.getRange('B1').setValue('🎯 Tablero de avance en coaching ejecutivo');
  h.getRange('B1:M1').setFontSize(18).setFontWeight('bold').setFontColor('#ffffff').setBackground(MARCA.azul)
    .setHorizontalAlignment('left');
  h.setRowHeight(1, 44);

  // Selector
  etiqueta(h.getRange('B3'), '👤 Coachee (elige aquí)');
  h.getRange('C3:E3').merge().setBackground('#ffffff').setFontWeight('bold').setFontSize(11)
    .setBorder(true, true, true, true, null, null, MARCA.azulMedio, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  h.getRange('C3').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(obtenerOCrear_(HOJAS.COACHEES).getRange('B2:B'), true)
      .setAllowInvalid(false).setHelpText('Elige un coachee de la lista.').build());
  etiqueta(h.getRange('G3'), '🆔 ID');
  h.getRange('H3').setFormula('=IFERROR(INDEX(Coachees!$A$2:$A,MATCH($C$3,Coachees!$B$2:$B,0)),"")');
  calculada(h.getRange('H3'));

  // Datos del coachee
  var datos = [
    ['💼 Cargo', buscaTxt('C')],
    ['✉️ Correo', buscaTxt('D')],
    ['🎓 Coach',
      '=IF(' + ID + '="","",IFERROR(VLOOKUP(' + busca('E') + ',Coaches!$A$2:$B,2,FALSE),IFERROR(' + busca('E') + ',"")))'],
    ['🎯 Objetivo', buscaTxt('F')],
    ['📌 Estado', buscaTxt('M')],
    ['📅 Inicio', buscaFecha('H')],
    ['⏳ Duración (meses)', buscaTxt('G')],
    ['📄 Informe (último PDF)', buscaTxt('R')]
  ];
  datos.forEach(function (d, i) {
    var fila = 5 + i;
    etiqueta(h.getRange(fila, 2), d[0]);
    var v = h.getRange(fila, 3, 1, 6);
    v.merge();
    h.getRange(fila, 3).setFormula(d[1]);
    calculada(v);
    v.setHorizontalAlignment('left').setWrap(true);
  });
  h.getRange('C10').setNumberFormat('yyyy-mm-dd');
  h.setRowHeight(8, 36);

  // Fechas programadas vs. reales
  seccion(14, '🗓️ Fechas de medición: programada vs. real');
  ['Momento', 'Programada', 'Real'].forEach(function (t, i) { h.getRange(15, 2 + i).setValue(t); });
  h.getRange('E15:F15').merge();
  h.getRange('E15').setValue('Situación');
  encTabla(h.getRange('B15:F15'));
  var momentos = [['Línea base (LB)', 'S', 'I'], ['Medición 1 (M1)', 'T', 'J'], ['Medición 2 (M2)', 'U', 'K'], ['Medición final (MF)', 'V', 'L']];
  momentos.forEach(function (m, i) {
    var f = 16 + i;
    h.getRange(f, 2).setValue(m[0]).setFontWeight('bold').setBackground(MARCA.azulPalido).setFontColor(MARCA.azul);
    h.getRange(f, 3).setFormula(buscaFecha(m[1]));
    h.getRange(f, 4).setFormula(buscaFecha(m[2]));
    h.getRange(f, 5, 1, 2).merge();
    h.getRange(f, 5).setFormula('=IF(' + ID + '="","",IF(D' + f + '<>"","✅ Realizada",IF(C' + f + '="","—",IF(C' + f + '<TODAY(),"⚠️ Atrasada","⏳ Pendiente"))))');
    calculada(h.getRange(f, 3, 1, 4));
  });
  h.getRange('C16:D19').setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center');
  h.getRange('E16:F19').setHorizontalAlignment('center');

  // Resumen por habilidad
  seccion(21, '🧩 Resumen por habilidad');
  var enc = ['Habilidad', 'Línea base', 'Medición 1', 'Medición 2', 'Medición final', 'Meta', 'Actual', 'Variación', 'Índice', '% avance', 'Estado', 'Nivel', 'Brecha'];
  h.getRange(22, 2, 1, enc.length).setValues([enc]);
  encTabla(h.getRange(22, 2, 1, enc.length));
  var prom = function (letra, fila, conHab) {
    return '=IF(OR(' + ID + '=""' + (conHab ? ',$B' + fila + '=""' : '') + '),"",IFERROR(AVERAGEIFS(' + col(letra) + ',' + evA + ',' + ID +
      (conHab ? ',' + col('D') + ',$B' + fila : '') + '),""))';
  };
  for (var fila = 23; fila <= 29; fila++) {
    var global = fila === 29;
    h.getRange(fila, 2).setFormula(global ? '="🌐 Global"' :
      '=IFERROR(INDEX(UNIQUE(FILTER(Indicadores!$B$2:$B,Indicadores!$B$2:$B<>"")),ROWS($B$23:B' + fila + ')),"")');
    var conHab = !global;
    h.getRange(fila, 3).setFormula(prom('F', fila, conHab));
    h.getRange(fila, 4).setFormula(prom('G', fila, conHab));
    h.getRange(fila, 5).setFormula(prom('H', fila, conHab));
    h.getRange(fila, 6).setFormula(prom('I', fila, conHab));
    h.getRange(fila, 7).setFormula(prom('J', fila, conHab));
    h.getRange(fila, 8).setFormula(prom('K', fila, conHab));
    h.getRange(fila, 9).setFormula('=IF(OR(H' + fila + '="",C' + fila + '=""),"",H' + fila + '-C' + fila + ')');
    h.getRange(fila, 10).setFormula('=IF(H' + fila + '="","",H' + fila + '/5)');
    h.getRange(fila, 11).setFormula(prom('M', fila, conHab));
    h.getRange(fila, 12).setFormula('=IF(H' + fila + '="","",IF(H' + fila + '>=G' + fila + ',"Meta lograda",IF(K' + fila + '="","Prioridad",IF(K' + fila + '>=0.5,"En camino","Prioridad"))))');
    h.getRange(fila, 13).setFormula('=IF(H' + fila + '="","",IFERROR(INDEX(Escala!$B$2:$B$6,MATCH(MAX(1,MIN(5,INT(H' + fila + '))),Escala!$A$2:$A$6,0)),""))');
    h.getRange(fila, 14).setFormula('=IF(OR(G' + fila + '="",H' + fila + '=""),"",G' + fila + '-H' + fila + ')');
  }
  calculada(h.getRange('B23:N29'));
  h.getRange('B23:N29').setBorder(true, true, true, true, true, true, MARCA.borde, SpreadsheetApp.BorderStyle.SOLID);
  h.getRange('C23:H29').setNumberFormat('0.0');
  h.getRange('I23:I29').setNumberFormat('+0.0;-0.0;0.0');
  h.getRange('J23:K29').setNumberFormat('0%');
  h.getRange('N23:N29').setNumberFormat('0.0');
  h.getRange('C23:N29').setHorizontalAlignment('center');
  h.getRange('B29:N29').setFontWeight('bold').setBackground(MARCA.azulPalido);

  // Indicadores clave
  seccion(31, '⭐ Indicadores clave');
  var claves = [
    ['📍 Índice línea base (promedio / 5)', '=C29', '0.0'],
    ['📍 Índice actual (promedio / 5)', '=H29', '0.0'],
    ['📈 Variación del índice', '=I29', '+0.0;-0.0;0.0'],
    ['🏁 Avance a la meta', '=K29', '0%'],
    ['✅ Indicadores en meta', '=IF(' + ID + '="","",COUNTIFS(' + evA + ',' + ID + ',' + col('N') + ',"Meta lograda")&"/"&COUNTIFS(' + evA + ',' + ID + '))', '@'],
    ['🏷️ Nivel global', '=M29', '@'],
    ['🚀 Habilidad de mayor crecimiento', '=IFERROR(INDEX($B$23:$B$28,MATCH(MAX($I$23:$I$28),$I$23:$I$28,0)),"")', '@'],
    ['💪 Habilidad más fuerte', '=IFERROR(INDEX($B$23:$B$28,MATCH(MAX($H$23:$H$28),$H$23:$H$28,0)),"")', '@'],
    ['🌱 Mayor oportunidad', '=IFERROR(INDEX($B$23:$B$28,MATCH(MAX($N$23:$N$28),$N$23:$N$28,0)),"")', '@'],
    ['📊 Índice de desarrollo (promedio ÷ 5)', '=J29', '0%']
  ];
  claves.forEach(function (c, i) {
    var f = 32 + i;
    etiqueta(h.getRange(f, 2), c[0]);
    var v = h.getRange(f, 3, 1, 3);
    v.merge();
    h.getRange(f, 3).setFormula(c[1]);
    if (c[2] !== '@') v.setNumberFormat(c[2]);
    calculada(v);
    v.setHorizontalAlignment('left').setFontWeight('bold');
  });

  // Detalle por indicador (FILTER)
  seccion(43, '📋 Detalle por indicador');
  var encDet = ['Indicador', 'Código', 'Línea base', 'Medición 1', 'Medición 2', 'Medición final', 'Meta', 'Actual', 'Variación', '% avance', 'Estado', 'Habilidad'];
  h.getRange(44, 2, 1, encDet.length).setValues([encDet]);
  encTabla(h.getRange(44, 2, 1, encDet.length));
  var arreglo = ['E', 'C', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'D'].map(function (l) { return col(l); }).join(',');
  h.getRange('B45').setFormula('=IF(' + ID + '="","",IFERROR(FILTER({' + arreglo + '},' + evA + '=' + ID + '),""))');
  var det = h.getRange(45, 2, 75, 12);
  det.setBackground(MARCA.azulFondo).setFontColor(MARCA.azulOscuro).setVerticalAlignment('middle');
  h.getRange(45, 2, 75, 1).setWrap(true);
  h.getRange(45, 3, 75, 11).setHorizontalAlignment('center');
  h.getRange(45, 4, 75, 5).setNumberFormat('0');
  h.getRange(45, 9, 75, 1).setNumberFormat('0.0');
  h.getRange(45, 10, 75, 1).setNumberFormat('+0;-0;0');
  h.getRange(45, 11, 75, 1).setNumberFormat('0%');

  // Colores condicionales
  var reglas = [];
  reglas = reglas.concat(reglasEstado_(h.getRange('L23:L29')));
  reglas = reglas.concat(reglasEstado_(h.getRange('L45:L120')));
  reglas = reglas.concat(reglasNivel_(h.getRange('D45:G120')));
  h.setConditionalFormatRules(reglas);

  // Protección solo de advertencia (todo menos el selector)
  quitarProtecciones_(h);
  var p = h.protect();
  p.setDescription('🎯 Tablero (se calcula solo; elige el coachee en C3)').setWarningOnly(true);
  try { p.setUnprotectedRanges([h.getRange('C3:E3')]); } catch (e) { /* no crítico */ }

  h.setFrozenRows(0);
  h.setTabColor(MARCA.verde);
}

function ordenarHojas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var orden = [HOJAS.CONFIG, HOJAS.COACHES, HOJAS.COACHEES, HOJAS.EVAL, HOJAS.IND, HOJAS.ESCALA, HOJAS.FUND, HOJAS.TABLERO];
  orden.forEach(function (nombre, i) {
    var s = ss.getSheetByName(nombre);
    if (!s) return;
    ss.setActiveSheet(s);
    ss.moveActiveSheet(i + 1);
  });
  // Elimina la hoja vacía que Google crea por defecto, si quedó sin usar.
  ss.getSheets().forEach(function (s) {
    if (orden.indexOf(s.getName()) < 0 && s.getLastRow() === 0 && s.getLastColumn() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(s);
    }
  });
  ss.setActiveSheet(ss.getSheetByName(HOJAS.TABLERO));
}
