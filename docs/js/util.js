/* util.js — Utilidades de interfaz: escape de HTML, formato, avisos y diálogos. */

/** Registro de vistas: cada archivo de js/vistas/ añade la suya aquí. */
var Vistas = {};

var U = (function () {
  'use strict';

  var MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

  /** Escapa TODO texto que venga de la hoja antes de insertarlo en el HTML (también en atributos). */
  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"'`]/g, function (c) { return MAPA[c]; });
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /** aaaa-mm-dd → "5 mar 2026". */
  function fecha(iso) {
    var p = Calculos.parseISO(iso);
    return p ? p.d + ' ' + MESES[p.m - 1] + ' ' + p.y : '—';
  }

  /** Fecha local de hoy (aaaa-mm-dd). */
  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function textoDias(dias) {
    if (dias === null || dias === undefined) return '';
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'mañana';
    if (dias === -1) return 'ayer';
    return dias > 0 ? 'en ' + dias + ' días' : 'hace ' + (-dias) + ' días';
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /** Normaliza para buscar sin importar tildes ni mayúsculas. */
  function norm(s) {
    return String(s === null || s === undefined ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* ---------- Chips y barras ---------- */

  function chipEstado(estado) {
    var clase = { 'Meta lograda': 'ok', 'En camino': 'warn', 'Prioridad': 'bad' }[estado];
    return clase ? '<span class="chip ' + clase + '">' + esc(estado) + '</span>' : '<span class="chip gris">Sin datos</span>';
  }

  function chipEstadoCoachee(estado) {
    var clase = { 'Activo': 'ok', 'En pausa': 'warn', 'Cerrado': 'gris' }[estado] || 'gris';
    return '<span class="chip ' + clase + '">' + esc(estado) + '</span>';
  }

  function chipNivel(nombre, valor) {
    if (!nombre || !valor) return '<span class="chip gris">—</span>';
    return '<span class="chip n' + esc(valor) + '">' + esc(nombre) + '</span>';
  }

  /** Puntaje de un indicador como chip coloreado por nivel (o guion si no hay). */
  function chipPuntaje(v) {
    var n = Calculos.num(v);
    if (n === null) return '<span class="sub">—</span>';
    return '<span class="chip n' + Calculos.nivelValor(n) + '">' + esc(Calculos.fmt(n, Math.floor(n) === n ? 0 : 1)) + '</span>';
  }

  function barra(p, clase) {
    var n = Calculos.num(p);
    var w = n === null ? 0 : Math.max(0, Math.min(100, Math.round(n * 100)));
    return '<div class="barra ' + (clase || '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + w + '"><span style="width:' + w + '%"></span></div>';
  }

  /* ---------- Avisos ---------- */

  function toast(mensaje, tipo) {
    var cont = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.textContent = mensaje;
    cont.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, tipo === 'error' ? 6500 : 3500);
  }

  /* ---------- Diálogos ---------- */

  /**
   * Abre un modal. `html` ya debe venir con el texto de usuario escapado (U.esc).
   * Devuelve { el, cerrar }.
   */
  function modal(html, opciones) {
    opciones = opciones || {};
    var raiz = document.getElementById('modal-raiz');
    var fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = '<div class="modal ' + (opciones.ancho ? 'ancho' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    raiz.appendChild(fondo);
    var previo = document.activeElement;
    function cerrar() {
      document.removeEventListener('keydown', onKey);
      if (fondo.parentNode) fondo.parentNode.removeChild(fondo);
      if (previo && previo.focus) { try { previo.focus(); } catch (e) { /* nada */ } }
      if (opciones.alCerrar) opciones.alCerrar();
    }
    function onKey(e) { if (e.key === 'Escape' && !opciones.bloqueado) cerrar(); }
    document.addEventListener('keydown', onKey);
    fondo.addEventListener('mousedown', function (e) { if (e.target === fondo && !opciones.bloqueado) cerrar(); });
    var primero = fondo.querySelector('input, select, textarea, button');
    if (primero && opciones.enfocar !== false) { try { primero.focus(); } catch (e) { /* nada */ } }
    return { el: fondo.firstChild, cerrar: cerrar };
  }

  /** Confirmación con botones propios. Devuelve una promesa de true/false. */
  function confirmar(mensaje, opciones) {
    opciones = opciones || {};
    return new Promise(function (resolver) {
      var m = modal(
        '<h2>' + esc(opciones.titulo || 'Confirmar') + '</h2>' +
        '<p>' + esc(mensaje) + '</p>' +
        '<div class="pie-modal">' +
        '<button type="button" class="btn sec" data-no>' + esc(opciones.no || 'Cancelar') + '</button>' +
        '<button type="button" class="btn ' + (opciones.peligro ? 'peligro' : '') + '" data-si>' + esc(opciones.si || 'Aceptar') + '</button>' +
        '</div>', { enfocar: false, alCerrar: function () { resolver(false); } });
      var hecho = false;
      function fin(v) { if (hecho) return; hecho = true; resolver(v); m.cerrar(); }
      m.el.querySelector('[data-si]').addEventListener('click', function () { fin(true); });
      m.el.querySelector('[data-no]').addEventListener('click', function () { fin(false); });
      m.el.querySelector('[data-no]').focus();
    });
  }

  /* ---------- Fundamentación: formato de contenido ---------- */

  /**
   * Convierte el contenido de una tarjeta a HTML seguro.
   * ## Subtítulo · 1. Paso · > Frase destacada · ! Atención · - Viñeta · otra línea = párrafo.
   */
  function formatoContenido(texto) {
    var lineas = String(texto === null || texto === undefined ? '' : texto).replace(/\r/g, '').split('\n');
    var html = '';
    var lista = '';
    function cerrarLista() {
      if (lista) { html += '</' + lista + '>'; lista = ''; }
    }
    lineas.forEach(function (crudo) {
      var l = crudo.trim();
      if (!l) { cerrarLista(); return; }
      var m;
      if ((m = /^##\s*(.+)$/.exec(l))) { cerrarLista(); html += '<h3>' + esc(m[1]) + '</h3>'; }
      else if ((m = /^\d+[.)]\s+(.+)$/.exec(l))) { if (lista !== 'ol') { cerrarLista(); html += '<ol>'; lista = 'ol'; } html += '<li>' + esc(m[1]) + '</li>'; }
      else if ((m = /^>\s*(.+)$/.exec(l))) { cerrarLista(); html += '<div class="fx-cita">' + esc(m[1]) + '</div>'; }
      else if ((m = /^!\s*(.+)$/.exec(l))) { cerrarLista(); html += '<div class="fx-aviso">⚠️ ' + esc(m[1]) + '</div>'; }
      else if ((m = /^[-•*]\s+(.+)$/.exec(l))) { if (lista !== 'ul') { cerrarLista(); html += '<ul>'; lista = 'ul'; } html += '<li>' + esc(m[1]) + '</li>'; }
      else { cerrarLista(); html += '<p>' + esc(l) + '</p>'; }
    });
    cerrarLista();
    return html;
  }

  /** Convierte un enlace de Drive a https://drive.google.com/thumbnail?id=ID&sz=w2000. */
  function urlImagenDrive(enlace) {
    var t = String(enlace || '').trim();
    if (!t) return '';
    var m = /\/d\/([-\w]{10,})/.exec(t) || /[?&]id=([-\w]{10,})/.exec(t);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w2000';
    return /^https:\/\//i.test(t) ? t : '';
  }

  /** Acepta "12" o "12 %" y devuelve 0-1. */
  function opacidadFondo(v) {
    var n = parseFloat(String(v === null || v === undefined ? '' : v).replace('%', '').replace(',', '.'));
    if (!isFinite(n)) n = 12;
    return Math.max(0, Math.min(100, n)) / 100;
  }

  /** Une el nombre de un coachee con su coach para listas. */
  function sinAcentos(s) { return norm(s); }

  return {
    esc: esc, $: $, $$: $$, fecha: fecha, hoy: hoy, textoDias: textoDias, debounce: debounce, norm: norm,
    chipEstado: chipEstado, chipEstadoCoachee: chipEstadoCoachee, chipNivel: chipNivel, chipPuntaje: chipPuntaje, barra: barra,
    toast: toast, modal: modal, confirmar: confirmar,
    formatoContenido: formatoContenido, urlImagenDrive: urlImagenDrive, opacidadFondo: opacidadFondo, sinAcentos: sinAcentos
  };
})();
