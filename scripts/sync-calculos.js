#!/usr/bin/env node
/*
 * Genera apps-script/Calculos.gs a partir de docs/js/calculos.js (fuente única).
 * Uso: npm run sync
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ORIGEN = path.join(RAIZ, 'docs', 'js', 'calculos.js');
const DESTINO = path.join(RAIZ, 'apps-script', 'Calculos.gs');

const ENCABEZADO =
  '// ============================================================================\n' +
  '// ARCHIVO GENERADO — NO EDITAR A MANO.\n' +
  '// Fuente: docs/js/calculos.js  ·  Regenerar con: npm run sync\n' +
  '// ============================================================================\n';

fs.writeFileSync(DESTINO, ENCABEZADO + fs.readFileSync(ORIGEN, 'utf8'));
console.log('Generado ' + path.relative(RAIZ, DESTINO));
