import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toastDuration, enqueue, dismiss, MAX_VISIBLE } from '../js/state/toasts.js';

test('un aviso dura al menos 4 s y 60 ms por carácter si es largo', () => {
  assert.equal(toastDuration({ text: 'Hola' }), 4000);
  assert.equal(toastDuration({ text: 'x'.repeat(66) }), 4000);
  assert.equal(toastDuration({ text: 'x'.repeat(100) }), 6000);
  assert.equal(toastDuration({ text: 'x'.repeat(200) }), 12000);
});

test('una duración pedida más larga se respeta, una más corta no', () => {
  assert.equal(toastDuration({ text: 'Hola', duration: 10000 }), 10000);
  assert.equal(toastDuration({ text: 'x'.repeat(100), duration: 1000 }), 6000);
});

test('los errores no se cierran solos', () => {
  assert.equal(toastDuration({ text: 'No se pudo publicar', level: 'error' }), null);
});

const t = (id, text = `aviso ${id}`, level = 'info') => ({ id, text, level });
const empty = { visible: [], waiting: [] };

test('hasta 3 avisos a la vez; el cuarto espera en vez de pisar', () => {
  let q = empty;
  for (let i = 1; i <= 4; i++) q = enqueue(q, t(i));
  assert.equal(q.visible.length, MAX_VISIBLE);
  assert.deepEqual(q.visible.map(x => x.id), [1, 2, 3]);
  assert.deepEqual(q.waiting.map(x => x.id), [4]);
  assert.equal(q.shown, false);
});

test('al cerrar uno entra el siguiente que esperaba', () => {
  let q = empty;
  for (let i = 1; i <= 5; i++) q = enqueue(q, t(i));
  const r = dismiss(q, 2);
  assert.deepEqual(r.visible.map(x => x.id), [1, 3, 4]);
  assert.deepEqual(r.waiting.map(x => x.id), [5]);
  assert.equal(r.promoted.id, 4);
});

test('cerrar uno que esperaba no cambia los visibles', () => {
  let q = empty;
  for (let i = 1; i <= 5; i++) q = enqueue(q, t(i));
  const r = dismiss(q, 5);
  assert.deepEqual(r.visible.map(x => x.id), [1, 2, 3]);
  assert.deepEqual(r.waiting.map(x => x.id), [4]);
  assert.equal(r.promoted, null);
});

test('el mismo aviso repetido no se apila', () => {
  let q = enqueue(empty, t(1, 'Copiado'));
  q = enqueue(q, t(2, 'Copiado'));
  assert.equal(q.duplicate, true);
  assert.equal(q.visible.length, 1);
  const err = enqueue(q, t(3, 'Copiado', 'error'));
  assert.equal(err.visible.length, 2, 'un error con el mismo texto sí se enseña');
});
