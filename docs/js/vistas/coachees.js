/* vistas/coachees.js — 👥 Coachees: buscar, crear, editar, cerrar o eliminar. */
Vistas.coachees = (function () {
  'use strict';

  var esc = U.esc, $ = U.$;
  var el = null;
  var lista = [];
  var coaches = [];
  var filtros = { texto: '', estado: 'abiertos' };

  function mostrar(contenedor) {
    el = contenedor;
    el.innerHTML = '<h1>👥 Coachees</h1><div class="cargando">Cargando coachees…</div>';
    return Promise.all([App.cargarCoachees(true), Api.llamar('listarCoaches')]).then(function (r) {
      lista = r[0];
      coaches = r[1].coaches || [];
      pintarLista();
    });
  }

  /* ---------- lista ---------- */

  function filtrar() {
    var correo = App.usuario() ? App.usuario().correo : '';
    var solo = App.soloMios();
    var q = U.norm(filtros.texto);
    return lista.filter(function (c) {
      if (solo && c.coach !== correo) return false;
      if (filtros.estado === 'abiertos' && c.estado === 'Cerrado') return false;
      if (filtros.estado !== 'abiertos' && filtros.estado !== 'todos' && c.estado !== filtros.estado) return false;
      if (q && U.norm(c.nombre + ' ' + c.cargo + ' ' + c.correo + ' ' + c.coachNombre).indexOf(q) < 0) return false;
      return true;
    });
  }

  function pintarLista() {
    var solo = App.soloMios();
    var html = '<div class="encabezado-vista"><h1>👥 Coachees</h1>' +
      '<button type="button" class="btn" id="co-nuevo">➕ Nuevo coachee</button></div>' +
      '<div class="herramientas">' +
      '<input type="search" id="co-buscar" placeholder="Buscar por nombre, cargo o correo" value="' + esc(filtros.texto) + '" aria-label="Buscar coachees">' +
      '<select id="co-estado" aria-label="Filtrar por estado" style="width:auto">' +
      opcion('abiertos', 'Activos y en pausa') + opcion('todos', 'Todos') + opcion('Activo', 'Activo') + opcion('En pausa', 'En pausa') + opcion('Cerrado', 'Cerrado') +
      '</select>' +
      '<label class="check"><input type="checkbox" id="co-solo"' + (solo ? ' checked' : '') + '> Solo mis coachees</label></div>' +
      '<div id="co-lista"></div>';
    el.innerHTML = html;

    $('#co-nuevo', el).addEventListener('click', function () { pintarFicha(null); });
    $('#co-buscar', el).addEventListener('input', U.debounce(function (e) { filtros.texto = e.target.value; pintarFilas(); }, 150));
    $('#co-estado', el).addEventListener('change', function (e) { filtros.estado = e.target.value; pintarFilas(); });
    $('#co-solo', el).addEventListener('change', function (e) { App.fijarSoloMios(e.target.checked); pintarFilas(); });
    el.onclick = clicLista;
    pintarFilas();
  }

  function opcion(v, t) {
    return '<option value="' + esc(v) + '"' + (filtros.estado === v ? ' selected' : '') + '>' + esc(t) + '</option>';
  }

  function pintarFilas() {
    var cont = $('#co-lista', el);
    if (!cont) return;
    var filas = filtrar();
    if (!filas.length) {
      cont.innerHTML = '<div class="tarjeta vacio">' + (lista.length ? 'Ningún coachee coincide con los filtros.' : 'Todavía no hay coachees. Crea el primero con “➕ Nuevo coachee”.') + '</div>';
      return;
    }
    cont.innerHTML = '<div class="tarjeta"><div class="lista">' + filas.map(function (c) {
      return '<div class="fila"><div class="info clic" data-ver="' + esc(c.id) + '" tabindex="0" role="button">' +
        '<b>' + esc(c.nombre) + '</b>' +
        '<span class="sub">' + esc(c.cargo || 'Sin cargo') + (c.coachNombre ? ' · Coach: ' + esc(c.coachNombre) : ' · Sin coach') + '</span> ' +
        U.chipEstadoCoachee(c.estado) + '</div>' +
        '<div class="acciones-fila acciones-bloque">' +
        '<button type="button" class="btn sec peq" data-editar="' + esc(c.id) + '">✏️ Editar</button>' +
        (c.estado !== 'Cerrado' ? '<button type="button" class="btn sec peq" data-cerrar="' + esc(c.id) + '">🔒 Cerrar</button>' : '') +
        '<button type="button" class="btn peligro peq" data-eliminar="' + esc(c.id) + '">🗑 Eliminar</button>' +
        '</div></div>';
    }).join('') + '</div></div>';
  }

  function porId(id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }

  function clicLista(e) {
    var b;
    if ((b = e.target.closest('[data-ver]'))) { App.ir('avance', { id: b.getAttribute('data-ver') }); return; }
    if ((b = e.target.closest('[data-editar]'))) { pintarFicha(porId(b.getAttribute('data-editar'))); return; }
    if ((b = e.target.closest('[data-cerrar]'))) { cerrar(porId(b.getAttribute('data-cerrar'))); return; }
    if ((b = e.target.closest('[data-eliminar]'))) { eliminar(porId(b.getAttribute('data-eliminar'))); return; }
  }

  function cerrar(c) {
    if (!c) return;
    U.confirmar('¿Cerrar el proceso de ' + c.nombre + '? Su historial se conserva y podrás reabrirlo cambiando el estado.', { titulo: 'Cerrar coachee', si: 'Cerrar proceso' })
      .then(function (ok) {
        if (!ok) return;
        return Api.llamar('cerrarCoachee', { id: c.id }).then(function () {
          U.toast('Proceso cerrado.', 'ok');
          return recargar();
        });
      }).catch(function (e) { U.toast(e.message, 'error'); });
  }

  function eliminar(c) {
    if (!c) return;
    U.confirmar('Se eliminará a ' + c.nombre + ' junto con todas sus mediciones. Esta acción no se puede deshacer.', { titulo: 'Eliminar coachee', si: 'Eliminar', peligro: true })
      .then(function (ok) {
        if (!ok) return;
        return Api.llamar('eliminarCoachee', { id: c.id }).then(function () {
          U.toast('Coachee eliminado.', 'ok');
          return recargar();
        });
      }).catch(function (e) { U.toast(e.message, 'error'); });
  }

  function recargar() {
    return App.cargarCoachees(true).then(function (r) { lista = r; pintarLista(); });
  }

  /* ---------- ficha (crear / editar) ---------- */

  function pintarFicha(c) {
    var nuevo = !c;
    var cfg = App.estado.cat.config;
    var d = c || {
      id: '', nombre: '', cargo: '', correo: '', coach: App.usuario().correo, objetivo: '',
      duracion: cfg.duracion, inicio: '', estado: 'Activo',
      real: { LB: '', M1: '', M2: '', MF: '' }, prog: { LB: '', M1: '', M2: '', MF: '' }
    };

    // Una fecha programada editada a mano no se recalcula al cambiar el inicio o la duración.
    var manual = { LB: false, M1: false, M2: false, MF: false };
    if (!nuevo) {
      var calc0 = Calculos.fechasProgramadas(d.inicio, d.duracion);
      Calculos.MOMENTOS.forEach(function (m) { manual[m] = !!(d.prog[m] && d.prog[m] !== calc0[m]); });
    }

    var opcionesCoach = '<option value="">(Sin coach)</option>';
    var hayCoach = false;
    coaches.forEach(function (k) {
      if (k.correo === d.coach) hayCoach = true;
      opcionesCoach += '<option value="' + esc(k.correo) + '"' + (k.correo === d.coach ? ' selected' : '') + '>' + esc(k.nombre) + ' (' + esc(k.correo) + ')</option>';
    });
    if (d.coach && !hayCoach) opcionesCoach += '<option value="' + esc(d.coach) + '" selected>' + esc(d.coach) + '</option>';

    var filasFechas = Calculos.MOMENTOS.map(function (m) {
      return '<tr><td class="izq"><b>' + esc(Calculos.NOMBRE_MOMENTO[m]) + '</b></td>' +
        '<td><input type="date" data-prog="' + m + '" value="' + esc(d.prog[m] || '') + '" aria-label="Fecha programada ' + esc(Calculos.NOMBRE_MOMENTO[m]) + '"></td>' +
        '<td>' + (d.real[m] ? '<span class="chip ok">' + esc(U.fecha(d.real[m])) + '</span>' : '<span class="chip gris">Pendiente</span>') + '</td></tr>';
    }).join('');

    el.innerHTML =
      '<div class="encabezado-vista"><h1>' + (nuevo ? '➕ Nuevo coachee' : '✏️ ' + esc(d.nombre)) + '</h1>' +
      '<button type="button" class="btn sec" id="f-volver">← Volver a la lista</button></div>' +
      '<form class="tarjeta" id="f-ficha" novalidate>' +
      '<div class="aviso error" id="f-error" hidden role="alert"></div>' +
      '<div class="fila-campos">' +
      '<label class="campo"><span>Nombre *</span><input type="text" id="f-nombre" maxlength="120" value="' + esc(d.nombre) + '" required></label>' +
      '<label class="campo"><span>Cargo</span><input type="text" id="f-cargo" maxlength="120" value="' + esc(d.cargo) + '"></label>' +
      '<label class="campo"><span>Correo del coachee</span><input type="email" id="f-correo" maxlength="120" value="' + esc(d.correo) + '" inputmode="email"></label>' +
      '<label class="campo"><span>Coach</span><select id="f-coach">' + opcionesCoach + '</select></label>' +
      '</div>' +
      '<label class="campo"><span>Objetivo del proceso</span><textarea id="f-objetivo" maxlength="1000">' + esc(d.objetivo) + '</textarea></label>' +
      '<div class="fila-campos">' +
      '<label class="campo"><span>Fecha de inicio</span><input type="date" id="f-inicio" value="' + esc(d.inicio) + '"></label>' +
      '<label class="campo"><span>Duración (meses)</span><input type="number" id="f-duracion" min="1" max="60" step="1" value="' + esc(d.duracion) + '" inputmode="numeric"></label>' +
      '<label class="campo"><span>Estado</span><select id="f-estado">' +
      ['Activo', 'En pausa', 'Cerrado'].map(function (s) { return '<option' + (s === d.estado ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></label></div>' +
      '<h3>Fechas de medición</h3>' +
      '<p class="sub">Se prellenan desde el inicio: línea base = inicio, M1 = +3 meses, M2 = +6 meses y MF = +duración. Puedes editarlas; las que cambies a mano no se vuelven a calcular. La fecha real se registra sola al guardar cada medición.</p>' +
      '<div class="tabla-scroll"><table class="tabla"><thead><tr><th class="izq">Momento</th><th>Programada</th><th>Real</th></tr></thead><tbody>' + filasFechas + '</tbody></table></div>' +
      '<div class="acciones-fila" style="margin-top:16px"><button type="submit" class="btn" id="f-guardar">Guardar</button>' +
      '<button type="button" class="btn sec" id="f-cancelar">Cancelar</button></div></form>';

    var inicio = $('#f-inicio', el), duracion = $('#f-duracion', el);
    function recalcular() {
      var calc = Calculos.fechasProgramadas(inicio.value, duracion.value);
      Calculos.MOMENTOS.forEach(function (m) {
        var campo = $('[data-prog="' + m + '"]', el);
        if (!manual[m]) campo.value = calc[m] || '';
      });
    }
    inicio.addEventListener('input', recalcular);
    duracion.addEventListener('input', recalcular);
    el.querySelectorAll('[data-prog]').forEach(function (campo) {
      campo.addEventListener('input', function () { manual[campo.getAttribute('data-prog')] = true; });
    });
    if (nuevo) recalcular();

    $('#f-volver', el).addEventListener('click', pintarLista);
    $('#f-cancelar', el).addEventListener('click', pintarLista);
    $('#f-ficha', el).addEventListener('submit', function (ev) {
      ev.preventDefault();
      guardarFicha(d);
    });
    $('#f-nombre', el).focus();
  }

  function guardarFicha(d) {
    var err = $('#f-error', el);
    function fallo(t) { err.hidden = false; err.textContent = t; err.scrollIntoView({ block: 'center' }); }
    err.hidden = true;
    var nombre = $('#f-nombre', el).value.trim();
    var correo = $('#f-correo', el).value.trim();
    var duracion = Number($('#f-duracion', el).value);
    if (!nombre) return fallo('El nombre es obligatorio.');
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return fallo('El correo del coachee no es válido.');
    if (!(duracion >= 1 && duracion <= 60)) return fallo('La duración debe estar entre 1 y 60 meses.');
    var prog = {};
    Calculos.MOMENTOS.forEach(function (m) { prog[m] = $('[data-prog="' + m + '"]', el).value; });
    var payload = {
      id: d.id || undefined,
      nombre: nombre, cargo: $('#f-cargo', el).value.trim(), correo: correo, coach: $('#f-coach', el).value,
      objetivo: $('#f-objetivo', el).value.trim(), inicio: $('#f-inicio', el).value, duracion: duracion,
      estado: $('#f-estado', el).value, prog: prog
    };
    var btn = $('#f-guardar', el);
    btn.disabled = true;
    Api.llamar('guardarCoachee', payload).then(function () {
      U.toast('Coachee guardado.', 'ok');
      return recargar();
    }).catch(function (e) {
      btn.disabled = false;
      fallo(e.message);
    });
  }

  return { mostrar: mostrar };
})();
