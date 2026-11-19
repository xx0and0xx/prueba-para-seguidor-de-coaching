/* app.js — Arranque, sesión, navegación interna (SPA) y estado compartido.
 * La navegación entre secciones NUNCA cambia de URL ni recarga la página. */
var App = (function () {
  'use strict';

  var $ = U.$, $$ = U.$$, esc = U.esc;

  var SECCIONES = [
    { id: 'tablero', icono: '📊', texto: 'Tablero' },
    { id: 'coachees', icono: '👥', texto: 'Coachees' },
    { id: 'avance', icono: '📈', texto: 'Avance del coachee' },
    { id: 'fundamentacion', icono: '📚', texto: 'Fundamentación teórica' },
    { id: 'configuracion', icono: '⚙️', texto: 'Configuración' },
    { id: 'medicion', icono: '📝', texto: 'Registrar medición' }
  ];

  var CLAVE_SOLO_MIOS = 'ts_avance_solo_mios';

  var estado = { usuario: null, cat: null, coachees: null, actual: '', params: { v: '', c: '', m: '' } };

  /* ---------- parámetros de la URL (se sanitizan) ---------- */

  function leerParametros() {
    var p = { v: '', c: '', m: '' };
    try {
      var q = new URLSearchParams(window.location.search);
      var v = String(q.get('v') || '').toLowerCase();
      var c = String(q.get('c') || '').trim();
      var m = String(q.get('m') || '').trim().toUpperCase();
      if (v === 'admin') p.v = 'admin';
      if (/^CO-[A-Za-z0-9]{4,16}$/.test(c)) p.c = c;
      if (['LB', 'M1', 'M2', 'MF'].indexOf(m) >= 0) p.m = m;
    } catch (e) { /* sin parámetros */ }
    return p;
  }

  /* ---------- pantallas ---------- */

  function mostrarSolo(id) {
    ['sin-config', 'login', 'app'].forEach(function (x) { $('#' + x).hidden = x !== id; });
  }

  function aplicarFondo(imagen, intensidad) {
    var fondo = $('#fondo');
    var url = U.urlImagenDrive(imagen);
    if (!url) {
      fondo.style.backgroundImage = '';
      document.documentElement.style.setProperty('--fondo-op', '0');
      return;
    }
    fondo.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
    document.documentElement.style.setProperty('--fondo-op', String(U.opacidadFondo(intensidad)));
  }

  function aplicarMarca(cfg) {
    var programa = (cfg && cfg.programa) || 'Avance en Coaching Ejecutivo';
    var org = (cfg && cfg.organizacion) || '';
    $('#login-programa').textContent = programa;
    $('#login-org').textContent = org;
    $('#marca-programa').textContent = programa;
    $('#marca-org').textContent = org;
    $('#topbar-titulo').textContent = programa;
    document.title = programa;
    aplicarFondo(cfg && cfg.imagen, cfg && cfg.intensidad);
  }

  function mostrarLogin(mensaje) {
    estado.usuario = null;
    estado.cat = null;
    estado.coachees = null;
    mostrarSolo('login');
    var err = $('#login-error');
    err.hidden = !mensaje;
    err.textContent = mensaje || '';
    $('#login-clave').value = '';
    $('#login-enviar').disabled = false;
    $('#login-enviar').textContent = 'Ingresar';
    var correo = Api.usuarioGuardado();
    if (correo && correo.correo && !$('#login-correo').value) $('#login-correo').value = correo.correo;
  }

  /* ---------- sesión ---------- */

  function cargarMarcaPublica() {
    return Api.llamar('configPublica').then(function (cfg) { aplicarMarca(cfg); }).catch(function () { /* la marca por defecto basta */ });
  }

  function entrar() {
    return Api.llamar('catalogos').then(function (cat) {
      estado.cat = cat;
      aplicarMarca(cat.config);
      $('#usuario-nombre').textContent = estado.usuario.nombre || estado.usuario.correo;
      pintarMenu();
      mostrarSolo('app');
      var p = estado.params;
      if (p.c) return ir('medicion', { c: p.c, m: p.m });
      if (p.v === 'admin') return ir('tablero');
      return ir('medicion');
    });
  }

  function iniciarSesionConToken() {
    return Api.llamar('sesion').then(function (u) {
      estado.usuario = u;
      return entrar();
    });
  }

  function cerrarSesion() {
    var paso = Promise.resolve();
    if (Api.token()) paso = Api.llamar('logout').catch(function () { /* se cierra igual en este dispositivo */ });
    paso.then(function () {
      Api.limpiarSesion();
      estado.params = { v: '', c: '', m: '' };
      mostrarLogin();
    });
  }

  /* ---------- menú y navegación ---------- */

  function pintarMenu() {
    $('#nav').innerHTML = SECCIONES.map(function (s) {
      return '<button type="button" data-vista="' + esc(s.id) + '"><span class="ico-nav">' + s.icono + '</span><span>' + esc(s.texto) + '</span></button>';
    }).join('');
  }

  function abrirMenu(abrir) {
    $('#sidebar').classList.toggle('abierto', abrir);
    $('#sombra-menu').classList.toggle('visible', abrir);
    $('#btn-menu').setAttribute('aria-expanded', abrir ? 'true' : 'false');
  }

  function hayCambiosSinGuardar() {
    return estado.actual === 'medicion' && Vistas.medicion && Vistas.medicion.haySinGuardar && Vistas.medicion.haySinGuardar();
  }

  /** Muestra una sección. Pregunta antes de salir de una medición con cambios sin guardar. */
  function ir(id, opciones) {
    var vista = Vistas[id];
    if (!vista) return Promise.resolve();
    var paso = Promise.resolve(true);
    if (hayCambiosSinGuardar()) {
      paso = U.confirmar('Tienes cambios sin guardar en la medición. Si sales, se perderán.', {
        titulo: 'Cambios sin guardar', si: 'Salir sin guardar', no: 'Seguir editando', peligro: true
      });
    }
    return paso.then(function (continuar) {
      if (!continuar) return;
      if (estado.actual === 'medicion' && Vistas.medicion.descartar) Vistas.medicion.descartar();
      estado.actual = id;
      $$('.vista').forEach(function (v) { v.hidden = v.id !== 'v-' + id; });
      $$('#nav button').forEach(function (b) { b.classList.toggle('activo', b.getAttribute('data-vista') === id); });
      $('#contenido').classList.toggle('con-pie', id === 'medicion');
      abrirMenu(false);
      window.scrollTo(0, 0);
      var el = $('#v-' + id);
      return Promise.resolve(vista.mostrar(el, opciones || {})).catch(function (e) {
        el.innerHTML = '<div class="aviso error">' + esc(e && e.message ? e.message : 'Ocurrió un error.') + '</div>';
      });
    });
  }

  /* ---------- datos compartidos ---------- */

  function cargarCoachees(forzar) {
    if (estado.coachees && !forzar) return Promise.resolve(estado.coachees);
    return Api.llamar('listarCoachees').then(function (r) {
      estado.coachees = r.coachees || [];
      return estado.coachees;
    });
  }

  function invalidarCoachees() { estado.coachees = null; }

  function soloMios() {
    try { return window.localStorage.getItem(CLAVE_SOLO_MIOS) === '1'; } catch (e) { return false; }
  }

  function fijarSoloMios(v) {
    try { window.localStorage.setItem(CLAVE_SOLO_MIOS, v ? '1' : '0'); } catch (e) { /* nada */ }
  }

  function escala() { return (estado.cat && estado.cat.escala) || Calculos.ESCALA_DEFECTO; }

  function nivelInfo(valor) {
    var e = escala();
    for (var i = 0; i < e.length; i++) if (Number(e[i].valor) === Number(valor)) return e[i];
    return { valor: valor, nivel: '', descripcion: '' };
  }

  function indicadores() { return (estado.cat && estado.cat.indicadores) || []; }

  /* ---------- cambio de contraseña ---------- */

  function abrirCambioClave() {
    var m = U.modal(
      '<h2>🔑 Cambiar contraseña</h2>' +
      '<div class="aviso error" id="cc-error" hidden role="alert"></div>' +
      '<label class="campo"><span>Contraseña actual</span><input type="password" id="cc-actual" autocomplete="current-password"></label>' +
      '<label class="campo"><span>Nueva contraseña <span class="ayuda">(mínimo 6 caracteres)</span></span><input type="password" id="cc-nueva" autocomplete="new-password"></label>' +
      '<label class="campo"><span>Confirmar nueva contraseña</span><input type="password" id="cc-conf" autocomplete="new-password"></label>' +
      '<label class="check"><input type="checkbox" id="cc-ver"> Mostrar contraseñas</label>' +
      '<p class="sub" style="margin-top:10px">Al cambiarla se cierran tus sesiones en otros dispositivos. En este seguirás dentro.</p>' +
      '<div class="pie-modal"><button type="button" class="btn sec" data-cancelar>Cancelar</button><button type="button" class="btn" data-guardar>Guardar</button></div>');
    var el = m.el;
    var err = $('#cc-error', el);
    $('#cc-ver', el).addEventListener('change', function (e) {
      ['#cc-actual', '#cc-nueva', '#cc-conf'].forEach(function (s) { $(s, el).type = e.target.checked ? 'text' : 'password'; });
    });
    $('[data-cancelar]', el).addEventListener('click', m.cerrar);
    $('[data-guardar]', el).addEventListener('click', function (ev) {
      var btn = ev.currentTarget;
      var actual = $('#cc-actual', el).value, nueva = $('#cc-nueva', el).value, conf = $('#cc-conf', el).value;
      function fallo(t) { err.hidden = false; err.textContent = t; }
      err.hidden = true;
      if (!actual || !nueva || !conf) return fallo('Completa los tres campos.');
      if (nueva.length < 6) return fallo('La nueva contraseña debe tener al menos 6 caracteres.');
      if (nueva !== conf) return fallo('La confirmación no coincide con la nueva contraseña.');
      if (nueva === actual) return fallo('La nueva contraseña debe ser distinta de la actual.');
      btn.disabled = true;
      Api.llamar('cambiarClave', { actual: actual, nueva: nueva, confirmacion: conf }).then(function () {
        m.cerrar();
        U.toast('Contraseña actualizada.', 'ok');
      }).catch(function (e) {
        btn.disabled = false;
        fallo(e.message);
      });
    });
  }

  /* ---------- arranque ---------- */

  function enlazarEventos() {
    $('#form-login').addEventListener('submit', function (e) {
      e.preventDefault();
      var correo = $('#login-correo').value.trim();
      var clave = $('#login-clave').value;
      var btn = $('#login-enviar');
      var err = $('#login-error');
      err.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Ingresando…';
      Api.llamar('login', { correo: correo, clave: clave }).then(function (r) {
        Api.guardarSesion(r.token, { correo: r.correo, nombre: r.nombre });
        estado.usuario = { correo: r.correo, nombre: r.nombre };
        $('#login-clave').value = '';
        return entrar();
      }).catch(function (e2) {
        mostrarLogin(e2.message);
      });
    });

    $('#login-ver').addEventListener('click', function () {
      var campo = $('#login-clave');
      var oculto = campo.type === 'password';
      campo.type = oculto ? 'text' : 'password';
      this.setAttribute('aria-label', oculto ? 'Ocultar contraseña' : 'Mostrar contraseña');
      this.textContent = oculto ? '🙈' : '👁';
    });

    $('#nav').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-vista]');
      if (b) ir(b.getAttribute('data-vista'));
    });
    $('#btn-menu').addEventListener('click', function () { abrirMenu(!$('#sidebar').classList.contains('abierto')); });
    $('#sombra-menu').addEventListener('click', function () { abrirMenu(false); });
    $('#btn-clave').addEventListener('click', abrirCambioClave);
    $('#btn-salir').addEventListener('click', function () {
      if (hayCambiosSinGuardar()) {
        U.confirmar('Tienes cambios sin guardar en la medición. Si sales, se perderán.', {
          titulo: 'Cambios sin guardar', si: 'Salir sin guardar', no: 'Seguir editando', peligro: true
        }).then(function (ok) { if (ok) cerrarSesion(); });
      } else {
        cerrarSesion();
      }
    });

    // Aviso del navegador si se cierra la pestaña con una medición sin guardar.
    window.addEventListener('beforeunload', function (e) {
      if (hayCambiosSinGuardar()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function iniciar() {
    if (window.__sinConfig || !Api.urlApi()) { mostrarSolo('sin-config'); return; }
    estado.params = leerParametros();
    enlazarEventos();
    Api.onSesionInvalida(function () { mostrarLogin('Tu sesión venció. Ingresa de nuevo.'); });
    if (Api.token()) {
      cargarMarcaPublica();
      iniciarSesionConToken().catch(function (e) {
        // Si la sesión es inválida, el manejador ya mostró el ingreso; si fue otro error, se informa.
        if (!$('#login').hidden) return;
        mostrarLogin(e && e.message ? e.message : '');
      });
    } else {
      mostrarLogin();
      cargarMarcaPublica();
    }
  }

  document.addEventListener('DOMContentLoaded', iniciar);

  return {
    estado: estado, ir: ir, cargarCoachees: cargarCoachees, invalidarCoachees: invalidarCoachees,
    soloMios: soloMios, fijarSoloMios: fijarSoloMios, escala: escala, nivelInfo: nivelInfo, indicadores: indicadores,
    usuario: function () { return estado.usuario; }, aplicarMarca: aplicarMarca
  };
})();
