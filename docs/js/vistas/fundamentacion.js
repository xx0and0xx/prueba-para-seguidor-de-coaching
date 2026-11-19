/* vistas/fundamentacion.js — 📚 Fundamentación teórica: tarjetas desde la hoja y contenido formateado. */
Vistas.fundamentacion = (function () {
  'use strict';

  var esc = U.esc;
  var el = null;
  var tarjetas = [];

  function mostrar(contenedor) {
    el = contenedor;
    el.innerHTML = '<h1>📚 Fundamentación teórica</h1><div class="cargando">Cargando…</div>';
    return Api.llamar('fundamentacion').then(function (r) {
      tarjetas = r.tarjetas || [];
      pintarLista();
    });
  }

  function pintarLista() {
    var html = '<div class="encabezado-vista"><h1>📚 Fundamentación teórica</h1></div>';
    if (!tarjetas.length) {
      html += '<div class="tarjeta vacio">No hay tarjetas visibles. Se administran en la hoja Fundamentación_Teórica.</div>';
      el.innerHTML = html;
      return;
    }
    html += '<div class="grid c3">' + tarjetas.map(function (t, i) {
      return '<button type="button" class="fx-tarjeta" data-abrir="' + i + '">' +
        '<div class="ico">' + esc(t.icono || '📘') + '</div>' +
        '<div class="cat">' + esc(t.categoria) + '</div>' +
        '<h3>' + esc(t.titulo) + '</h3>' +
        '<p>' + esc(t.resumen) + '</p></button>';
    }).join('') + '</div>';
    el.innerHTML = html;
    el.onclick = function (e) {
      var b = e.target.closest('[data-abrir]');
      if (b) pintarDetalle(tarjetas[Number(b.getAttribute('data-abrir'))]);
    };
  }

  function pintarDetalle(t) {
    if (!t) return;
    el.innerHTML =
      '<div class="encabezado-vista"><button type="button" class="btn sec" id="fx-volver">← Volver</button></div>' +
      '<div class="tarjeta fx-contenido">' +
      '<div style="font-size:34px">' + esc(t.icono || '📘') + '</div>' +
      '<div class="sub" style="text-transform:uppercase;letter-spacing:.04em;font-weight:700;color:var(--blue-mid)">' + esc(t.categoria) + '</div>' +
      '<h1 style="margin-top:2px">' + esc(t.titulo) + '</h1>' +
      U.formatoContenido(t.contenido) + '</div>';
    el.onclick = function (e) { if (e.target.closest('#fx-volver')) pintarLista(); };
    window.scrollTo(0, 0);
  }

  return { mostrar: mostrar };
})();
