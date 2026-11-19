/**
 * Auth.gs — Contraseñas, sesiones y control de acceso.
 *
 * - Las contraseñas de la hoja Coaches se guardan como "🔒 " + SHA-256(sal + contraseña).
 *   La sal se genera una vez y vive en Script Properties (clave SAL).
 * - Al ingresar, se crea un token aleatorio; en Script Properties solo se guarda su hash
 *   con el correo, el vencimiento (365 días) y la huella de la contraseña vigente.
 * - Si el administrador cambia la contraseña en la hoja o borra al coach, la huella ya no
 *   coincide y sus sesiones dejan de valer.
 * - Tras 5 intentos fallidos con el mismo correo hay un bloqueo de 15 minutos (CacheService).
 */

var PREFIJO_CLAVE_ = '🔒 ';
var PREFIJO_SESION_ = 'S_';
var DIAS_SESION_ = 365;
var MAX_INTENTOS_ = 5;
var SEGUNDOS_BLOQUEO_ = 15 * 60;
var MIN_LARGO_CLAVE_ = 6;
var MAX_LARGO_CLAVE_ = 200;

/* ---------- utilidades criptográficas ---------- */

function sha256Hex_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

/** Sal secreta: se genera una sola vez. */
function sal_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('SAL');
  if (s) return s;
  var candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    s = props.getProperty('SAL');
    if (!s) {
      s = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
      props.setProperty('SAL', s);
    }
  } finally {
    candado.releaseLock();
  }
  return s;
}

function hashClave_(clave) {
  return PREFIJO_CLAVE_ + sha256Hex_(sal_() + String(clave));
}

function esClaveCifrada_(valor) {
  return String(valor).indexOf(PREFIJO_CLAVE_.trim()) === 0;
}

/** Huella de la contraseña vigente: cambia si cambia el hash guardado en la hoja. */
function huella_(claveGuardada) {
  return sha256Hex_(sal_() + '|huella|' + claveGuardada).substring(0, 24);
}

function hashCorto_(texto) {
  return sha256Hex_('cache|' + texto).substring(0, 24);
}

function normCorreo_(v) {
  return String(v === null || v === undefined ? '' : v).trim().toLowerCase();
}

/* ---------- hoja Coaches ---------- */

/**
 * Cifra cualquier contraseña en texto plano de la hoja Coaches.
 * La llama onEdit (al salir de la celda) y cada lectura de coaches.
 */
function cifrarClavesPlanas_() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJAS.COACHES);
  if (!hoja) return;
  var n = hoja.getLastRow();
  if (n < 2) return;
  var rango = hoja.getRange(2, 3, n - 1, 1);
  var vals = rango.getValues();
  var cambio = false;
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i][0];
    if (v === '' || v === null) continue;
    if (!esClaveCifrada_(v)) {
      vals[i][0] = hashClave_(String(v));
      cambio = true;
    }
  }
  if (cambio) rango.setValues(vals);
}

/** Devuelve [{ fila, correo, nombre, clave }] con las claves ya cifradas. */
function leerCoaches_() {
  cifrarClavesPlanas_();
  var hoja = hoja_('COACHES');
  var n = hoja.getLastRow();
  if (n < 2) return [];
  var vals = hoja.getRange(2, 1, n - 1, 3).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var correo = normCorreo_(vals[i][0]);
    if (!correo) continue;
    out.push({ fila: i + 2, correo: correo, nombre: String(vals[i][1] || '').trim(), clave: String(vals[i][2] || '').trim() });
  }
  return out;
}

function buscarCoach_(correo) {
  correo = normCorreo_(correo);
  if (!correo) return null;
  var lista = leerCoaches_();
  for (var i = 0; i < lista.length; i++) if (lista[i].correo === correo) return lista[i];
  return null;
}

/* ---------- sesiones ---------- */

function crearSesion_(coach) {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var registro = { e: coach.correo, x: Date.now() + DIAS_SESION_ * 86400000, f: huella_(coach.clave) };
  PropertiesService.getScriptProperties().setProperty(PREFIJO_SESION_ + sha256Hex_(token), JSON.stringify(registro));
  limpiarSesionesVencidas_();
  return token;
}

function limpiarSesionesVencidas_() {
  var props = PropertiesService.getScriptProperties();
  var todo = props.getProperties();
  var ahora = Date.now();
  for (var k in todo) {
    if (k.indexOf(PREFIJO_SESION_) !== 0) continue;
    try {
      var r = JSON.parse(todo[k]);
      if (!r || r.x < ahora) props.deleteProperty(k);
    } catch (e) {
      props.deleteProperty(k);
    }
  }
}

/** Valida el token de sesión y devuelve { correo, nombre, th } o lanza SESION_INVALIDA. */
function validarToken_(token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 200) falla_('SESION_INVALIDA');
  var th = sha256Hex_(token);
  var props = PropertiesService.getScriptProperties();
  var bruto = props.getProperty(PREFIJO_SESION_ + th);
  if (!bruto) falla_('SESION_INVALIDA');
  var r;
  try { r = JSON.parse(bruto); } catch (e) { falla_('SESION_INVALIDA'); }
  if (!r || r.x < Date.now()) {
    props.deleteProperty(PREFIJO_SESION_ + th);
    falla_('SESION_INVALIDA');
  }
  var coach = buscarCoach_(r.e);
  if (!coach || !coach.clave || huella_(coach.clave) !== r.f) {
    props.deleteProperty(PREFIJO_SESION_ + th);
    falla_('SESION_INVALIDA');
  }
  return { correo: coach.correo, nombre: coach.nombre || coach.correo, th: th };
}

/* ---------- acciones ---------- */

function accionLogin_(d) {
  var correo = normCorreo_(d.correo);
  var clave = String(d.clave === null || d.clave === undefined ? '' : d.clave);
  if (!correo || !clave) falla_('Ingresa tu correo y tu contraseña.');
  if (clave.length > MAX_LARGO_CLAVE_) falla_('Correo o contraseña incorrectos.');

  var cache = CacheService.getScriptCache();
  var kBloqueo = 'bloq_' + hashCorto_(correo);
  var kIntentos = 'int_' + hashCorto_(correo);
  var msgBloqueo = 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.';
  if (cache.get(kBloqueo)) falla_(msgBloqueo);

  var coach = buscarCoach_(correo);
  var ok = !!(coach && coach.clave && coach.clave === hashClave_(clave));
  if (!ok) {
    var n = Number(cache.get(kIntentos) || 0) + 1;
    if (n >= MAX_INTENTOS_) {
      cache.put(kBloqueo, '1', SEGUNDOS_BLOQUEO_);
      cache.remove(kIntentos);
      falla_(msgBloqueo);
    }
    cache.put(kIntentos, String(n), SEGUNDOS_BLOQUEO_);
    falla_('Correo o contraseña incorrectos.');
  }
  cache.remove(kIntentos);
  var token = crearSesion_(coach);
  return { token: token, correo: coach.correo, nombre: coach.nombre || coach.correo };
}

/** Datos públicos para pintar la pantalla de ingreso (sin información sensible). */
function accionConfigPublica_() {
  var c = leerConfig_();
  return { programa: c.programa, organizacion: c.organizacion, imagen: c.imagen, intensidad: c.intensidad };
}

function accionSesion_(d, ctx) {
  return { correo: ctx.correo, nombre: ctx.nombre };
}

function accionLogout_(d, ctx) {
  PropertiesService.getScriptProperties().deleteProperty(PREFIJO_SESION_ + ctx.th);
  return { ok: true };
}

function accionCambiarClave_(d, ctx) {
  var actual = String(d.actual === null || d.actual === undefined ? '' : d.actual);
  var nueva = String(d.nueva === null || d.nueva === undefined ? '' : d.nueva);
  var conf = String(d.confirmacion === null || d.confirmacion === undefined ? '' : d.confirmacion);
  if (!actual || !nueva || !conf) falla_('Completa los tres campos.');
  if (nueva.length < MIN_LARGO_CLAVE_) falla_('La nueva contraseña debe tener al menos ' + MIN_LARGO_CLAVE_ + ' caracteres.');
  if (nueva.length > MAX_LARGO_CLAVE_) falla_('La nueva contraseña es demasiado larga.');
  if (nueva !== conf) falla_('La confirmación no coincide con la nueva contraseña.');
  if (nueva === actual) falla_('La nueva contraseña debe ser distinta de la actual.');

  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    var coach = buscarCoach_(ctx.correo);
    if (!coach) falla_('SESION_INVALIDA');

    var cache = CacheService.getScriptCache();
    var kBloqueo = 'bloq_' + hashCorto_(coach.correo);
    var kIntentos = 'int_' + hashCorto_(coach.correo);
    if (cache.get(kBloqueo)) falla_('Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.');
    if (coach.clave !== hashClave_(actual)) {
      var n = Number(cache.get(kIntentos) || 0) + 1;
      if (n >= MAX_INTENTOS_) {
        cache.put(kBloqueo, '1', SEGUNDOS_BLOQUEO_);
        cache.remove(kIntentos);
        falla_('Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.');
      }
      cache.put(kIntentos, String(n), SEGUNDOS_BLOQUEO_);
      falla_('La contraseña actual no es correcta.');
    }
    cache.remove(kIntentos);

    var nuevoHash = hashClave_(nueva);
    hoja_('COACHES').getRange(coach.fila, 3).setValue(nuevoHash);

    // Cierra las sesiones de este coach en otros dispositivos y conserva la actual.
    var props = PropertiesService.getScriptProperties();
    var todo = props.getProperties();
    var nuevaHuella = huella_(nuevoHash);
    for (var k in todo) {
      if (k.indexOf(PREFIJO_SESION_) !== 0) continue;
      var r;
      try { r = JSON.parse(todo[k]); } catch (e) { props.deleteProperty(k); continue; }
      if (!r || r.e !== coach.correo) continue;
      if (k === PREFIJO_SESION_ + ctx.th) {
        r.f = nuevaHuella;
        props.setProperty(k, JSON.stringify(r));
      } else {
        props.deleteProperty(k);
      }
    }
  } finally {
    candado.releaseLock();
  }
  return { ok: true };
}
