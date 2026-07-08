import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCodeToTagType, filterByPerson, groupByDate, getPersonNames, excelSerialToISO } from '../js/imports/cuadranteParser.js';

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
