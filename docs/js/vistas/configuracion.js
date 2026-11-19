/* vistas/configuracion.js — ⚙️ Configuración del programa, coaches con acceso y enlace de la app.
 * La imagen de fondo NO se configura aquí: solo en la hoja Configuración. */
Vistas.configuracion = (function () {
  'use strict';

  var esc = U.esc, $ = U.$;
  var el = null;

  function mostrar(contenedor) {
    el = contenedor;
    el.innerHTML = '<h1>⚙️ Configuración</h1><div class="cargando">Cargando…</div>';
    return Api.llamar('obtenerConfiguracion').then(pintar);
  }

  /** Enlace de la app: el guardado en la hoja o, si no hay, la dirección actual sin parámetros. */
  function enlaceApp(cfg) {
    if (cfg.enlaceApp) return cfg.enlaceApp;
    return window.location.origin + window.location.pathname;
  }

  function pintar(r) {
    var c = r.config;
    var enlace = enlaceApp(c);
    var coachesHtml = (r.coaches || []).length
      ? '<div class="lista">' + r.coaches.map(function (k) {
        return '<div class="fila"><div class="info"><b>' + esc(k.nombre) + '</b><span class="sub">' + esc(k.correo) + '</span></div></div>';
      }).join('') + '</div>'
      : '<div class="vacio">No hay coaches registrados.</div>';

    el.innerHTML =
      '<div class="encabezado-vista"><h1>⚙️ Configuración</h1></div>' +
      '<form class="tarjeta" id="cf-form" novalidate>' +
      '<h2>Programa</h2>' +
      '<div class="aviso error" id="cf-error" hidden role="alert"></div>' +
      '<div class="fila-campos">' +
      '<label class="campo"><span>Nombre del programa</span><input type="text" id="cf-programa" maxlength="120" value="' + esc(c.programa) + '"></label>' +
      '<label class="campo"><span>Organización</span><input type="text" id="cf-org" maxlength="120" value="' + esc(c.organizacion) + '"></label>' +
      '</div>' +
      '<label class="campo"><span>Carpeta de informes (enlace de Drive)</span>' +
      '<div class="con-boton"><input type="text" id="cf-carpeta" value="' + esc(c.carpeta) + '" placeholder="https://drive.google.com/drive/folders/…" autocomplete="off">' +
      '<button type="button" class="btn sec" id="cf-verificar">Verificar</button></div>' +
      '<span class="ayuda" id="cf-carpeta-msg">Los informes en PDF se guardan aquí. La carpeta debe estar accesible para la cuenta propietaria del sistema.</span></label>' +
      '<div class="fila-campos">' +
      '<label class="campo"><span>Meta sugerida por indicador (1 a 5)</span><input type="number" id="cf-meta" min="1" max="5" step="1" value="' + esc(c.meta) + '" inputmode="numeric"></label>' +
      '<label class="campo"><span>Duración por defecto del proceso (meses)</span><input type="number" id="cf-duracion" min="1" max="60" step="1" value="' + esc(c.duracion) + '" inputmode="numeric"></label>' +
      '</div>' +
      '<label class="campo"><span>Nombre del remitente en los correos</span><input type="text" id="cf-remitente" maxlength="80" value="' + esc(c.remitente) + '"></label>' +
      '<button type="submit" class="btn" id="cf-guardar">Guardar configuración</button></form>' +

      '<div class="tarjeta"><h2>👥 Coaches con acceso</h2>' + coachesHtml +
      '<p class="sub" style="margin-top:10px">Los coaches, su correo y su contraseña inicial los administra el responsable del sistema en la hoja Coaches.</p></div>' +

      '<div class="tarjeta"><h2>🔗 Enlace de la app</h2>' +
      '<div class="copiar"><input type="text" id="cf-enlace" readonly value="' + esc(enlace) + '" aria-label="Enlace de la app">' +
      '<button type="button" class="btn sec" id="cf-copiar">📋 Copiar</button></div>' +
      '<p class="sub" style="margin-top:8px">Este enlace abre directamente en 📝 Registrar medición. Con <code>?v=admin</code> abre en el 📊 Tablero.</p></div>';

    $('#cf-verificar', el).addEventListener('click', verificar);
    $('#cf-form', el).addEventListener('submit', function (ev) { ev.preventDefault(); guardar(c); });
    $('#cf-copiar', el).addEventListener('click', function () {
      var campo = $('#cf-enlace', el);
      campo.select();
      var ok = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(campo.value).then(function () { U.toast('Enlace copiado.', 'ok'); }, function () {
          try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
          U.toast(ok ? 'Enlace copiado.' : 'Selecciona el enlace y cópialo manualmente.', ok ? 'ok' : '');
        });
      } else {
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        U.toast(ok ? 'Enlace copiado.' : 'Selecciona el enlace y cópialo manualmente.', ok ? 'ok' : '');
      }
    });
  }

  function verificar(ev) {
    var btn = ev.currentTarget;
    var msg = $('#cf-carpeta-msg', el);
    var valor = $('#cf-carpeta', el).value.trim();
    if (!valor) { msg.textContent = 'Pega primero el enlace de la carpeta.'; return; }
    btn.disabled = true;
    msg.textContent = 'Verificando…';
    Api.llamar('verificarCarpeta', { carpeta: valor }).then(function (r) {
      msg.textContent = '✅ Carpeta encontrada: ' + r.nombre;
    }).catch(function (e) {
      msg.textContent = '⚠️ ' + e.message;
    }).then(function () { btn.disabled = false; });
  }

  function guardar(c) {
    var err = $('#cf-error', el);
    function fallo(t) { err.hidden = false; err.textContent = t; err.scrollIntoView({ block: 'center' }); }
    err.hidden = true;
    var programa = $('#cf-programa', el).value.trim();
    var meta = Number($('#cf-meta', el).value);
    var duracion = Number($('#cf-duracion', el).value);
    if (!programa) return fallo('El nombre del programa es obligatorio.');
    if (!(meta >= 1 && meta <= 5 && Math.floor(meta) === meta)) return fallo('La meta sugerida debe ser un entero de 1 a 5.');
    if (!(duracion >= 1 && duracion <= 60 && Math.floor(duracion) === duracion)) return fallo('La duración debe ser un entero de meses entre 1 y 60.');
    var btn = $('#cf-guardar', el);
    btn.disabled = true;
    var payload = {
      programa: programa, organizacion: $('#cf-org', el).value.trim(), carpeta: $('#cf-carpeta', el).value.trim(),
      meta: meta, duracion: duracion, remitente: $('#cf-remitente', el).value.trim()
    };
    // Si la hoja aún no tiene el enlace de la app, se guarda el de este navegador (sin parámetros).
    if (!c.enlaceApp && /^https:\/\//.test(window.location.href)) payload.enlaceApp = window.location.origin + window.location.pathname;
    Api.llamar('guardarConfiguracion', payload).then(function (r) {
      return Api.llamar('catalogos').then(function (cat) {
        App.estado.cat = cat;
        App.aplicarMarca(cat.config);
        U.toast('Configuración guardada.', 'ok');
        pintar(r);
      });
    }).catch(function (e) {
      btn.disabled = false;
      fallo(e.message);
    });
  }

  return { mostrar: mostrar };
})();
