/* vistas/avance.js — 📈 Avance del coachee: momentos, indicadores clave, tablas, textos e informe. */
Vistas.avance = (function () {
  'use strict';

  var esc = U.esc, $ = U.$;
  var el = null;
  var S = { id: null, coachee: null, filas: [], textosSucios: false };

  function mostrar(contenedor, opciones) {
    el = contenedor;
    el.innerHTML = '<h1>📈 Avance del coachee</h1><div class="cargando">Cargando…</div>';
    return App.cargarCoachees(true).then(function (lista) {
      if (!lista.length) {
        el.innerHTML = '<h1>📈 Avance del coachee</h1><div class="tarjeta vacio">Todavía no hay coachees. Crea el primero en la sección 👥 Coachees.</div>';
        return null;
      }
      var id = (opciones && opciones.id) || S.id;
      if (!lista.some(function (c) { return c.id === id; })) {
        var correo = App.usuario() ? App.usuario().correo : '';
        var mio = lista.filter(function (c) { return c.coach === correo && c.estado === 'Activo'; })[0];
        id = (mio || lista[0]).id;
      }
      return cargar(id);
    });
  }

  function cargar(id) {
    return Api.llamar('obtenerEvaluacion', { id: id }).then(function (r) {
      S.id = id;
      S.coachee = r.coachee;
      S.filas = r.filas;
      S.textosSucios = false;
      pintar();
    });
  }

  function enlaceSeguro(u) {
    return /^https:\/\//i.test(String(u || '')) ? String(u) : '';
  }

  function analisis() {
    return Calculos.analizar(S.filas.map(function (f) {
      return { codigo: f.codigo, habilidad: f.habilidad, lb: f.lb, m1: f.m1, m2: f.m2, mf: f.mf, meta: f.meta };
    }), App.escala());
  }

  /* ---------- pantalla ---------- */

  function pintar() {
    var c = S.coachee;
    var lista = (App.estado.coachees || []).slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
    var opciones = lista.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.nombre) + (x.estado !== 'Activo' ? ' (' + esc(x.estado) + ')' : '') + '</option>';
    }).join('');

    var momentos = Calculos.MOMENTOS.map(function (m) {
      var hecho = !!c.real[m];
      return '<div class="momento' + (hecho ? ' hecho' : '') + '">' +
        '<b>' + esc(Calculos.NOMBRE_MOMENTO[m]) + '</b>' +
        '<div class="fechas">Programada: ' + esc(U.fecha(c.prog[m])) + '<br>Real: ' + (hecho ? esc(U.fecha(c.real[m])) : 'Pendiente') + '</div>' +
        '<button type="button" class="btn peq ' + (hecho ? 'sec' : '') + '" data-medir="' + m + '">' + (hecho ? '✏️ Editar' : '📝 Registrar') + '</button></div>';
    }).join('');

    var informe = enlaceSeguro(c.informe);

    el.innerHTML =
      '<div class="encabezado-vista"><h1>📈 Avance del coachee</h1>' +
      '<select id="av-sel" aria-label="Elegir coachee" style="max-width:340px">' + opciones + '</select></div>' +

      '<div class="tarjeta"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">' +
      '<div><h2 style="margin-bottom:2px">' + esc(c.nombre) + '</h2>' +
      '<div class="sub">' + esc(c.cargo || 'Sin cargo') + (c.coachNombre ? ' · Coach: ' + esc(c.coachNombre) : '') + '</div></div>' +
      U.chipEstadoCoachee(c.estado) + '</div>' +
      (c.objetivo ? '<p style="margin:10px 0 0"><b>Objetivo:</b> ' + esc(c.objetivo) + '</p>' : '') + '</div>' +

      '<h2>🗓️ Mediciones</h2><div class="grid c4" id="av-momentos">' + momentos + '</div>' +
      '<div id="av-analisis"></div>' +

      '<div class="tarjeta"><h2>📝 Textos del informe</h2>' +
      '<label class="campo"><span>🏆 Logros</span><textarea id="tx-logros" maxlength="4000" data-texto>' + esc(c.logros) + '</textarea></label>' +
      '<label class="campo"><span>💡 Aprendizajes</span><textarea id="tx-aprendizajes" maxlength="4000" data-texto>' + esc(c.aprendizajes) + '</textarea></label>' +
      '<label class="campo"><span>🌱 Áreas a fortalecer</span><textarea id="tx-areas" maxlength="4000" data-texto>' + esc(c.areas) + '</textarea></label>' +
      '<label class="campo"><span>🧭 Recomendaciones</span><textarea id="tx-recomendaciones" maxlength="4000" data-texto>' + esc(c.recomendaciones) + '</textarea></label>' +
      '<button type="button" class="btn" id="tx-guardar">Guardar textos</button></div>' +

      '<div class="tarjeta"><h2>📄 Informe final</h2>' +
      '<div class="acciones-fila acciones-bloque">' +
      '<button type="button" class="btn sec" id="inf-vista">👁 Vista previa</button>' +
      '<button type="button" class="btn" id="inf-generar">📄 Generar y guardar PDF</button>' +
      '<button type="button" class="btn claro" id="inf-enviar">✉️ Enviar por correo</button></div>' +
      '<div id="inf-ultimo" class="sub" style="margin-top:10px">' +
      (informe ? 'Último informe guardado: <a href="' + esc(informe) + '" target="_blank" rel="noopener noreferrer">abrir PDF</a>' : 'Aún no se ha generado ningún informe.') + '</div></div>';

    pintarAnalisis();
    enlazar();
  }

  function stat(valor, etiqueta, extra) {
    return '<div class="tarjeta indicador-clave"><div class="valor">' + valor + '</div><div class="etq">' + esc(etiqueta) + '</div>' + (extra || '') + '</div>';
  }

  function pintarAnalisis() {
    var a = analisis();
    var k = a.clave;
    var sinDatos = a.global.actual === null;
    var html = '';
    if (sinDatos) html += '<div class="aviso">Este coachee todavía no tiene mediciones. Registra la línea base para ver su avance.</div>';

    html += '<h2>⭐ Indicadores clave</h2><div class="grid c4">' +
      stat(esc(Calculos.fmt(k.indiceLB)) + ' → ' + esc(Calculos.fmt(k.indiceActual)) + ' <small>/ 5</small>', 'Índice: línea base → actual',
        '<div class="sub">' + esc(Calculos.fmtPct(k.desarrollo)) + ' de desarrollo</div>') +
      stat(esc(Calculos.fmtVar(k.variacionIndice)), 'Variación del índice') +
      stat(esc(Calculos.fmtPct(k.avance)), 'Avance a la meta', '<div style="margin-top:6px">' + U.barra(k.avance) + '</div>') +
      stat(esc(k.enMeta + '/' + k.total), 'Indicadores en meta') +
      stat(k.nivel ? U.chipNivel(k.nivel, a.global.nivelValor) : '—', 'Nivel global') +
      stat(esc(k.mayorCrecimiento || '—'), 'Habilidad de mayor crecimiento') +
      stat(esc(k.masFuerte || '—'), 'Habilidad más fuerte') +
      stat(esc(k.mayorOportunidad || '—'), 'Mayor oportunidad') +
      '</div>';

    html += '<div class="tarjeta"><h2>🧩 Resultados por habilidad</h2><div class="tabla-scroll"><table class="tabla tabla-cards"><thead><tr>' +
      '<th class="izq">Habilidad</th><th>LB</th><th>M1</th><th>M2</th><th>MF</th><th>Meta</th><th>Actual</th><th>Var.</th><th>Índice</th><th style="min-width:130px">% avance</th><th>Estado</th><th>Nivel</th></tr></thead><tbody>' +
      a.habilidades.map(function (h) { return filaHabilidad(h.habilidad, h, false); }).join('') +
      filaHabilidad('Global', a.global, true) + '</tbody></table></div></div>';

    html += '<div class="tarjeta"><h2>📋 Detalle por indicador</h2>' +
      '<p class="sub">La meta de cada indicador se puede editar (1 a 5).</p><div class="tabla-scroll"><table class="tabla tabla-cards"><thead><tr>' +
      '<th>Cód.</th><th class="izq">Indicador</th><th>LB</th><th>M1</th><th>M2</th><th>MF</th><th>Meta</th><th>Actual</th><th>Var.</th><th>Avance</th><th>Estado</th></tr></thead><tbody>' +
      S.filas.map(function (f, i) {
        var ind = a.indicadores[i];
        return '<tr><td class="cod" data-et="Código"><b>' + esc(f.codigo) + '</b></td><td class="izq desc" style="min-width:220px">' + esc(f.indicador) + '</td>' +
          '<td data-et="LB">' + U.chipPuntaje(f.lb) + '</td><td data-et="M1">' + U.chipPuntaje(f.m1) + '</td><td data-et="M2">' + U.chipPuntaje(f.m2) + '</td><td data-et="MF">' + U.chipPuntaje(f.mf) + '</td>' +
          '<td data-et="Meta"><select data-meta="' + esc(f.codigo) + '" aria-label="Meta de ' + esc(f.codigo) + '">' +
          [1, 2, 3, 4, 5].map(function (n) { return '<option' + (Number(f.meta) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
          '</select></td>' +
          '<td data-et="Actual"><b>' + esc(Calculos.fmt(ind.actual, 0)) + '</b></td><td data-et="Variación">' + esc(Calculos.fmtVar(ind.variacion)) + '</td>' +
          '<td data-et="Avance">' + esc(Calculos.fmtPct(ind.avance)) + '</td><td data-et="Estado">' + U.chipEstado(ind.estado) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    $('#av-analisis', el).innerHTML = html;
  }

  function filaHabilidad(nombre, h, total) {
    return '<tr' + (total ? ' class="total"' : '') + '><td class="izq desc"><b>' + esc(nombre) + '</b></td>' +
      '<td data-et="LB">' + esc(Calculos.fmt(h.lb)) + '</td><td data-et="M1">' + esc(Calculos.fmt(h.m1)) + '</td><td data-et="M2">' + esc(Calculos.fmt(h.m2)) + '</td><td data-et="MF">' + esc(Calculos.fmt(h.mf)) + '</td>' +
      '<td data-et="Meta">' + esc(Calculos.fmt(h.meta)) + '</td><td data-et="Actual"><b>' + esc(Calculos.fmt(h.actual)) + '</b></td><td data-et="Variación">' + esc(Calculos.fmtVar(h.variacion)) + '</td>' +
      '<td data-et="Índice">' + esc(Calculos.fmtPct(h.indice)) + '</td>' +
      '<td class="ancho" data-et="% avance"><div style="display:flex;align-items:center;gap:8px"><div style="flex:1">' + U.barra(h.avance) + '</div><span>' + esc(Calculos.fmtPct(h.avance)) + '</span></div></td>' +
      '<td data-et="Estado">' + U.chipEstado(h.estado) + '</td><td data-et="Nivel">' + U.chipNivel(h.nivel, h.nivelValor) + '</td></tr>';
  }

  /* ---------- eventos ---------- */

  function enlazar() {
    $('#av-sel', el).addEventListener('change', function (e) {
      var id = e.target.value;
      if (S.textosSucios) {
        U.confirmar('Tienes textos del informe sin guardar. Si cambias de coachee se perderán.', { titulo: 'Cambios sin guardar', si: 'Cambiar de todos modos', no: 'Quedarme', peligro: true })
          .then(function (ok) {
            if (ok) return cargar(id).catch(error);
            e.target.value = S.id;
          });
        return;
      }
      cargar(id).catch(error);
    });

    el.querySelectorAll('[data-texto]').forEach(function (t) {
      t.addEventListener('input', function () { S.textosSucios = true; });
    });

    el.onclick = function (e) {
      var b;
      if ((b = e.target.closest('[data-medir]'))) { App.ir('medicion', { c: S.id, m: b.getAttribute('data-medir') }); return; }
    };

    el.onchange = function (e) {
      var s = e.target.closest && e.target.closest('select[data-meta]');
      if (!s) return;
      var codigo = s.getAttribute('data-meta');
      var meta = Number(s.value);
      s.disabled = true;
      Api.llamar('guardarMeta', { id: S.id, codigo: codigo, meta: meta }).then(function () {
        S.filas.forEach(function (f) { if (f.codigo === codigo) f.meta = meta; });
        pintarAnalisis();
        U.toast('Meta actualizada.', 'ok');
      }).catch(function (err) {
        s.disabled = false;
        U.toast(err.message, 'error');
        pintarAnalisis();
      });
    };

    $('#tx-guardar', el).addEventListener('click', function (e) {
      var btn = e.currentTarget;
      btn.disabled = true;
      guardarTextos().then(function () { U.toast('Textos guardados.', 'ok'); }).catch(error).then(function () { btn.disabled = false; });
    });
    $('#inf-vista', el).addEventListener('click', vistaPrevia);
    $('#inf-generar', el).addEventListener('click', generar);
    $('#inf-enviar', el).addEventListener('click', abrirEnvio);
  }

  function error(e) { U.toast(e && e.message ? e.message : 'Ocurrió un error.', 'error'); }

  function textosActuales() {
    return {
      id: S.id,
      logros: $('#tx-logros', el).value, aprendizajes: $('#tx-aprendizajes', el).value,
      areas: $('#tx-areas', el).value, recomendaciones: $('#tx-recomendaciones', el).value
    };
  }

  function guardarTextos() {
    var t = textosActuales();
    return Api.llamar('guardarTextosInforme', t).then(function () {
      S.textosSucios = false;
      S.coachee.logros = t.logros; S.coachee.aprendizajes = t.aprendizajes; S.coachee.areas = t.areas; S.coachee.recomendaciones = t.recomendaciones;
    });
  }

  /** El informe se arma con lo que está en la hoja: se guardan antes los textos pendientes. */
  function guardarSiHaceFalta() {
    return S.textosSucios ? guardarTextos() : Promise.resolve();
  }

  /* ---------- informe ---------- */

  function vistaPrevia(ev) {
    var btn = ev.currentTarget;
    btn.disabled = true;
    guardarSiHaceFalta().then(function () {
      return Api.llamar('vistaPreviaInforme', { id: S.id }, { timeout: 120000 });
    }).then(function (r) {
      var m = U.modal('<h2>👁 Vista previa del informe</h2><iframe sandbox title="Vista previa del informe"></iframe>' +
        '<div class="pie-modal"><button type="button" class="btn sec" data-cerrar>Cerrar</button></div>', { ancho: true, enfocar: false });
      m.el.querySelector('iframe').srcdoc = r.html;
      m.el.querySelector('[data-cerrar]').addEventListener('click', m.cerrar);
    }).catch(error).then(function () { btn.disabled = false; });
  }

  function generar(ev) {
    var btn = ev.currentTarget;
    var texto = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generando PDF…';
    guardarSiHaceFalta().then(function () {
      return Api.llamar('generarInforme', { id: S.id }, { timeout: 180000 });
    }).then(function (r) {
      S.coachee.informe = r.url;
      var url = enlaceSeguro(r.url);
      $('#inf-ultimo', el).innerHTML = 'Último informe guardado: ' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">abrir PDF</a>' : esc(r.nombre));
      U.toast('Informe guardado en Drive.', 'ok');
    }).catch(error).then(function () { btn.disabled = false; btn.textContent = texto; });
  }

  function abrirEnvio() {
    var c = S.coachee;
    var m = U.modal(
      '<h2>✉️ Enviar informe por correo</h2>' +
      '<div class="aviso error" id="env-error" hidden role="alert"></div>' +
      '<label class="campo"><span>Destinatario</span><input type="email" id="env-dest" value="' + esc(c.correo) + '" inputmode="email" autocomplete="off"></label>' +
      '<label class="campo"><span>Mensaje <span class="ayuda">(opcional)</span></span><textarea id="env-msg" maxlength="2000" placeholder="Texto que acompañará al informe"></textarea></label>' +
      '<label class="check"><input type="checkbox" id="env-regen"' + (c.informe ? '' : ' checked') + '> Regenerar el PDF con los datos actuales' + (c.informe ? '' : ' (aún no hay uno guardado)') + '</label>' +
      '<div class="pie-modal"><button type="button" class="btn sec" data-cancelar>Cancelar</button><button type="button" class="btn" data-enviar>Enviar</button></div>');
    var err = $('#env-error', m.el);
    $('[data-cancelar]', m.el).addEventListener('click', m.cerrar);
    $('[data-enviar]', m.el).addEventListener('click', function (ev) {
      var btn = ev.currentTarget;
      var dest = $('#env-dest', m.el).value.trim();
      err.hidden = true;
      if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(dest)) { err.hidden = false; err.textContent = 'Escribe un correo de destinatario válido (uno solo).'; return; }
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      guardarSiHaceFalta().then(function () {
        return Api.llamar('enviarInforme', {
          id: S.id, destinatario: dest, mensaje: $('#env-msg', m.el).value.trim(), regenerar: $('#env-regen', m.el).checked
        }, { timeout: 180000 });
      }).then(function (r) {
        if (r.url) S.coachee.informe = r.url;
        m.cerrar();
        U.toast('Informe enviado a ' + r.destinatario + '.', 'ok');
        var url = enlaceSeguro(S.coachee.informe);
        if (url) $('#inf-ultimo', el).innerHTML = 'Último informe guardado: <a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">abrir PDF</a>';
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = 'Enviar';
        err.hidden = false;
        err.textContent = e.message;
      });
    });
  }

  return { mostrar: mostrar };
})();
