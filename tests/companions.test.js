import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnMates, matesText } from '../js/ui/companions.js';

const HOY = '2026-11-13';
const ESCALAFON = ['REINOSO', 'RAFA', 'TESA', 'LUIS', 'ANA'];

const entry = (person, tagType, date = HOY) => ({ person, date, tagType });
const data = (entries, names = ESCALAFON) => ({ entries, names });

test('compañeros: quienes tienen tu mismo turno el mismo día, sin contarte a ti', () => {
  const d = data([
    entry('REINOSO', 'TURNO_M'), entry('RAFA', 'TURNO_M'), entry('TESA', 'TURNO_M'),
    entry('LUIS', 'TURNO_T'), entry('ANA', 'TURNO_N')
  ]);
  const r = turnMates(d, { person: 'REINOSO', date: HOY, escalafon: ESCALAFON });
  assert.equal(r.turno, 'TURNO_M');
  assert.deepEqual(r.mates, ['RAFA', 'TESA']);
});

test('los compañeros salen en el orden del escalafón, no en el del archivo', () => {
  const d = data([entry('TESA', 'TURNO_T'), entry('REINOSO', 'TURNO_T'), entry('RAFA', 'TURNO_T')]);
  assert.deepEqual(turnMates(d, { person: 'REINOSO', date: HOY, escalafon: ESCALAFON }).mates, ['RAFA', 'TESA']);
});

test('solo cuenta el mismo turno: tarde no es mañana', () => {
  const d = data([entry('REINOSO', 'TURNO_T'), entry('RAFA', 'TURNO_M'), entry('TESA', 'TURNO_N')]);
  const r = turnMates(d, { person: 'REINOSO', date: HOY, escalafon: ESCALAFON });
  assert.equal(r.turno, 'TURNO_T');
  assert.deepEqual(r.mates, []);
});

test('quien libra, está de vacaciones, de asunto propio o de baja no es compañero', () => {
  const d = data([
    entry('REINOSO', 'TURNO_M'), entry('RAFA', 'TURNO_M'), entry('RAFA', 'LIBRE'),
    entry('TESA', 'TURNO_M'), entry('TESA', 'BAJA'), entry('LUIS', 'TURNO_M'), entry('ANA', 'TURNO_M'), entry('ANA', 'VACACIONES')
  ]);
  assert.deepEqual(turnMates(d, { person: 'REINOSO', date: HOY, escalafon: ESCALAFON }).mates, ['LUIS']);
});

test('si tú libras o no tienes turno ese día, no hay compañeros', () => {
  const libre = data([entry('REINOSO', 'TURNO_M'), entry('REINOSO', 'LIBRE'), entry('RAFA', 'TURNO_M')]);
  assert.deepEqual(turnMates(libre, { person: 'REINOSO', date: HOY, escalafon: ESCALAFON }), { turno: null, mates: [] });
  const sinTurno = data([entry('RAFA', 'TURNO_M')]);
  assert.deepEqual(turnMates(sinTurno, { person: 'REINOSO', date: HOY, escalafon: ESCALAFON }), { turno: null, mates: [] });
  const guardia = data([entry('REINOSO', 'GUARDIA_REAL'), entry('RAFA', 'TURNO_M')]);
  assert.deepEqual(turnMates(guardia, { person: 'REINOSO', date: HOY, escalafon: ESCALAFON }), { turno: null, mates: [] });
});

test('solo cuenta el día pedido', () => {
  const d = data([entry('REINOSO', 'TURNO_M'), entry('RAFA', 'TURNO_M', '2026-11-14')]);
  assert.deepEqual(turnMates(d, { person: 'REINOSO', date: HOY, escalafon: ESCALAFON }).mates, []);
});

test('quien ya no está en el escalafón no sale', () => {
  const d = data([entry('REINOSO', 'TURNO_M'), entry('FULANO', 'TURNO_M'), entry('RAFA', 'TURNO_M')], ['REINOSO', 'FULANO', 'RAFA']);
  assert.deepEqual(turnMates(d, { person: 'REINOSO', date: HOY, escalafon: ['REINOSO', 'RAFA'] }).mates, ['RAFA']);
});

test('los nombres con variantes se juntan: «Mª TESA» es TESA', () => {
  const d = data([entry('REINOSO', 'TURNO_M'), entry('Mª TESA', 'TURNO_M')]);
  assert.deepEqual(turnMates(d, { person: 'REINOSO', date: HOY, escalafon: ESCALAFON }).mates, ['TESA']);
});

test('sin cuadrante o sin tu nombre no hay compañeros ni errores', () => {
  assert.deepEqual(turnMates(null, { person: 'REINOSO', date: HOY }), { turno: null, mates: [] });
  assert.deepEqual(turnMates({ entries: [] }, { person: 'REINOSO', date: HOY }), { turno: null, mates: [] });
  assert.deepEqual(turnMates(data([entry('RAFA', 'TURNO_M')]), { person: '', date: HOY }), { turno: null, mates: [] });
});

test('el texto: uno, dos, tres y más de tres', () => {
  assert.equal(matesText([]), '');
  assert.equal(matesText(['Rafa']), 'con Rafa');
  assert.equal(matesText(['Rafa', 'Tesa']), 'con Rafa y Tesa');
  assert.equal(matesText(['Rafa', 'Tesa', 'Luis']), 'con Rafa, Tesa y Luis');
  assert.equal(matesText(['Rafa', 'Tesa', 'Luis', 'Ana']), 'con Rafa, Tesa, Luis y 1 más');
  assert.equal(matesText(['Rafa', 'Tesa', 'Luis', 'Ana', 'Pepe']), 'con Rafa, Tesa, Luis y 2 más');
});
