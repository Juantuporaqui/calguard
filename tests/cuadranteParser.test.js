import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCodeToTagType, filterByPerson, groupByDate, getPersonNames, excelSerialToISO, parseSheetRows } from '../js/imports/cuadranteParser.js';

test('excelSerialToISO convierte la fecha-serie de Excel a ISO exacta', () => {
  // Series reales tomadas del cuadrante de Policía Científica
  assert.equal(excelSerialToISO(46204), '2026-07-01'); // 1 de julio de 2026
  assert.equal(excelSerialToISO(46174), '2026-06-01'); // 1 de junio de 2026
  assert.equal(excelSerialToISO(42005), '2015-01-01'); // bloque histórico de 2015
});

test('excelSerialToISO suma días correctamente dentro del mes', () => {
  // 1 jul 2026 = 46204 -> día 4 (INC de la guardia de CARMEN) = 46204 + 3
  assert.equal(excelSerialToISO(46204 + 3), '2026-07-04');
  // cruce de fin de mes: 30 jun (46174+29) y 1 jul
  assert.equal(excelSerialToISO(46174 + 29), '2026-06-30');
  assert.equal(excelSerialToISO(46174 + 30), '2026-07-01');
});

test('mapCodeToTagType mapea códigos de guardia', () => {
  assert.equal(mapCodeToTagType('G'), 'GUARDIA_REAL');
  assert.equal(mapCodeToTagType('guardia'), 'GUARDIA_REAL');
  assert.equal(mapCodeToTagType(' INC '), 'GUARDIA_REAL');
});

test('mapCodeToTagType mapea turnos, libres y permisos', () => {
  assert.equal(mapCodeToTagType('M'), 'TURNO_M');
  assert.equal(mapCodeToTagType('TARDE'), 'TURNO_T');
  assert.equal(mapCodeToTagType('N'), 'TURNO_N');
  assert.equal(mapCodeToTagType('L'), 'LIBRE');
  assert.equal(mapCodeToTagType('C.H.'), 'LIBRE');
  assert.equal(mapCodeToTagType('VAC'), 'VACACIONES');
  assert.equal(mapCodeToTagType('A.P.'), 'AP');
  assert.equal(mapCodeToTagType('IT'), 'BAJA');
  assert.equal(mapCodeToTagType('JUICIO'), 'JUICIO');
  assert.equal(mapCodeToTagType('FORMACIÓN'), 'FORMACION');
});

test('mapCodeToTagType devuelve null para códigos desconocidos o entradas inválidas', () => {
  assert.equal(mapCodeToTagType('ZZZ'), null);
  assert.equal(mapCodeToTagType(''), null);
  assert.equal(mapCodeToTagType(null), null);
  assert.equal(mapCodeToTagType(42), null);
});

const entries = [
  { date: '2026-07-01', person: 'García López, Juan', code: 'G', tagType: 'GUARDIA_REAL' },
  { date: '2026-07-01', person: 'Pérez Ruiz, Ana', code: 'M', tagType: 'TURNO_M' },
  { date: '2026-07-02', person: 'García López, Juan', code: 'L', tagType: 'LIBRE' }
];

test('filterByPerson hace coincidencia parcial sin distinguir mayúsculas', () => {
  assert.equal(filterByPerson(entries, 'garcía').length, 2);
  assert.equal(filterByPerson(entries, 'ANA').length, 1);
  assert.equal(filterByPerson(entries, 'nadie').length, 0);
});

test('groupByDate agrupa por fecha', () => {
  const map = groupByDate(entries);
  assert.equal(map.get('2026-07-01').length, 2);
  assert.equal(map.get('2026-07-02').length, 1);
});

test('getPersonNames devuelve nombres únicos ordenados', () => {
  assert.deepEqual(getPersonNames(entries), ['García López, Juan', 'Pérez Ruiz, Ana']);
});

// ─── Bloques de mes (lectura de la hoja) ───

const serial = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
const days = n => Array.from({ length: n }, (_, i) => i + 1);

test('bloque de mes con una fila vacía entre el nombre y los días (DICIEMBRE 2025 real)', () => {
  const marioDic = ['MARIO', ...Array(28).fill(''), 'T', 'T', 'INC'];
  const rows = [
    ['DICIEMBRE'],
    [],
    [serial(2025, 12, 1), ...days(31)],
    ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'],
    marioDic,
    [2026],
    ['ENERO'],
    [serial(2026, 1, 1), ...days(31)],
    ['', 'J', 'V', 'S', 'D'],
    ['MARIO', 'INC', 'M', 'INC', 'INC', 'M', 'INC']
  ];
  const out = parseSheetRows(rows).filter(e => e.person === 'MARIO').map(e => `${e.date} ${e.code}`);
  assert.deepEqual(out, ['2025-12-29 T', '2025-12-30 T', '2025-12-31 INC', '2026-01-01 INC', '2026-01-02 M', '2026-01-03 INC', '2026-01-04 INC', '2026-01-05 M', '2026-01-06 INC']);
});

test('bloque normal (días justo debajo del mes) sigue funcionando', () => {
  const rows = [['FEBRERO'], [serial(2026, 2, 1), ...days(28)], ['', 'D', 'L'], ['JUAN', '', 'CH', 'M']];
  assert.deepEqual(parseSheetRows(rows).map(e => `${e.date} ${e.code}`), ['2026-02-02 CH', '2026-02-03 M']);
});
