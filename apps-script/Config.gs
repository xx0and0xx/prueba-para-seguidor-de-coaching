/**
 * Config.gs — Constantes, estructura de las hojas y datos por defecto.
 *
 * Nota: las hojas se leen y se escriben SIEMPRE por posición de columna
 * (no por el texto del encabezado), así que el administrador puede cambiar
 * los emojis o el texto de los encabezados, pero NO debe reordenar columnas.
 */

var HOJAS = {
  CONFIG: 'Configuración',
  COACHES: 'Coaches',
  COACHEES: 'Coachees',
  EVAL: 'Evaluación',
  IND: 'Indicadores',
  ESCALA: 'Escala',
  FUND: 'Fundamentación_Teórica',
  TABLERO: 'Tablero'
};

var ESTADOS = ['Activo', 'Cerrado', 'En pausa'];
var MOMENTOS_ = ['LB', 'M1', 'M2', 'MF'];

var MARCA = {
  azul: '#16375c', azulMedio: '#3189ba', azulPalido: '#e8f2f9', azulFondo: '#dceef8', azulOscuro: '#1e1f35',
  verde: '#16a34a', verdeClaro: '#dcfce7', rosa: '#c0464a', rosaClaro: '#fdeaea',
  ambar: '#d97706', ambarClaro: '#fef3c7', gris: '#61605f', fondo: '#f0f4f8', borde: '#cddce8'
};

/** Colores por nivel de la escala: [fondo, texto]. */
var COLOR_NIVEL = {
  1: ['#fdeaea', '#c0464a'],
  2: ['#fef3c7', '#d97706'],
  3: ['#e8f2f9', '#16375c'],
  4: ['#dcfce7', '#16a34a'],
  5: ['#3189ba', '#ffffff']
};

/** Encabezados (con emoji) de cada hoja. */
var ENC = {
  CONFIG: ['🔑 Clave', '💡 Valor'],
  COACHES: ['✉️ Correo', '🧑 Nombre', '🔒 Contraseña'],
  COACHEES: [
    '🆔 ID', '👤 Nombre', '💼 Cargo', '✉️ Correo', '🎓 Coach (correo)', '🎯 Objetivo', '⏳ Duración (meses)', '📅 Inicio',
    '📍 Fecha real LB', '📍 Fecha real M1', '📍 Fecha real M2', '📍 Fecha real MF', '📌 Estado',
    '🏆 Logros', '💡 Aprendizajes', '🌱 Áreas a fortalecer', '🧭 Recomendaciones', '📄 Informe',
    '🗓️ Fecha programada LB', '🗓️ Fecha programada M1', '🗓️ Fecha programada M2', '🗓️ Fecha programada MF'
  ],
  EVAL: [
    '🆔 ID', '👤 Nombre', '🔢 Código', '🧩 Habilidad', '📋 Indicador',
    '📍 Línea base', '📍 Medición 1', '📍 Medición 2', '📍 Medición final', '🎯 Meta',
    '⚡ Puntaje actual', '⚡ Variación', '⚡ % avance', '⚡ Estado',
    '📝 Evidencia LB', '📝 Evidencia M1', '📝 Evidencia M2', '📝 Evidencia MF'
  ],
  IND: ['🔢 Código', '🧩 Habilidad', '📋 Indicador', '🎯 Meta', '↕️ Orden'],
  ESCALA: ['🔢 Valor', '🏷️ Nivel', '📖 Descripción'],
  FUND: ['↕️ Orden', '🖼️ Ícono', '🗂️ Categoría', '📚 Título', '📝 Resumen', '📄 Contenido', '👁️ Visible (Sí/No)']
};

/** Posición (base 0) de cada campo en las filas de Coachees y Evaluación. */
var COL_COACHEE = {
  id: 0, nombre: 1, cargo: 2, correo: 3, coach: 4, objetivo: 5, duracion: 6, inicio: 7,
  realLB: 8, realM1: 9, realM2: 10, realMF: 11, estado: 12,
  logros: 13, aprendizajes: 14, areas: 15, recomendaciones: 16, informe: 17,
  progLB: 18, progM1: 19, progM2: 20, progMF: 21
};
var N_COL_COACHEE = 22;

var COL_EVAL = {
  id: 0, nombre: 1, codigo: 2, habilidad: 3, indicador: 4,
  lb: 5, m1: 6, m2: 7, mf: 8, meta: 9,
  actual: 10, variacion: 11, avance: 12, estado: 13,
  evLB: 14, evM1: 15, evM2: 16, evMF: 17
};
var N_COL_EVAL = 18;

/**
 * Filas de la hoja Configuración. `prefijo` es el inicio (normalizado: minúsculas,
 * sin tildes ni emojis) del texto de la clave, para encontrar la fila aunque el
 * administrador cambie el emoji o la redacción del final.
 */
var CONFIG_DEF = [
  { k: 'programa',   prefijo: 'nombre del programa',    etiqueta: '🏷️ Nombre del programa',                         def: 'Avance en Coaching Ejecutivo' },
  { k: 'organizacion', prefijo: 'organizacion',         etiqueta: '🏢 Organización',                                def: 'Training Skills' },
  { k: 'carpeta',    prefijo: 'carpeta de informes',    etiqueta: '📁 Carpeta de informes (enlace de Drive)',       def: '' },
  { k: 'meta',       prefijo: 'meta sugerida',          etiqueta: '🎯 Meta sugerida por indicador (1 a 5)',         def: 4 },
  { k: 'duracion',   prefijo: 'duracion por defecto',   etiqueta: '⏳ Duración por defecto del proceso (meses)',    def: 9 },
  { k: 'remitente',  prefijo: 'nombre del remitente',   etiqueta: '✉️ Nombre del remitente en los correos',         def: 'Training Skills' },
  { k: 'imagen',     prefijo: 'imagen de fondo',        etiqueta: '🖼️ Imagen de fondo (enlace)',                    def: '' },
  { k: 'intensidad', prefijo: 'intensidad',             etiqueta: '🌫️ Intensidad de la imagen de fondo (%)',        def: 12 },
  { k: 'enlaceApp',  prefijo: 'enlace de la app',       etiqueta: '🔗 Enlace de la app',                            def: '' }
];

/** [código, habilidad, indicador] — 18 indicadores por defecto (meta 4). */
function indicadoresDefecto_() {
  return [
    ['E1', 'Escucha', 'Escucha sin interrumpir: deja terminar las ideas y tolera los silencios'],
    ['E2', 'Escucha', 'Escucha el fondo: capta emociones, valores e intenciones detrás de lo dicho'],
    ['E3', 'Escucha', 'Parafrasea y verifica comprensión antes de responder'],
    ['P1', 'Pregunta', 'Formula preguntas abiertas (qué, cómo, para qué) en lugar de cerradas o inductivas'],
    ['P2', 'Pregunta', 'Hace preguntas poderosas que generan reflexión y nuevas perspectivas'],
    ['P3', 'Pregunta', 'Dirige las preguntas hacia la acción y los resultados, no hacia la justificación'],
    ['R1', 'Rapport', 'Genera confianza y un clima de seguridad para que el otro se exprese'],
    ['R2', 'Rapport', 'Sincroniza lenguaje, ritmo y tono con su interlocutor'],
    ['R3', 'Rapport', 'Respeta y valida el modelo del mundo del otro aunque no lo comparta'],
    ['C1', 'Calibración', 'Lee señales no verbales (tono, postura, gestos, respiración)'],
    ['C2', 'Calibración', 'Detecta cambios de estado emocional en el otro y ajusta su conducta'],
    ['C3', 'Calibración', 'Distingue hechos de interpretaciones y verifica con el otro'],
    ['O1', 'Foco en resultados', 'Define metas claras, medibles y con fecha'],
    ['O2', 'Foco en resultados', 'Convierte los insights en compromisos de acción concretos'],
    ['O3', 'Foco en resultados', 'Hace seguimiento a sus compromisos y rinde cuentas'],
    ['A1', 'Autogestión y feedback', 'Regula sus emociones en conversaciones difíciles'],
    ['A2', 'Autogestión y feedback', 'Da y recibe feedback de forma abierta y constructiva'],
    ['A3', 'Autogestión y feedback', 'Se autoobserva y reflexiona sobre su propio impacto']
  ];
}

var HABILIDADES_INFO_ = [
  {
    nombre: 'Escucha', icono: '👂',
    def: 'Dar al otro atención plena para comprender no solo lo que dice, sino lo que significa para él.',
    frase: 'Se escucha para comprender, no para responder.',
    observar: [
      'Cuántas veces interrumpe o completa las frases del otro.',
      'Si capta emociones, valores e intenciones además de los datos.',
      'Si parafrasea y verifica antes de dar su opinión.'
    ],
    atencion: 'Escuchar en silencio no es lo mismo que escuchar con atención: observa también qué hace con lo que escuchó.'
  },
  {
    nombre: 'Pregunta', icono: '❓',
    def: 'Usar preguntas para abrir perspectivas, provocar reflexión y orientar al otro hacia la acción.',
    frase: 'Una buena pregunta vale más que un buen consejo.',
    observar: [
      'Proporción de preguntas abiertas frente a cerradas o inductivas.',
      'Si sus preguntas generan pausas de reflexión o ideas nuevas.',
      'Si cierra con preguntas orientadas a la acción y al resultado.'
    ],
    atencion: 'Las preguntas que empiezan con "¿por qué?" suelen invitar a justificarse; prefiere "qué", "cómo" y "para qué".'
  },
  {
    nombre: 'Rapport', icono: '🤝',
    def: 'Construir un vínculo de confianza y seguridad en el que el otro puede expresarse con libertad.',
    frase: 'Sin confianza no hay conversación profunda.',
    observar: [
      'Si el otro se muestra abierto y relajado al conversar.',
      'Si ajusta lenguaje, ritmo y tono a los de su interlocutor.',
      'Si valida el punto de vista del otro aunque no lo comparta.'
    ],
    atencion: 'Sincronizar no es imitar de forma mecánica: debe sentirse natural para el otro.'
  },
  {
    nombre: 'Calibración', icono: '🔍',
    def: 'Leer con precisión las señales verbales y no verbales del otro y ajustar la propia conducta en consecuencia.',
    frase: 'Lo que se observa informa; lo que se interpreta debe verificarse.',
    observar: [
      'Si nota cambios de tono, postura, gestos o respiración.',
      'Si ajusta su conducta cuando cambia el estado emocional del otro.',
      'Si separa lo que ve de lo que supone y lo confirma con el otro.'
    ],
    atencion: 'Evita calificar por intuición: anota la señal concreta que observaste.'
  },
  {
    nombre: 'Foco en resultados', icono: '🏁',
    def: 'Orientar la conversación a metas claras y compromisos concretos, y sostener el seguimiento en el tiempo.',
    frase: 'Un insight sin acción se queda en conversación.',
    observar: [
      'Si las metas son claras, medibles y tienen fecha.',
      'Si convierte lo descubierto en compromisos de acción.',
      'Si hace seguimiento a sus compromisos y rinde cuentas.'
    ],
    atencion: 'Revisa el cumplimiento real de los compromisos anteriores antes de calificar.'
  },
  {
    nombre: 'Autogestión y feedback', icono: '🪞',
    def: 'Regularse emocionalmente, dar y recibir feedback con apertura y observar el propio impacto en los demás.',
    frase: 'Quien se observa a sí mismo puede cambiar.',
    observar: [
      'Cómo reacciona en conversaciones difíciles o bajo presión.',
      'Si da feedback constructivo y recibe el ajeno sin ponerse a la defensiva.',
      'Si reflexiona sobre el impacto que genera en los demás.'
    ],
    atencion: 'La autoobservación se evidencia también en lo que el coachee dice de sí mismo, no solo en lo que hace.'
  }
];

/**
 * 10 tarjetas iniciales de Fundamentación teórica: [orden, ícono, categoría, título, resumen, contenido, visible].
 * Formato del contenido (una instrucción por línea):
 *   ## Subtítulo · 1. Paso · > Frase destacada (recuadro azul) · ! Atención (recuadro ámbar) · - Viñeta · otra línea = párrafo.
 */
function fundamentacionDefecto_() {
  var inds = indicadoresDefecto_();
  var filas = [];

  filas.push([1, '🎯', 'Introducción', '¿Qué mide esta herramienta?',
    'Mide el avance conductual del coachee en 18 indicadores agrupados en 6 habilidades de comunicación y liderazgo.',
    [
      '## Un proceso, cuatro momentos',
      'La herramienta registra qué tanto evidencia el coachee 18 conductas observables a lo largo del proceso de coaching: una línea base, dos mediciones intermedias y una medición final.',
      '> Lo que se mide es conducta observable, no intención ni opinión.',
      '## Las seis habilidades',
      '- Escucha',
      '- Pregunta',
      '- Rapport',
      '- Calibración',
      '- Foco en resultados',
      '- Autogestión y feedback',
      '## Para qué sirve',
      '- Dar al coachee una imagen clara de dónde está y hacia dónde avanza.',
      '- Orientar las conversaciones de coaching hacia las conductas con mayor oportunidad.',
      '- Documentar el resultado del proceso en un informe final.',
      '! La medición la diligencia el coach, a veces acompañado del coachee; el coachee nunca evalúa solo.'
    ].join('\n'), 'Sí']);

  filas.push([2, '📏', 'Escala', 'Escala de calificación',
    'Cada conducta se califica de 1 a 5 según qué tan consistente es.',
    [
      '## Cinco niveles',
      '1. No evidenciado: no muestra la conducta; no es consciente de ella.',
      '2. Incipiente: la muestra de forma ocasional y con mucha guía.',
      '3. En desarrollo: la aplica con esfuerzo en situaciones favorables; se le escapa bajo presión.',
      '4. Competente: la aplica de forma consistente, también en situaciones exigentes.',
      '5. Maestría: es natural, la modela y la contagia a otros.',
      '> Se califica lo que se observa de forma consistente, no el mejor momento del coachee.',
      '! Califica siempre con evidencia concreta: una situación, una frase, un resultado.'
    ].join('\n'), 'Sí']);

  var orden = 3;
  HABILIDADES_INFO_.forEach(function (h) {
    var lineas = ['## ¿Qué es?', h.def, '## Indicadores'];
    inds.forEach(function (i) { if (i[1] === h.nombre) lineas.push('- ' + i[0] + ' · ' + i[2]); });
    lineas.push('> ' + h.frase);
    lineas.push('## Cómo observarla');
    h.observar.forEach(function (o, n) { lineas.push((n + 1) + '. ' + o); });
    lineas.push('! ' + h.atencion);
    filas.push([orden++, h.icono, 'Habilidad', h.nombre, h.def, lineas.join('\n'), 'Sí']);
  });

  filas.push([9, '🧮', 'Resultados', '¿Cómo se calculan los resultados?',
    'Las mismas reglas se aplican en la hoja de cálculo y en la app.',
    [
      '## Por indicador',
      '1. Puntaje actual: la última medición registrada (medición final; si no hay, la 2; si no, la 1; si no, la línea base).',
      '2. Variación: puntaje actual menos línea base.',
      '3. % de avance: (actual − línea base) ÷ (meta − línea base), con tope de 100 %. Si el actual alcanza la meta, el avance es 100 %.',
      '4. Estado: Meta lograda (actual ≥ meta), En camino (avance ≥ 50 %) o Prioridad (avance < 50 %).',
      '## Por habilidad y global',
      '- El puntaje es el promedio de los indicadores.',
      '- El % de avance es el promedio de los % de avance de cada indicador.',
      '- El índice de desarrollo es el promedio dividido entre 5.',
      '- El nivel es el de la escala para el promedio redondeado hacia abajo (3,7 corresponde a En desarrollo).',
      '> El avance mide cuánto del camino hacia la meta se ha recorrido, no solo el puntaje.',
      '! Si el puntaje baja respecto a la línea base, el avance se muestra como 0 %.'
    ].join('\n'), 'Sí']);

  filas.push([10, '📅', 'Proceso', 'Calendario y fuentes de evidencia',
    'Cuándo medir y de dónde sale la evidencia para calificar.',
    [
      '## Calendario de mediciones',
      '- Línea base (LB): al iniciar el proceso.',
      '- Medición 1 (M1): a los 3 meses.',
      '- Medición 2 (M2): a los 6 meses.',
      '- Medición final (MF): al cerrar el proceso (por defecto, a los 9 meses).',
      '! Las fechas programadas se calculan desde el inicio, pero se pueden editar para cada coachee.',
      '## Fuentes de evidencia',
      '- Observación directa de las sesiones de coaching.',
      '- Ejercicios y simulaciones de conversaciones.',
      '- Situaciones reales que el coachee relata, con ejemplos concretos.',
      '- Compromisos de acción y su cumplimiento.',
      '- Retroalimentación de su entorno de trabajo, cuando exista.',
      '> Una calificación sin evidencia es solo una opinión. Anota el ejemplo que la sostiene.'
    ].join('\n'), 'Sí']);

  return filas;
}
