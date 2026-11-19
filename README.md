# 🎯 Avance en Coaching Ejecutivo — Training Skills

Sistema para que los coaches midan el avance de sus coachees en **18 indicadores conductuales** (6 habilidades) a lo largo de un proceso de coaching: **línea base, dos mediciones intermedias y medición final**. Genera un **informe final en PDF** y lo envía por correo.

- **Frontend:** página única (SPA) en HTML, CSS y JavaScript sin frameworks, publicada en **GitHub Pages** (`/docs`). Responsiva (probada para 390 px de ancho) y en español.
- **Backend:** **Google Apps Script** vinculado a la hoja de cálculo, publicado como aplicación web. Expone una API JSON con `doPost(e)`.
- **Datos:** todo se guarda en **Google Sheets**. Lo que se escribe en la hoja se ve en la app y viceversa.

```
Navegador (GitHub Pages)  ──POST text/plain──▶  Apps Script (aplicación web)  ──▶  Google Sheets + Drive + Gmail
   docs/                                           apps-script/
```

---

## Contenido del repositorio

```
├─ docs/                      Frontend (GitHub Pages)
│  ├─ index.html              Página única; navegación interna sin cambiar de URL
│  ├─ config.example.js       Copia como config.js y pega la URL de la API
│  ├─ css/styles.css          Identidad visual de Training Skills
│  └─ js/                     calculos.js (fuente única), util, api, app y vistas/
├─ apps-script/               Backend (se despliega con clasp o pegando los archivos)
│  ├─ appsscript.json         Manifiesto: ejecutar como el propietario, acceso: cualquier usuario
│  ├─ .clasp.json.example     Ejemplo para clasp
│  ├─ Main.gs                 doPost, validación de token y lista blanca de acciones
│  ├─ Config.gs               Estructura de hojas y datos por defecto
│  ├─ Setup.gs                Menú 🎯 Coaching, inicializar(), estilos, sincronizar
│  ├─ Auth.gs                 Contraseñas cifradas, sesiones, bloqueo por intentos
│  ├─ Datos.gs                Lectura y escritura de las hojas y acciones de datos
│  ├─ Informe.gs              HTML con marca → PDF → Drive; envío por correo
│  └─ Calculos.gs             GENERADO desde docs/js/calculos.js (no editar a mano)
├─ tests/calculos.test.js     Pruebas de los cálculos (Node, sin dependencias)
├─ scripts/sync-calculos.js   Copia calculos.js → apps-script/Calculos.gs
└─ .github/workflows/clasp-push.yml   Opcional: clasp push automático
```

---

## Instalación paso a paso

### 1. Crear tu repositorio

Crea un repositorio en GitHub (puede ser privado en planes que permiten Pages privado, o público) y sube este contenido. Si usas este repositorio como plantilla, haz **Use this template**.

### 2. Crear la hoja de cálculo

1. En Google Drive crea una **hoja de cálculo en blanco** (por ejemplo, «Avance en Coaching Ejecutivo»). Será la base de datos.
2. Hazlo con la cuenta que será la **propietaria del sistema**: el Apps Script se ejecutará con sus permisos (Drive y envío de correos salen de esa cuenta).

### 3. Poner el código de Apps Script en la hoja

**Opción A — pegar los archivos (la más simple)**

1. En la hoja: **Extensiones ▸ Apps Script**.
2. Crea un archivo por cada `.gs` de la carpeta `apps-script/` (`Main`, `Config`, `Setup`, `Auth`, `Datos`, `Informe`, `Calculos`) y pega su contenido. El orden no importa.
3. En **Configuración del proyecto** activa *Mostrar el archivo de manifiesto «appsscript.json»* y reemplaza su contenido por el de `apps-script/appsscript.json` (conserva la zona horaria que prefieras).

**Opción B — con clasp**

```bash
npm install -g @google/clasp
clasp login
cd apps-script
cp .clasp.json.example .clasp.json     # edita scriptId (Configuración del proyecto ▸ ID de secuencia de comandos)
clasp push
```

> `.clasp.json` está en `.gitignore`: no lo subas al repositorio.

### 4. Inicializar las hojas

1. Recarga la hoja de cálculo: aparece el menú **🎯 Coaching**.
2. **🎯 Coaching ▸ Inicializar / aplicar estilos**. La primera vez Google pide autorizar permisos (Sheets, Drive, envío de correos): acéptalos. Si ves «Google no ha verificado esta app», elige **Configuración avanzada ▸ Ir a … (no seguro)**: es tu propio script.
3. Se crean las hojas **Configuración, Coaches, Coachees, Evaluación, Indicadores, Escala, Fundamentación_Teórica y Tablero**, con encabezados con emoji, columnas calculadas con fondo celeste (protección solo de advertencia) y los datos por defecto (18 indicadores con meta 4, escala de 5 niveles y 10 tarjetas de fundamentación).

Se puede ejecutar de nuevo cuando quieras para reaplicar estilos y fórmulas; no borra datos.

### 5. Cargar coaches y configuración

- **Coaches:** una fila por coach con **correo, nombre y una contraseña inicial**. Al salir de la celda, la contraseña se reemplaza por `🔒 ` + SHA-256(sal secreta + contraseña). La sal se genera una sola vez y vive en las propiedades del script.
- **Configuración:** pega en *Carpeta de informes* el enlace de una carpeta de Drive (ahí se guardan los PDF). Comparte esa carpeta con los coaches para que puedan abrir los PDF. También puedes ajustar meta sugerida (por defecto 4), duración por defecto (9 meses) y nombre del remitente de los correos.
- **Imagen de fondo (opcional):** pega en la hoja Configuración el enlace de una imagen de Drive (compartida con «cualquier persona con el enlace») y la intensidad en % (por defecto 12; acepta `12` o `12 %`). Solo se configura en la hoja, no en la app.

### 6. Desplegar la API

1. En Apps Script: **Implementar ▸ Nueva implementación ▸ ⚙ ▸ Aplicación web**.
2. **Ejecutar como:** *Yo (el propietario)*. **Quién tiene acceso:** *Cualquier usuario*. El control de acceso lo hace la propia app con correo y contraseña.
3. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).

Cuando cambies el código, actualiza la **misma** implementación para conservar la URL: **Implementar ▸ Administrar implementaciones ▸ ✏️ ▸ Versión: Nueva versión ▸ Implementar**.

### 7. Configurar el frontend

```bash
cp docs/config.example.js docs/config.js
```

Edita `docs/config.js` y pega la URL:

```js
const API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

La URL de la API es la dirección pública que usa el navegador; no es una credencial. Aun así, el repositorio solo incluye `config.example.js`: tú decides si haces *commit* de tu `config.js` (necesario para que GitHub Pages lo sirva) y no se sube ningún token, contraseña ni ID de hoja.

### 8. Activar GitHub Pages

**Settings ▸ Pages ▸ Build and deployment ▸ Source: Deploy from a branch ▸ Branch: `main` / carpeta `/docs` ▸ Save.** (También sirve una rama `gh-pages` con el contenido de `docs/`.)

Tu app quedará en `https://<usuario>.github.io/<repositorio>/`.

### 9. Probar

Abre el enlace, ingresa con un coach de la hoja y crea un coachee. Desde la hoja usa **🎯 Coaching ▸ Sincronizar coachees y tablero** si escribes coachees a mano.

---

## Cómo se usa

| Enlace | Abre en |
|---|---|
| `https://…/` | 📝 Registrar medición (pensada para celular) |
| `https://…/?v=admin` | 📊 Tablero |
| `https://…/?c=CO-1A2B3C4D&m=M1` | Coachee y momento preseleccionados (`m` = `LB`, `M1`, `M2` o `MF`) |

Secciones: 📊 Tablero · 👥 Coachees · 📈 Avance del coachee · 📚 Fundamentación teórica · ⚙️ Configuración · 📝 Registrar medición.

**Menú de la hoja (🎯 Coaching):** inicializar/aplicar estilos · sincronizar coachees y tablero · generar informe PDF del coachee elegido en `Tablero!C3` · enviar informe por correo · ver enlace de la app.

**Sincronizar:** a los coachees escritos a mano les asigna ID (`CO-xxxxxxxx`), Estado «Activo», duración y fechas programadas (si tienen inicio), crea sus filas en *Evaluación* y mantiene los nombres al día. La app también lo hace sola al listar coachees si encuentra filas sin ID.

### Reglas de cálculo (idénticas en la hoja y en la app)

| Concepto | Regla |
|---|---|
| Puntaje actual | Última medición registrada: MF, si no M2, si no M1, si no LB |
| Variación | actual − línea base |
| % de avance | (actual − LB) ÷ (meta − LB), tope 100 %; si actual ≥ meta, 100 %; si el puntaje baja de la LB, 0 % |
| Estado | **Meta lograda** (actual ≥ meta) · **En camino** (avance ≥ 50 %) · **Prioridad** (avance < 50 %) |
| Por habilidad y global | Promedio de los indicadores; % de avance = promedio de los % de cada indicador |
| Índice de desarrollo | promedio ÷ 5 |
| Nivel | Nivel de la escala del promedio redondeado hacia abajo (3,7 → En desarrollo) |
| Indicadores clave | Índice LB y actual (promedio sobre 5), variación, avance a la meta, indicadores en meta (x/18), nivel global, habilidad de mayor crecimiento, más fuerte y **mayor oportunidad** (la de mayor brecha entre meta y actual) |

---

## Seguridad y acceso

- Pantalla de ingreso con correo y contraseña (con botón para mostrarla). **5 intentos fallidos** con el mismo correo bloquean el ingreso **15 minutos** (`CacheService`).
- Al ingresar, el backend crea un **token aleatorio**; en las propiedades del script solo guarda su **hash**, con correo, vencimiento (**365 días**) y la **huella de la contraseña**. El navegador guarda el token en `localStorage`: mientras use el mismo dispositivo y navegador no se pide la contraseña; en otro dispositivo, sí.
- Si el administrador **cambia la contraseña** en la hoja o **borra al coach**, sus sesiones dejan de valer.
- Cada coach puede cambiarla en la app (**🔑 Clave**): actual + nueva (mínimo 6 caracteres) + confirmación. Cierra sus sesiones en otros dispositivos y conserva la actual. **Salir** cierra la sesión en ese dispositivo.
- Una **única función de entrada** (`doPost`) valida el token y solo ejecuta acciones de una **lista blanca** (`acciones_()` en `Main.gs`).
- La app **no muestra ningún enlace a la hoja de cálculo**. Todo texto que viene de la hoja se **escapa** antes de insertarse en el HTML, y los textos que se escriben en la hoja se protegen para que no se interpreten como fórmulas.
- **Importante:** como el acceso a la API es «cualquier usuario», la seguridad depende de las contraseñas de los coaches. Usa contraseñas largas y únicas.

## Informe final en PDF

HTML con la marca convertido a PDF con `HtmlService` (`getAs('application/pdf')`), en dos páginas: encabezado, datos del coachee, indicadores clave, tabla por habilidad con barras, hallazgos y los 4 textos; y, en la segunda, el detalle de los indicadores coloreado por nivel. Se guarda como `Informe_Coaching_<Nombre>_<aaaa-mm-dd>.pdf` en la carpeta de Drive de Configuración y su enlace queda en la columna **Informe** del coachee.

El envío por correo usa `MailApp` (adjunta el PDF, cuerpo HTML con la marca, remitente tomado de Configuración y respuesta dirigida al coach que lo envía). Cuotas diarias de Google: ~100 destinatarios en cuentas personales y ~1500 en Google Workspace.

---

## Desarrollo y pruebas

```bash
npm test          # cálculos: caso de aceptación + reglas por indicador + fechas
npm install       # (una vez) instala jsdom para la prueba del frontend
npm run test:backend   # API completa contra un simulador de Google Sheets/Drive/Mail
npm run test:frontend  # pantallas en jsdom conectadas al backend simulado
npm run test:all
node tests/dev-server.js   # interfaz de prueba en http://localhost:8765 con datos de ejemplo (ana@x.com / secreto123), sin Google
npm run sync      # regenera apps-script/Calculos.gs desde docs/js/calculos.js
```

`docs/js/calculos.js` es la **fuente única** de los cálculos: lo usan el navegador, las pruebas en Node y (copiado como `Calculos.gs`) Apps Script. La prueba falla si `Calculos.gs` quedó desactualizado.

Caso de aceptación verificado: Escucha 1,7 → 4,0 · Calibración 78 % «En camino» · índice global 2,2 → 4,0 · avance 96 % · 16/18 indicadores en meta.

### clasp push automático (opcional)

El workflow `.github/workflows/clasp-push.yml` viene **desactivado**. Para activarlo:

1. Haz `clasp login` en tu equipo y copia el contenido de `~/.clasprc.json`.
2. En el repositorio: **Settings ▸ Secrets and variables ▸ Actions** y crea los secretos `CLASPRC_JSON` (ese contenido) y `SCRIPT_ID` (ID del proyecto de Apps Script).
3. Crea la variable `CLASP_ENABLED` con el valor `true`.

Cada *push* a `main` que cambie `apps-script/` ejecuta las pruebas y hace `clasp push`. Después hay que **actualizar la implementación** (paso 6) para que la API publicada use el código nuevo.

---

## Solución de problemas

| Síntoma | Qué revisar |
|---|---|
| «Falta configurar la app» | Falta `docs/config.js` o la URL tiene el texto de ejemplo |
| «No se pudo conectar con el servidor» | URL incorrecta en `config.js`, o la implementación no está en *Cualquier usuario* |
| «Falta la hoja…» | Ejecuta **🎯 Coaching ▸ Inicializar / aplicar estilos** |
| Cambié el código y la app sigue igual | Publica una **nueva versión** de la implementación (paso 6) |
| «No se pudo abrir la carpeta de informes» | Revisa el enlace en Configuración y que la cuenta propietaria tenga acceso |
| Un coach no puede abrir un PDF | Comparte la carpeta de informes con esa cuenta |
| No entra con la contraseña | Comprueba que la contraseña de la hoja no se haya cambiado; tras 5 intentos fallidos espera 15 min |
| Una fecha sale corrida un día | Revisa la zona horaria de la hoja (Archivo ▸ Configuración) y la de `appsscript.json` |

No reordenes las columnas de las hojas: el sistema las lee por posición (puedes cambiar emojis y texto de los encabezados).
