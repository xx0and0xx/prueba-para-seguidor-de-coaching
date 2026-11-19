/* Simulador en memoria de Google Sheets / Drive / Mail / Cache / Properties (solo para pruebas). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert');
const DIR = path.join(__dirname, '..', 'apps-script');

const encadenable = (obj, extras) => new Proxy(obj, {
  get(t, p) {
    if (p in t) return t[p];
    if (typeof p === 'string' && /^(set|merge|breakApart|clear|add|require|when|build|protect|getProtections|remove)/.test(p)) {
      return () => (p === 'getProtections' ? [] : new Proxy({}, { get: (_, q) => (q === 'then' ? undefined : () => new Proxy({}, this)) }));
    }
    return undefined;
  }
});

class Hoja {
  constructor(nombre) {
    this.nombre = nombre; this.filas = 1000; this.cols = 26; this.d = []; this.f = {};
    return encadenable(this);
  }
  _get(r, c) { const fila = this.d[r - 1]; return fila && fila[c - 1] !== undefined ? fila[c - 1] : ''; }
  _set(r, c, v) {
    if (r < 1 || c < 1 || r > this.filas || c > this.cols) throw new Error(`Coordenadas fuera de rango en ${this.nombre}: fila ${r}, col ${c} (máx ${this.filas}x${this.cols})`);
    while (this.d.length < r) this.d.push([]);
    this.d[r - 1][c - 1] = v;
  }
  getName() { return this.nombre; }
  getMaxRows() { return this.filas; }
  getMaxColumns() { return this.cols; }
  getLastRow() {
    for (let r = this.d.length; r >= 1; r--) if ((this.d[r - 1] || []).some(v => v !== '' && v !== undefined)) return r;
    return 0;
  }
  getLastColumn() {
    let m = 0;
    this.d.forEach(f => f.forEach((v, i) => { if (v !== '' && v !== undefined) m = Math.max(m, i + 1); }));
    return m;
  }
  insertRowsAfter(_, n) { this.filas += n; }
  insertColumnsAfter(_, n) { this.cols += n; }
  deleteRow(r) { this.d.splice(r - 1, 1); }
  deleteRows(r, n) { this.d.splice(r - 1, n); }
  clear() { this.d = []; this.f = {}; return this; }
  getProtections() { return []; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') {
      const m = /^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/.exec(a);
      assert.ok(m, 'A1 no soportado: ' + a);
      const col = s => s.split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0);
      const c1 = col(m[1]), r1 = m[2] ? +m[2] : 1;
      const c2 = m[3] ? col(m[3]) : c1;
      const r2 = m[3] ? (m[4] ? +m[4] : this.filas) : r1;
      return new Rango(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1);
    }
    return new Rango(this, a, b, c || 1, d || 1);
  }
}

class Rango {
  constructor(h, r, c, nr, nc) { this.h = h; this.r = r; this.c = c; this.nr = nr; this.nc = nc; return encadenable(this); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) { const fila = []; for (let j = 0; j < this.nc; j++) fila.push(this.h._get(this.r + i, this.c + j)); out.push(fila); }
    return out;
  }
  getDisplayValues() {
    return this.getValues().map(f => f.map(v => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v))));
  }
  getValue() { return this.h._get(this.r, this.c); }
  setValues(v) {
    assert.strictEqual(v.length, this.nr, `setValues: filas ${v.length} != ${this.nr} (${this.h.nombre})`);
    v.forEach((fila, i) => {
      assert.strictEqual(fila.length, this.nc, `setValues: columnas ${fila.length} != ${this.nc} (${this.h.nombre})`);
      fila.forEach((x, j) => this.h._set(this.r + i, this.c + j, x === undefined ? '' : x));
    });
    return this;
  }
  setValue(x) {
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.h._set(this.r + i, this.c + j, x);
    return this;
  }
  setFormula(f) { this.h.f[this.r + ',' + this.c] = f; this.h._set(this.r, this.c, ''); return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) if (this.h.d[this.r - 1 + i]) delete this.h.d[this.r - 1 + i][this.c - 1 + j]; return this; }
  getFormula() { return this.h.f[this.r + ',' + this.c] || ''; }
  getSheet() { return this.h; }
  getColumn() { return this.c; }
  getLastColumn() { return this.c + this.nc - 1; }
}

function crearEntorno() {
  const hojas = [];
  const ss = {
    getSheetByName: n => hojas.find(h => h.nombre === n) || null,
    insertSheet: n => { const h = new Hoja(n); hojas.push(h); return h; },
    getSheets: () => hojas,
    deleteSheet: h => hojas.splice(hojas.indexOf(h), 1),
    setActiveSheet: () => {}, moveActiveSheet: () => {}, getSpreadsheetTimeZone: () => 'America/Bogota'
  };
  const props = new Map();
  const cache = new Map();
  const correos = [];
  const archivos = [];
  const mkBlob = (cont) => ({ cont, nombre: '', setName(n) { this.nombre = n; return this; }, getName() { return this.nombre; } });

  const G = globalThis;
  G.__ss = ss; G.__correos = correos; G.__archivos = archivos; G.__props = props;
  G.SpreadsheetApp = {
    getActiveSpreadsheet: () => ss, flush() {},
    getUi: () => ({ alert: m => { G.__alertas = (G.__alertas || []).concat(m); }, createMenu: () => encadenable({}) }),
    newDataValidation: () => encadenable({}), newConditionalFormatRule: () => encadenable({}),
    ProtectionType: { RANGE: 'RANGE', SHEET: 'SHEET' }, BorderStyle: { SOLID: 1, SOLID_MEDIUM: 2 }
  };
  G.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  G.CacheService = { getScriptCache: () => ({ get: k => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) };
  G.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: k => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v),
      deleteProperty: k => props.delete(k), getProperties: () => Object.fromEntries(props)
    })
  };
  G.Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, txt) => Array.from(crypto.createHash('sha256').update(String(txt), 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, f) => { assert.strictEqual(f, 'yyyy-MM-dd'); return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); },
    parseDate: (s, tz, f) => { assert.strictEqual(f, 'yyyy-MM-dd HH:mm'); return new Date(s.replace(' ', 'T') + ':00-05:00'); }
  };
  G.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) };
  G.HtmlService = { createHtmlOutput: html => ({ getBlob: () => ({ getAs: () => mkBlob(html) }) }) };
  G.DriveApp = {
    getFolderById: id => {
      if (id === 'NOEXISTE00000') throw new Error('No encontrada');
      return { getName: () => 'Informes', createFile: blob => { const f = { id: 'FILE' + archivos.length + 'ABCDEFGH', blob, isTrashed: () => false, getName: () => blob.getName(), getBlob: () => blob, getUrl() { return 'https://drive.google.com/file/d/' + this.id + '/view'; }, getId() { return this.id; } }; archivos.push(f); return f; } };
    },
    getFileById: id => { const f = archivos.find(a => a.id === id); if (!f) throw new Error('Archivo no encontrado'); return f; }
  };
  G.MailApp = { sendEmail: o => correos.push(o) };
  return ss;
}

function cargarBackend() {
  fs.readdirSync(DIR).filter(f => f.endsWith('.gs')).sort().forEach(f => {
    vm.runInThisContext(fs.readFileSync(path.join(DIR, f), 'utf8'), { filename: f });
  });
}


module.exports = { crearEntorno, cargarBackend };
