/* vistas/tablero.js — 📊 Tablero: tarjetas, próximas mediciones y coachees con barra de avance. */
Vistas.tablero = (function () {
  'use strict';

  var esc = U.esc;
  var datos = null;
  var contenedor = null;

  function mostrar(el) {
    contenedor = el;
    el.innerHTML = '<h1>📊 Tablero</h1><div class="cargando">Cargando tablero…</div>';
    return Api.llamar('tablero').then(function (d) {
      datos = d;
      pintar();
    });
  }

  function pintar() {
    var el = contenedor;
    var correo = App.usuario() ? App.usuario().correo : '';
    var solo = App.soloMios();
    var coachees = datos.coachees.filter(function (c) { return !solo || c.coach === correo; });
    var proximas = datos.proximas.filter(function (p) { return !solo || p.coach === correo; });

    var activos = coachees.filter(function (c) { return c.estado === 'Activo'; });
    var conDatos = activos.filter(function (c) { return c.medido; });
    var indiceProm = Calculos.promedio(conDatos.map(function (c) { return c.actual; }));
    var avanceProm = Calculos.promedio(conDatos.map(function (c) { return c.avance; }));
    var en30 = proximas.filter(function (p) { return p.dias >= 0 && p.dias <= 30; }).length;

    var html = '';
    html += '<div class="encabezado-vista"><h1>📊 Tablero</h1>' +
      '<label class="check"><input type="checkbox" id="tb-solo"' + (solo ? ' checked' : '') + '> Solo mis coachees</label></div>';

    html += '<div class="grid c4">' +
      stat(String(activos.length), 'Coachees activos') +
      stat(indiceProm === null ? '—' : Calculos.fmt(indiceProm) + ' <small>/ 5</small>', 'Índice promedio actual') +
      stat(avanceProm === null ? '—' : Calculos.fmtPct(avanceProm), 'Avance promedio a la meta') +
      stat(String(en30), 'Mediciones en los próximos 30 días') +
      '</div>';

    html += '<div class="tarjeta"><h2>🗓️ Próximas mediciones</h2>';
    if (!proximas.length) {
      html += '<div class="vacio">No hay mediciones programadas para los próximos 30 días.</div>';
    } else {
      html += '<div class="lista">' + proximas.slice(0, 12).map(function (p) {
        var atrasada = p.dias < 0;
        return '<div class="fila"><div class="info"><b>' + esc(p.nombre) + '</b>' +
          '<span class="sub">' + esc(p.momentoNombre) + ' · ' + esc(U.fecha(p.fecha)) + ' · ' + esc(U.textoDias(p.dias)) + '</span> ' +
          (atrasada ? '<span class="chip bad">Atrasada</span>' : '') + '</div>' +
          '<button type="button" class="btn peq" data-medir="' + esc(p.id) + '" data-momento="' + esc(p.momento) + '">📝 Medir</button></div>';
      }).join('') + '</div>';
      if (proximas.length > 12) html += '<p class="sub" style="margin-top:8px">Se muestran las 12 primeras de ' + proximas.length + '.</p>';
    }
    html += '</div>';

    var visibles = coachees.filter(function (c) { return c.estado !== 'Cerrado'; });
    html += '<div class="tarjeta"><h2>👥 Coachees</h2>';
    if (!visibles.length) {
      html += '<div class="vacio">' + (solo ? 'No tienes coachees asignados.' : 'Todavía no hay coachees. Crea el primero en la sección 👥 Coachees.') + '</div>';
    } else {
      html += '<div class="lista">' + visibles.map(function (c) {
        return '<div class="fila clic" data-ver="' + esc(c.id) + '" tabindex="0" role="button">' +
          '<div class="info"><b>' + esc(c.nombre) + '</b>' +
          '<span class="sub">' + esc(c.cargo || 'Sin cargo') + (c.coachNombre ? ' · Coach: ' + esc(c.coachNombre) : '') + '</span>' +
          '<div style="display:flex;align-items:center;gap:10px;margin-top:6px">' +
          '<div style="flex:1">' + U.barra(c.avance) + '</div>' +
          '<span class="sub" style="min-width:42px;text-align:right">' + (c.medido ? esc(Calculos.fmtPct(c.avance)) : '—') + '</span></div></div>' +
          '<div style="text-align:right">' + (c.medido ? U.chipNivel(c.nivel, c.nivelValor) : '<span class="chip gris">Sin medir</span>') +
          '<div class="sub" style="margin-top:4px">' + (c.medido ? esc(c.enMeta + '/' + c.total) + ' en meta' : '') + '</div></div></div>';
      }).join('') + '</div>';
    }
    html += '</div>';

    el.innerHTML = html;

    el.querySelector('#tb-solo').addEventListener('change', function (e) {
      App.fijarSoloMios(e.target.checked);
      pintar();
    });
    el.onclick = function (e) {
      var medir = e.target.closest('[data-medir]');
      if (medir) { App.ir('medicion', { c: medir.getAttribute('data-medir'), m: medir.getAttribute('data-momento') }); return; }
      var ver = e.target.closest('[data-ver]');
      if (ver) App.ir('avance', { id: ver.getAttribute('data-ver') });
    };
    el.onkeydown = function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var ver = e.target.closest && e.target.closest('[data-ver]');
      if (ver) { e.preventDefault(); App.ir('avance', { id: ver.getAttribute('data-ver') }); }
    };
  }

  function stat(num, etiqueta) {
    return '<div class="tarjeta stat"><div class="num">' + num + '</div><div class="etq">' + esc(etiqueta) + '</div></div>';
  }

  return { mostrar: mostrar };
})();
