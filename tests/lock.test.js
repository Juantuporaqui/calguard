import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Actions, getState } from '../js/state/store.js';
import { confirmDialog, promptDialog } from '../js/ui/sheet.js';

test('al bloquear se cancela la selección del calendario y se rechazan hojas tardías', async () => {
  Actions.setScreen('calendar');
  Actions.setMultiSelect({ active: true, selectedDates: ['2026-11-14'] });
  Actions.setRangeSelection({ type: 'VACACIONES', startDate: '2026-11-14' });
  Actions.setLocked(true);
  assert.equal(getState().multiSelect, null);
  assert.equal(getState().rangeSelection, null);
  assert.equal(await confirmDialog({ title: 'Borrar', message: '¿Seguro?' }), false);
  assert.equal(await promptDialog({ title: 'Borrar', label: 'Escribe BORRAR' }), null);
  Actions.setLocked(false);
  assert.equal(getState().currentScreen, 'calendar');
});
