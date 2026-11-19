/* vistas/medicion.js — 📝 Registrar medición (pensada para celular), en 3 pasos dentro de la misma página:
 *   1) elegir coachee  →  2) elegir momento  →  3) formulario con barras deslizables 1-5.
 * Nada de esto cambia la URL ni recarga la página. */
Vistas.medicion = (function () {
  'use strict';

  var esc = U.esc, $ = U.$;
  var el = null;
  var S = nuevoEstado();

  function nuevoEstado() {
    return { paso: 1, busqueda: '', coachee: null, momento: null, filas: [], valores: {}, fecha: '', sucio: false, guardando: false };
  }

  function haySinGuardar() { return S.paso === 3 && S.sucio; }
  function descartar() { S = nuevoEstado(); }

  /* ---------- entrada ---------- */

  function mostrar(contenedor, opciones) {
    el = contenedor;
    S = nuevoEstado();
    // Soltar la barra sin moverla (p. ej. dejarla en 3) también califica; se enlaza una sola vez.
    if (!el.getAttribute('data-pu')) {
      el.setAttribute('data-pu', '1');
      el.addEventListener('pointerup', soltarDeslizador);
    }
    el.innerHTML = '<h1>📝 Registrar medición</h1><div class="cargando">Cargando…</div>';
    return App.cargarCoachees(true).then(function (lista) {
      if (opciones && opciones.c) {
        var c = porId(lista, opciones.c);
        if (c) {
          S.coachee = c;
          S.paso = 2;
          if (opciones.m) {
            return abrirMomento(opciones.m).catch(function (e) {
              U.toast(e.message, 'error');
              S.paso = 2;
              pintar();
            });
          }
        } else {
          U.toast('No se encontró el coachee del enlace.', 'error');
        }
      }
      pintar();
    });
  }

  function porId(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }

  function pintar() {
    if (S.paso === 1) pintarPaso1();
    else if (S.paso === 2) pintarPaso2();
    else pintarPaso3();
  }

  function indicadorPasos() {
    var nombres = ['Coachee', 'Momento', 'Medición'];
    return '<div class="paso-titulo">' + nombres.map(function (n, i) {
      var activo = S.paso === i + 1;
      return '<span style="display:inline-flex;align-items:center;gap:6px;opacity:' + (activo ? 1 : .55) + '"><span class="num"' + (activo ? '' : ' style="background:#9aa1a7"') + '>' + (i + 1) + '</span><b>' + n + '</b></span>' + (i < 2 ? '<span class="sub">›</span>' : '');
    }).join('') + '</div>';
  }

  /* ---------- paso 1: coachee ---------- */

  function pintarPaso1() {
    el.innerHTML =
      '<div class="encabezado-vista"><h1>📝 Registrar medición</h1></div>' + indicadorPasos() +
      '<div class="herramientas">' +
      '<input type="search" id="me-buscar" placeholder="Buscar coachee…" value="' + esc(S.busqueda) + '" aria-label="Buscar coachee" autocomplete="off">' +
      '<label class="check"><input type="checkbox" id="me-solo"' + (App.soloMios() ? ' checked' : '') + '> Solo mis coachees</label></div>' +
      '<div id="me-lista"></div>';
    $('#me-buscar', el).addEventListener('input', U.debounce(function (e) { S.busqueda = e.target.value; pintarLista1(); }, 150));
    $('#me-solo', el).addEventListener('change', function (e) { App.fijarSoloMios(e.target.checked); pintarLista1(); });
    el.onclick = function (e) {
      var b = e.target.closest('[data-coachee]');
      if (!b) return;
      S.coachee = porId(App.estado.coachees || [], b.getAttribute('data-coachee'));
      if (S.coachee) { S.paso = 2; pintar(); window.scrollTo(0, 0); }
    };
    el.onchange = null;
    el.oninput = null;
    pintarLista1();
  }

  function pintarLista1() {
    var cont = $('#me-lista', el);
    if (!cont) return;
    var correo = App.usuario() ? App.usuario().correo : '';
    var solo = App.soloMios();
    var q = U.norm(S.busqueda);
    var lista = (App.estado.coachees || []).filter(function (c) {
      if (c.estado === 'Cerrado') return false;
      if (solo && c.coach !== correo) return false;
      return !q || U.norm(c.nombre + ' ' + c.cargo).indexOf(q) >= 0;
    }).sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });

    if (!lista.length) {
      cont.innerHTML = '<div class="tarjeta vacio">' +
        ((App.estado.coachees || []).length ? 'Ningún coachee coincide con la búsqueda.' : 'Todavía no hay coachees. Créalos en la sección 👥 Coachees.') + '</div>';
      return;
    }
    cont.innerHTML = '<div class="tarjeta"><div class="lista">' + lista.map(function (c) {
      var hechos = Calculos.MOMENTOS.filter(function (m) { return c.real[m]; }).length;
      return '<div class="fila clic" data-coachee="' + esc(c.id) + '" tabindex="0" role="button">' +
        '<div class="info"><b>' + esc(c.nombre) + '</b><span class="sub">' + esc(c.cargo || 'Sin cargo') + '</span></div>' +
        '<div style="text-align:right"><span class="puntos" title="Línea base, M1, M2 y MF">' +
        Calculos.MOMENTOS.map(function (m) { return '<i class="' + (c.real[m] ? 'on' : '') + '"></i>'; }).join('') +
        '</span><div class="sub">' + hechos + '/4 mediciones</div></div></div>';
    }).join('') + '</div></div>';
    // Enter / espacio sobre una fila
    cont.onkeydown = function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var b = e.target.closest && e.target.closest('[data-coachee]');
      if (b) { e.preventDefault(); b.click(); }
    };
  }

  /* ---------- paso 2: momento ---------- */

  function pintarPaso2() {
    var c = S.coachee;
    el.innerHTML =
      '<div class="encabezado-vista"><h1>📝 Registrar medición</h1></div>' + indicadorPasos() +
      '<div class="acciones-fila" style="margin-bottom:12px"><button type="button" class="btn sec peq" id="me-atras">← Cambiar coachee</button></div>' +
      '<div class="tarjeta"><h2 style="margin-bottom:2px">' + esc(c.nombre) + '</h2><div class="sub">' + esc(c.cargo || 'Sin cargo') + '</div></div>' +
      '<h2>¿Qué momento vas a medir?</h2><div class="grid c4">' +
      Calculos.MOMENTOS.map(function (m) {
        var hecho = !!c.real[m];
        var detalle = hecho ? '✅ Realizada el ' + U.fecha(c.real[m])
          : (c.prog[m] ? '🗓️ Programada para el ' + U.fecha(c.prog[m]) : 'Sin fecha programada');
        return '<button type="button" class="momento btn-momento' + (hecho ? ' hecho' : '') + '" data-momento="' + m + '">' +
          '<b>' + esc(Calculos.NOMBRE_MOMENTO[m]) + '</b><div class="fechas">' + esc(detalle) + '</div>' +
          '<span class="chip ' + (hecho ? 'ok' : 'azul') + '">' + (hecho ? 'Editar' : 'Registrar') + '</span></button>';
      }).join('') + '</div>';

    $('#me-atras', el).addEventListener('click', function () { S.paso = 1; S.coachee = null; pintar(); });
    el.onclick = function (e) {
      var b = e.target.closest('[data-momento]');
      if (b) abrirMomento(b.getAttribute('data-momento')).catch(function (err) { U.toast(err.message, 'error'); });
    };
    el.onchange = null;
    el.oninput = null;
  }

  /* ---------- paso 3: formulario ---------- */

  function abrirMomento(m) {
    var c = S.coachee;
    return Api.llamar('obtenerEvaluacion', { id: c.id }).then(function (r) {
      S.filas = r.filas;
      S.momento = m;
      S.valores = {};
      var k = m.toLowerCase();
      r.filas.forEach(function (f) {
        S.valores[f.codigo] = { v: f[k] === null || f[k] === undefined ? null : Number(f[k]), ev: f.ev[m] || '' };
      });
      S.fecha = c.real[m] || U.hoy();
      S.sucio = false;
      S.paso = 3;
      pintar();
      window.scrollTo(0, 0);
    });
  }

  /** Puntaje de la medición anterior (la más reciente anterior a este momento que tenga dato). */
  function referencia(fila) {
    var orden = Calculos.MOMENTOS;
    for (var i = orden.indexOf(S.momento) - 1; i >= 0; i--) {
      var v = fila[orden[i].toLowerCase()];
      if (v !== null && v !== undefined) return { valor: v, momento: orden[i] };
    }
    return null;
  }

  function pintarPaso3() {
    var c = S.coachee;
    var grupos = [];
    var porHab = {};
    S.filas.forEach(function (f) {
      if (!porHab[f.habilidad]) { porHab[f.habilidad] = []; grupos.push(f.habilidad); }
      porHab[f.habilidad].push(f);
    });

    var html =
      '<div class="encabezado-vista"><h1>📝 Registrar medición</h1></div>' + indicadorPasos() +
      '<div class="acciones-fila" style="margin-bottom:12px"><button type="button" class="btn sec peq" id="me-atras">← Cambiar momento</button></div>' +
      '<div class="tarjeta"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div><h2 style="margin-bottom:2px">' + esc(c.nombre) + '</h2><div class="sub">' + esc(Calculos.NOMBRE_MOMENTO[S.momento]) +
      (c.prog[S.momento] ? ' · programada ' + esc(U.fecha(c.prog[S.momento])) : '') + '</div></div>' +
      '<label class="campo" style="margin:0;min-width:170px"><span>Fecha real de la medición</span><input type="date" id="me-fecha" value="' + esc(S.fecha) + '"></label></div></div>';

    grupos.forEach(function (h) {
      html += '<div class="grupo-hab"><h3>🧩 ' + esc(h) + '</h3>' + porHab[h].map(bloqueIndicador).join('') + '</div>';
    });

    html += '<div class="pie-fijo"><div class="prog"><b id="me-cuenta"></b>' +
      '<div style="margin-top:4px" id="me-barra"></div></div>' +
      '<button type="button" class="btn" id="me-guardar">💾 Guardar</button></div>';

    el.innerHTML = html;
    S.filas.forEach(function (f) { refrescarIndicador(f.codigo); });
    refrescarProgreso();

    $('#me-atras', el).addEventListener('click', volverAMomentos);
    el.onclick = clicFormulario;
    el.oninput = entradaFormulario;
    el.onchange = entradaFormulario;
    $('#me-guardar', el).addEventListener('click', guardar);
  }

  function bloqueIndicador(f) {
    var ref = referencia(f);
    var textoRef;
    if (ref) {
      var inf = App.nivelInfo(ref.valor);
      textoRef = 'Anterior (' + Calculos.NOMBRE_MOMENTO[ref.momento] + '): <b>' + esc(ref.valor) + '</b> · ' + esc(inf.nivel);
    } else {
      textoRef = S.momento === 'LB' ? 'Primera medición del proceso' : 'Sin medición anterior';
    }
    var val = S.valores[f.codigo];
    var conEvidencia = val && val.ev;
    return '<div class="ind" data-cod="' + esc(f.codigo) + '">' +
      '<div class="tit"><span class="cod">' + esc(f.codigo) + '</span>' + esc(f.indicador) + '</div>' +
      '<div class="ref">' + textoRef + ' · Meta: <b>' + esc(f.meta === null ? '—' : f.meta) + '</b></div>' +
      '<input type="range" class="rango" min="1" max="5" step="1" value="3" aria-label="Calificación de ' + esc(f.codigo) + ' (1 a 5)">' +
      '<div class="marcas"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>' +
      '<div class="resultado"><span class="valor" data-valor>—</span><span data-nivel></span>' +
      '<button type="button" class="link" data-quitar hidden>Quitar</button></div>' +
      '<div class="desc" data-desc></div>' +
      '<button type="button" class="link" data-evid-toggle>' + (conEvidencia ? '− Evidencia' : '+ Evidencia (opcional)') + '</button>' +
      '<textarea class="evid" data-evid maxlength="1000" placeholder="Evidencia: situación, frase o resultado que sostiene la calificación"' + (conEvidencia ? '' : ' hidden') + '>' + esc(val ? val.ev : '') + '</textarea>' +
      '</div>';
  }

  function bloque(cod) {
    var bs = el.querySelectorAll('.ind');
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-cod') === cod) return bs[i];
    return null;
  }

  /** Pinta el estado de un indicador: gris y "Sin calificar" hasta que se mueve la barra. */
  function refrescarIndicador(cod) {
    var b = bloque(cod);
    if (!b) return;
    var estado = S.valores[cod];
    var rango = b.querySelector('.rango');
    var nivel = b.querySelector('[data-nivel]');
    var valor = b.querySelector('[data-valor]');
    var desc = b.querySelector('[data-desc]');
    var quitar = b.querySelector('[data-quitar]');
    if (estado.v === null) {
      rango.className = 'rango';
      rango.value = '3';
      valor.textContent = '—';
      nivel.innerHTML = '<span class="chip gris">Sin calificar</span>';
      desc.textContent = '';
      quitar.hidden = true;
    } else {
      var info = App.nivelInfo(estado.v);
      rango.className = 'rango n' + estado.v;
      rango.value = String(estado.v);
      valor.textContent = String(estado.v);
      nivel.innerHTML = U.chipNivel(info.nivel, estado.v);
      desc.textContent = info.descripcion || '';
      quitar.hidden = false;
    }
  }

  function calificados() {
    var n = 0;
    S.filas.forEach(function (f) { if (S.valores[f.codigo] && S.valores[f.codigo].v !== null) n++; });
    return n;
  }

  function refrescarProgreso() {
    var n = calificados(), total = S.filas.length;
    var cuenta = $('#me-cuenta', el), barra = $('#me-barra', el);
    if (cuenta) cuenta.textContent = n + '/' + total + ' calificados';
    if (barra) barra.innerHTML = U.barra(total ? n / total : 0, n === total ? 'verde' : '');
  }

  function fijar(cod, valor) {
    if (!S.valores[cod]) return;
    S.valores[cod].v = valor;
    S.sucio = true;
    refrescarIndicador(cod);
    refrescarProgreso();
  }

  function codDe(nodo) {
    var b = nodo.closest ? nodo.closest('.ind') : null;
    return b ? b.getAttribute('data-cod') : null;
  }

  /** Mover la barra (o tocarla) califica el indicador. */
  function entradaFormulario(e) {
    var t = e.target;
    if (t.classList && t.classList.contains('rango')) {
      var cod = codDe(t);
      if (cod) fijar(cod, Number(t.value));
    } else if (t.hasAttribute && t.hasAttribute('data-evid')) {
      var c2 = codDe(t);
      if (c2 && S.valores[c2]) { S.valores[c2].ev = t.value; S.sucio = true; }
    } else if (t.id === 'me-fecha') {
      S.fecha = t.value;
      S.sucio = true;
    }
  }

  /** Tocar la barra sin moverla (p. ej. dejarla en 3) también cuenta como calificar. */
  function soltarDeslizador(e) {
    var t = e.target;
    if (t.classList && t.classList.contains('rango')) {
      var cod = codDe(t);
      if (cod) fijar(cod, Number(t.value));
    }
  }

  function clicFormulario(e) {
    var t = e.target;
    var q = t.closest('[data-quitar]');
    if (q) { fijar(codDe(q), null); return; }
    var tg = t.closest('[data-evid-toggle]');
    if (tg) {
      var b = tg.closest('.ind');
      var area = b.querySelector('[data-evid]');
      area.hidden = !area.hidden;
      tg.textContent = area.hidden ? '+ Evidencia (opcional)' : '− Evidencia';
      if (!area.hidden) area.focus();
    }
  }

  function volverAMomentos() {
    var seguir = S.sucio
      ? U.confirmar('Tienes cambios sin guardar. Si vuelves, se perderán.', { titulo: 'Cambios sin guardar', si: 'Volver sin guardar', no: 'Seguir editando', peligro: true })
      : Promise.resolve(true);
    seguir.then(function (ok) {
      if (!ok) return;
      S.sucio = false;
      S.paso = 2;
      pintar();
    });
  }

  /* ---------- guardar ---------- */

  function guardar() {
    if (S.guardando) return;
    var n = calificados(), total = S.filas.length;
    if (!S.fecha || !Calculos.parseISO(S.fecha)) { U.toast('Escribe la fecha real de la medición.', 'error'); return; }
    if (n === 0) { U.toast('Califica al menos un indicador antes de guardar.', 'error'); return; }
    var paso = Promise.resolve(true);
    if (n < total) {
      paso = U.confirmar('Faltan ' + (total - n) + ' de ' + total + ' indicadores por calificar. ¿Quieres guardar la medición incompleta?', {
        titulo: 'Medición incompleta', si: 'Guardar incompleta', no: 'Seguir calificando'
      });
    }
    paso.then(function (ok) {
      if (!ok) return;
      S.guardando = true;
      var btn = $('#me-guardar', el);
      btn.disabled = true;
      btn.textContent = 'Guardando…';
      var mediciones = S.filas.map(function (f) {
        var v = S.valores[f.codigo];
        return { codigo: f.codigo, valor: v.v, evidencia: v.ev };
      });
      return Api.llamar('guardarMedicion', { id: S.coachee.id, momento: S.momento, fecha: S.fecha, mediciones: mediciones }).then(function () {
        S.sucio = false;
        return App.cargarCoachees(true);
      }).then(function (lista) {
        S.coachee = porId(lista, S.coachee.id) || S.coachee;
        S.guardando = false;
        S.paso = 2;
        pintar();
        window.scrollTo(0, 0);
        U.toast('Medición guardada (' + n + '/' + total + ').', 'ok');
      }).catch(function (e) {
        S.guardando = false;
        var b2 = $('#me-guardar', el);
        if (b2) { b2.disabled = false; b2.textContent = '💾 Guardar'; }
        U.toast(e.message, 'error');
      });
    });
  }

  return { mostrar: mostrar, haySinGuardar: haySinGuardar, descartar: descartar };
})();
