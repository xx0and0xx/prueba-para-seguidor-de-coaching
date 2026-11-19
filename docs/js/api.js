/* api.js — Llamadas a la API de Apps Script (POST text/plain para evitar la verificación previa de CORS). */
var Api = (function () {
  'use strict';

  var CLAVE_TOKEN = 'ts_avance_token';
  var CLAVE_USUARIO = 'ts_avance_usuario';

  function leer(k) { try { return window.localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function guardar(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* almacenamiento no disponible */ } }
  function borrar(k) { try { window.localStorage.removeItem(k); } catch (e) { /* nada */ } }

  function token() { return leer(CLAVE_TOKEN); }

  function guardarSesion(t, usuario) {
    guardar(CLAVE_TOKEN, t);
    guardar(CLAVE_USUARIO, JSON.stringify(usuario));
  }

  function limpiarSesion() {
    borrar(CLAVE_TOKEN);
    borrar(CLAVE_USUARIO);
  }

  function usuarioGuardado() {
    try { return JSON.parse(leer(CLAVE_USUARIO)) || null; } catch (e) { return null; }
  }

  function urlApi() {
    return (typeof API_URL !== 'undefined' && API_URL && String(API_URL).indexOf('PEGA_AQUI') < 0) ? API_URL : '';
  }

  var alSesionInvalida = null;

  /**
   * Llama a una acción de la lista blanca del backend.
   * Devuelve data o lanza Error con un mensaje apto para mostrar.
   */
  function llamar(accion, datos, opciones) {
    opciones = opciones || {};
    var url = urlApi();
    if (!url) return Promise.reject(new Error('Falta configurar API_URL en docs/config.js.'));
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opciones.timeout || 90000) : null;

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: token(), accion: accion, datos: datos || {} }),
      redirect: 'follow',
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.json();
    }).then(function (j) {
      if (timer) clearTimeout(timer);
      if (j && j.ok) return j.data;
      var msg = j && j.error ? String(j.error) : 'Respuesta inesperada del servidor.';
      if (msg === 'SESION_INVALIDA') {
        limpiarSesion();
        if (alSesionInvalida) alSesionInvalida();
        throw new Error('Tu sesión venció. Ingresa de nuevo.');
      }
      throw new Error(msg);
    }, function (e) {
      if (timer) clearTimeout(timer);
      if (e && e.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
      if (window.console && console.error) console.error('[API] ' + accion + ':', e);
      if (e && e.name === 'SyntaxError') throw new Error('El servidor respondió algo inesperado (no es JSON). Revisa que la implementación del Apps Script permita acceso a «Cualquier usuario» y que esté actualizada.');
      throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
    });
  }

  return {
    llamar: llamar, token: token, guardarSesion: guardarSesion, limpiarSesion: limpiarSesion,
    usuarioGuardado: usuarioGuardado, urlApi: urlApi,
    onSesionInvalida: function (fn) { alSesionInvalida = fn; }
  };
})();
