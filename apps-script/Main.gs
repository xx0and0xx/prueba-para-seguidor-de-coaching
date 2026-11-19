/**
 * Main.gs — Punto de entrada de la API JSON.
 *
 * El frontend llama con:
 *   fetch(API_URL, { method: 'POST', body: JSON.stringify({ token, accion, datos }),
 *                    headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
 * (text/plain evita la verificación previa de CORS).
 *
 * Respuestas: { ok: true, data } | { ok: false, error }
 * Una única función de entrada (doPost) valida el token y solo ejecuta
 * acciones de la lista blanca definida en acciones_().
 */

/** Lanza un error cuyo mensaje es seguro de mostrar al usuario. */
function falla_(mensaje) {
  var e = new Error(mensaje);
  e.app = true;
  throw e;
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return responder_({ ok: true, data: 'API de Avance en Coaching Ejecutivo activa.' });
}

function doPost(e) {
  var resp;
  try {
    var cuerpo = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (cuerpo.length > 300000) falla_('La solicitud es demasiado grande.');
    var req;
    try { req = JSON.parse(cuerpo); } catch (x) { falla_('Solicitud inválida.'); }
    resp = { ok: true, data: despachar_(req) };
  } catch (err) {
    if (err && err.app) {
      resp = { ok: false, error: err.message };
    } else {
      console.error(err && err.stack ? err.stack : String(err));
      resp = { ok: false, error: 'Ocurrió un error inesperado. Intenta de nuevo.' };
    }
  }
  return responder_(resp);
}

/**
 * Lista blanca de acciones. Se construye dentro de una función para no depender
 * del orden de carga de los archivos.
 *   publica: no requiere token (solo login y configPublica).
 *   escribe: se ejecuta bajo candado para evitar escrituras simultáneas.
 */
function acciones_() {
  return {
    // Sesión
    login:                 { publica: true, fn: accionLogin_ },
    configPublica:         { publica: true, fn: accionConfigPublica_ },
    sesion:                { fn: accionSesion_ },
    logout:                { fn: accionLogout_ },
    cambiarClave:          { fn: accionCambiarClave_ },
    // Catálogos
    catalogos:             { fn: accionCatalogos_ },
    fundamentacion:        { fn: accionFundamentacion_ },
    // Tablero
    tablero:               { fn: accionTablero_ },
    // Coachees
    listarCoachees:        { fn: accionListarCoachees_ },
    obtenerCoachee:        { fn: accionObtenerCoachee_ },
    guardarCoachee:        { fn: accionGuardarCoachee_, escribe: true },
    cerrarCoachee:         { fn: accionCerrarCoachee_, escribe: true },
    eliminarCoachee:       { fn: accionEliminarCoachee_, escribe: true },
    // Evaluación
    obtenerEvaluacion:     { fn: accionObtenerEvaluacion_ },
    guardarMedicion:       { fn: accionGuardarMedicion_, escribe: true },
    guardarMeta:           { fn: accionGuardarMeta_, escribe: true },
    guardarTextosInforme:  { fn: accionGuardarTextosInforme_, escribe: true },
    // Informe
    vistaPreviaInforme:    { fn: accionVistaPreviaInforme_ },
    generarInforme:        { fn: accionGenerarInforme_ },
    enviarInforme:         { fn: accionEnviarInforme_ },
    // Configuración
    obtenerConfiguracion:  { fn: accionObtenerConfiguracion_ },
    guardarConfiguracion:  { fn: accionGuardarConfiguracion_, escribe: true },
    verificarCarpeta:      { fn: accionVerificarCarpeta_ },
    listarCoaches:         { fn: accionListarCoaches_ }
  };
}

function despachar_(req) {
  if (!req || typeof req !== 'object') falla_('Solicitud inválida.');
  var accion = typeof req.accion === 'string' ? req.accion : '';
  var tabla = acciones_();
  if (!Object.prototype.hasOwnProperty.call(tabla, accion)) falla_('Acción no permitida.');
  var def = tabla[accion];
  var datos = req.datos && typeof req.datos === 'object' ? req.datos : {};

  var ctx = null;
  if (!def.publica) ctx = validarToken_(req.token);

  if (!def.escribe) return def.fn(datos, ctx);

  var candado = LockService.getScriptLock();
  try {
    candado.waitLock(30000);
  } catch (x) {
    falla_('El sistema está ocupado. Intenta de nuevo en unos segundos.');
  }
  try {
    return def.fn(datos, ctx);
  } finally {
    candado.releaseLock();
  }
}
