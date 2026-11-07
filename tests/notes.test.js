import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNote, noteYear, creditSources, matchSource, libreHints, daysFromEntries,
  groupNoteContext, accountingHints, conceptLabel
} from '../js/domain/notes.js';
import { planLedgerFromDays } from '../js/domain/reconcile.js';
import { computeBalances, guardsOfYear } from '../js/domain/balances.js';
import { planCuadranteSync } from '../js/domain/cuadranteSync.js';
import { codesOfCell, cleanCellNote } from '../js/imports/cuadranteParser.js';

const pts = t => parseNote(t).points.map(p => `${p.d}/${p.m}`).join(' ');

// ─── Lectura de las notas tal y como se escriben en el Excel del grupo ───
test('notas de CH: fechas de la guardia en todos los formatos usados', () => {
  assert.equal(pts('CH incid 9-15 marzo. Día 3º.'), '9/3 15/3');
  assert.equal(pts('CH incid 30 marzo- 5 abril. Día 2º.'), '30/3 5/4');
  assert.equal(pts('CH incid 30/03 a 05/04. Día 1º'), '30/3 5/4');
  assert.equal(pts('CH incid 04 a 10/ mayo. Día 1º'), '4/5 10/5');
  assert.equal(pts('CH1-inc22-28 diciembre'), '22/12 28/12');
  assert.equal(pts('CH 1 dia guardia 26/01 al 01/02,'), '26/1 1/2');
  assert.equal(pts('CH 5 incidencias 26/01 al 01/02'), '26/1 1/2');
  assert.equal(pts('CH Incidencias 31 agos- 1 sept. Día 1º'), '31/8 1/9');
  assert.equal(pts('CH Incidencias Día 3 inc 17-23 nov'), '17/11 23/11');
  assert.equal(pts('CH-5 INC 12-18 MAYO. falta minuta'), '12/5 18/5');
  assert.equal(pts('CH1-COMP INC 27-2 agosto. Falta minuta'), '27/7 2/8');   // 27 jul – 2 ago
  assert.equal(pts('CH1 incidencias 2/3 mayo'), '2/5 3/5');                   // 2 y 3 de mayo, no 2 de marzo
  assert.equal(pts('CH incid 31 agosto-6sept. Día 1º.'), '31/8 6/9');
  assert.equal(pts('CH incid. 12-13 abril. 3er día'), '12/4 13/4');
  assert.deepEqual(parseNote('CH incid. 07-08 1º día').days, [7, 8]);         // sin mes
  assert.deepEqual(parseNote('CH 1 incidencias febrero').months, [2]);
  assert.deepEqual(parseNote('1 DIA CH Incidencias ABRIL').months, [4]);
  assert.deepEqual(parseNote('DIA 1 incidencias MARZO').months, [3]);
  assert.equal(parseNote('CH').points.length + parseNote('CH').months.length + parseNote('CH').days.length, 0);
  assert.equal(parseNote('FALTA MINUTA Y ASIGNAR GUARDIAS').points.length, 0);
});

test('notas de CH por otro motivo: juicios, elecciones, ExpoJove, Patrón, servicios', () => {
  assert.equal(parseNote('CH juicio PA 227/25').concept, 'juicio');
  assert.equal(parseNote('CH acumulación juicios.').concept, 'juicio');
  assert.equal(parseNote('CH deber inexcusable').concept, 'juicio');
  assert.equal(parseNote('CH Elecciones europeas.').concept, 'elecciones');
  assert.equal(parseNote('CH Expojove Día 2º').concept, 'evento');
  assert.equal(parseNote('CH incendio Paiporta', [{ key: 'c:incendio-paiporta', words: ['incendio', 'paiporta'] }]).concept, 'c:incendio-paiporta');
  assert.equal(parseNote('CH dia del Patrón').concept, 'patron');
  assert.equal(parseNote('CH Dispositivo UDYCO Benifaió 1º').concept, 'servicio');
  assert.equal(parseNote('CH incid 9-15 marzo. Día 3º.').concept, null);
  assert.equal(conceptLabel('juicio'), 'Juicios');
});

test('notas de AP y vacaciones: año del cupo', () => {
  assert.equal(noteYear('AP 2025, 3º'), 2025);
  assert.equal(noteYear('AP 7º-2025'), 2025);
  assert.equal(noteYear('policia: dia 22 vac 2025'), 2025);
  assert.equal(noteYear('AP 2026, 1º'), 2026);
  assert.equal(noteYear('Juicio Penal 18 11:30h'), null);
});

test('celdas: comentario sin autor y códigos combinados', () => {
  assert.equal(cleanCellNote([{ a: 'policia', t: 'policia:\ndia 1 vac 2025\n' }]), 'dia 1 vac 2025');
  assert.equal(cleanCellNote([{ a: 'Jefatura Valencia', t: 'CH incid 7-13 sept. Día 1º' }]), 'CH incid 7-13 sept. Día 1º');
  assert.deepEqual(codesOfCell('M JUI').map(c => c.tagType), ['TURNO_M', 'JUICIO']);
  assert.deepEqual(codesOfCell('JUI').map(c => c.tagType), ['JUICIO']);
  assert.deepEqual(codesOfCell('CUR').map(c => c.tagType), ['FORMACION']);
  assert.deepEqual(codesOfCell('P').map(c => c.tagType), ['BAJA']);
  assert.deepEqual(codesOfCell('XYZ'), []);
});

// ─── A qué guardia apunta una nota ───
const day = (dateISO, type, note) => ({ dateISO, tags: [{ type, meta: note ? { note } : {} }] });
const incWeekend = (sat) => {
  const sun = new Date(sat + 'T12:00:00'); sun.setDate(sun.getDate() + 1);
  return [day(sat, 'GUARDIA_REAL'), day(sun.toISOString().slice(0, 10), 'GUARDIA_REAL')];
};

test('la nota va a su guardia, aunque sea de hace meses o se coja por adelantado', () => {
  const days = [...incWeekend('2026-01-17'), ...incWeekend('2026-01-24'), ...incWeekend('2026-03-21')];
  const src = creditSources(days);
  // "18-19 ene" sólo cabe en la semana del 12 al 18 + domingo 19… exacto primero
  assert.equal(matchSource(parseNote('CH Incidencias 17-18 ene. Día 1º'), '2026-02-20', src).refs[0], 'G.12/01');
  assert.equal(matchSource(parseNote('CH incid 19-25 enero. Día 2º'), '2026-02-20', src).refs[0], 'G.19/01');
  // por adelantado: libre el 27 feb a cuenta de la guardia del 16-22 marzo
  assert.equal(matchSource(parseNote('CH Incidencias 16-22 marzo. Día 1º FALTA MINUTA'), '2026-02-27', src).refs[0], 'G.16/03');
  // la misma semana del año anterior no cuenta
  assert.equal(matchSource(parseNote('CH incid 12-18 enero'), '2027-01-30', src), null);
});

test('errata en el mes ("4-5 dic" de una guardia del 4-5 de enero)', () => {
  const days = [...incWeekend('2025-01-04')];
  const hit = matchSource(parseNote('CH Incidencias 4-5 dic. Día 1º'), '2025-02-05', creditSources(days));
  assert.equal(hit.refs[0], 'G.30/12');
  assert.equal(hit.how, 'errata');
});

// ─── Contabilidad con las notas ───
const cfg = { diasPorGuardia: 5, asuntosAnuales: 8, vacacionesAnuales: 25, carryovers: {} };

test('juicios y otros motivos no gastan guardias; la nota manda sobre el orden', () => {
  const days = [
    ...incWeekend('2026-01-10'), ...incWeekend('2026-02-07'),
    day('2026-02-16', 'LIBRE', 'CH incid 2-8 febrero. Día 1º'),   // de la segunda guardia
    day('2026-02-17', 'LIBRE', 'CH juicio PA 12/26'),             // por juicio
    day('2026-02-18', 'LIBRE')                                    // sin nota: la más antigua
  ];
  const h = libreHints(days, creditSources(days));
  const plan = planLedgerFromDays(days, [], cfg, { ...h });
  const by = Object.fromEntries(plan.debitsToAdd.map(d => [d.dateISO, d]));
  assert.equal(by['2026-02-16'].sourceRef, 'G.02/02');
  assert.equal(by['2026-02-16'].porNota, true);
  assert.equal(by['2026-02-17'].concepto, 'juicio');
  assert.equal(by['2026-02-17'].sourceRef, '');
  assert.equal(by['2026-02-18'].sourceRef, 'G.05/01');
  const ledger = [
    ...plan.creditsToAdd.map(c => ({ kind: 'CREDIT', category: 'GUARDIA', origin: 'cuadrante', ...c })),
    ...plan.debitsToAdd.map(d => ({ kind: 'DEBIT', category: 'LIBRE', amount: -1, origin: 'cuadrante', ...d }))
  ];
  const b = computeBalances(days, ledger, cfg, { today: '2026-03-01' });
  assert.equal(b.libres.generados, 10);
  assert.equal(b.libres.disfrutados, 2);          // el del juicio no resta
  assert.equal(b.libres.disponibles, 8);
  assert.deepEqual(b.libres.porConcepto.map(c => [c.concepto, c.fechas.length]), [['juicio', 1]]);
});

test('una guardia con más días de los que da se marca (6/5)', () => {
  const days = [...incWeekend('2026-01-10'), ...incWeekend('2026-02-07')];
  for (const d of ['2026-01-19', '2026-01-20', '2026-01-21', '2026-01-22', '2026-01-23', '2026-02-16']) {
    days.push(day(d, 'LIBRE', 'CH incid 5-11 enero'));
  }
  const plan = planLedgerFromDays(days, [], cfg, libreHints(days, creditSources(days)));
  assert.equal(plan.debitsToAdd.filter(d => d.sourceRef === 'G.05/01').length, 6);
  assert.equal(plan.debitsToAdd.find(d => d.dateISO === '2026-02-16').excede, true);
  const ledger = [
    ...plan.creditsToAdd.map(c => ({ kind: 'CREDIT', category: 'GUARDIA', ...c })),
    ...plan.debitsToAdd.map(d => ({ kind: 'DEBIT', category: 'LIBRE', amount: -1, ...d }))
  ];
  const g = guardsOfYear(ledger, 2026, 5, '2026-03-01');
  assert.equal(g[0].used, 6);
  assert.equal(g[0].excede, true);
  assert.equal(computeBalances(days, ledger, cfg, { today: '2026-03-01' }).libres.disponibles, 4); // 10 − 6
});

// ─── El grupo: cambios de fin de semana y guardias de lunes a viernes ───
const E = (person, date, tagType, note) => ({ person, date, tagType, code: tagType[0], ...(note ? { note } : {}) });

test('fin de semana partido: la guardia es de quien tiene las notas (caso REINOSO/CARMEN)', () => {
  const entries = [
    E('CARMEN', '2026-02-21', 'GUARDIA_REAL'), E('REINOSO', '2026-02-22', 'GUARDIA_REAL'),
    E('REINOSO', '2026-05-09', 'GUARDIA_REAL'), E('CARMEN', '2026-05-10', 'GUARDIA_REAL'),
    E('CARMEN', '2026-04-21', 'LIBRE', 'CH 1 incidencias febrero'),
    E('REINOSO', '2026-10-28', 'LIBRE', 'CH incid 04 a 10/ mayo. Día 1º')
  ];
  const ctx = groupNoteContext(entries);
  assert.deepEqual([...ctx.excluded.get('REINOSO')], ['2026-02-16']);
  assert.deepEqual([...ctx.excluded.get('CARMEN')], ['2026-05-04']);
  const r = planCuadranteSync({
    days: [], ledger: [], entries: entries.filter(e => e.person === 'REINOSO'), profileId: 'p', desde: '2026-01-01', config: cfg,
    hints: accountingHints(ctx, 'REINOSO', { config: cfg, desde: '2026-01-01' })
  });
  assert.deepEqual(r.plan.creditsToAdd.map(c => c.dateISO), ['2026-05-04']);
  assert.equal(r.newDays.find(d => d.dateISO === '2026-02-22').tags[0].meta.cambio, true);
});

test('sin notas de nadie, la semana partida sigue contando para los dos', () => {
  const ctx = groupNoteContext([E('MARIO', '2025-11-29', 'GUARDIA_REAL'), E('CARMEN', '2025-11-30', 'GUARDIA_REAL')]);
  assert.equal(ctx.excluded.get('MARIO').size, 0);
  assert.equal(ctx.excluded.get('CARMEN').size, 0);
});

test('la jefa en la misma guardia que otro (mismos días) no es un cambio', () => {
  const ctx = groupNoteContext([
    E('TESA', '2026-08-22', 'GUARDIA_REAL'), E('TESA', '2026-08-23', 'GUARDIA_REAL'),
    E('MARIO', '2026-08-22', 'GUARDIA_REAL'), E('MARIO', '2026-08-23', 'GUARDIA_REAL'),
    E('MARIO', '2026-08-31', 'LIBRE', 'CH incid 17-23 agosto. Día 1.')
  ]);
  assert.equal(ctx.excluded.get('TESA').size, 0);
});

test('nota de una guardia que figura a nombre de otro (hizo de lunes a viernes): no gasta las suyas', () => {
  const entries = [
    E('NURIA', '2025-11-15', 'GUARDIA_REAL'), E('NURIA', '2025-11-16', 'GUARDIA_REAL'),
    E('NURIA', '2025-12-01', 'LIBRE', 'CH incid 10-16 nov. Día 1º'),
    E('MARIO', '2025-10-04', 'GUARDIA_REAL'), E('MARIO', '2025-10-05', 'GUARDIA_REAL'),
    E('MARIO', '2025-11-18', 'LIBRE', 'CH Incidencias 10-16 nov. Dia 1º')
  ];
  const ctx = groupNoteContext(entries);
  assert.equal(ctx.hints.MARIO.libreConcept.get('2025-11-18'), 'guardia-compartida');
  assert.equal(ctx.hints.MARIO.shared.get('2025-11-18').person, 'NURIA');
  assert.equal(ctx.excluded.get('NURIA').size, 0);     // Nuria conserva la suya
});

// ─── Arrastre automático del año anterior ───
test('arrastre automático: lo que deben las guardias del año anterior según las notas (caso REINOSO)', () => {
  const entries = [
    // 2025: guardia de junio sin compensar (baja) y la de diciembre, compensada en 2026
    E('REINOSO', '2025-06-14', 'GUARDIA_REAL'), E('REINOSO', '2025-06-15', 'GUARDIA_REAL'),
    E('REINOSO', '2025-05-07', 'LIBRE', 'CH Incidencias 3-4 mayo. Día 1º'),
    E('REINOSO', '2025-05-03', 'GUARDIA_REAL'), E('REINOSO', '2025-05-04', 'GUARDIA_REAL'),
    E('REINOSO', '2025-12-27', 'GUARDIA_REAL'), E('REINOSO', '2025-12-28', 'GUARDIA_REAL'),
    // 2026
    E('REINOSO', '2026-01-31', 'GUARDIA_REAL'), E('REINOSO', '2026-02-01', 'GUARDIA_REAL'),
    E('REINOSO', '2026-04-20', 'LIBRE', 'CH1-inc22-28 diciembre'),
    E('REINOSO', '2026-04-21', 'LIBRE', 'CH 1 dia guardia 26/01 al 01/02,'),
    E('REINOSO', '2026-04-10', 'LIBRE', 'CH'),
    E('REINOSO', '2026-05-12', 'LIBRE', 'CH juicio PA191/19'),
    E('REINOSO', '2026-02-13', 'AP', 'AP 2025, 3º'), E('REINOSO', '2026-10-14', 'AP', 'AP 2026, 1º')
  ].map(e => e.tagType === 'AP' ? e : e);
  const ctx = groupNoteContext(entries);
  const hints = accountingHints(ctx, 'REINOSO', { config: cfg, desde: '2026-01-01' });
  assert.deepEqual(hints.carryCredits.map(c => `${c.dateISO}:${c.carried}/${c.amount}`),
    ['2025-04-28:4/5', '2025-06-09:5/5', '2025-12-22:5/5']);
  const r = planCuadranteSync({ days: [], ledger: [], entries, profileId: 'p', desde: '2026-01-01', config: cfg, hints });
  const ledger = [
    ...r.plan.creditsToAdd.map(c => ({ kind: 'CREDIT', category: 'GUARDIA', origin: 'cuadrante', ...c })),
    ...r.plan.debitsToAdd.map(d => ({ kind: 'DEBIT', category: 'LIBRE', amount: -1, origin: 'cuadrante', ...d }))
  ];
  const b = computeBalances(r.newDays, ledger, cfg, { today: '2026-11-07' });
  assert.equal(b.libres.arrastreAuto, true);
  assert.equal(b.libres.arrastre, 14);              // 4 + 5 + 5
  assert.equal(b.libres.delArrastre, 2);            // 20 abr (diciembre) y 10 abr (el más antiguo con días)
  assert.equal(b.libres.generados, 5);
  assert.equal(b.libres.disfrutados, 1);            // 21 abr; el del juicio va aparte
  assert.equal(b.libres.disponibles, 12 + 4);       // 14 − 2 + 5 − 1
  assert.equal(b.ap.delArrastre, 1);                // el AP con «2025» es del año anterior
  assert.equal(b.ap.disfrutados, 1);
  const g = guardsOfYear(ledger, 2026, 5, '2026-11-07');
  assert.deepEqual(g.filter(x => x.prevYear).map(x => `${x.dateISO}:${x.used}/${x.total}`),
    ['2025-04-28:2/5', '2025-06-09:0/5', '2025-12-22:1/5']);
});

test('sin notas en el cuadrante (archivo antiguo) no hay arrastre automático: todo como antes', () => {
  const entries = [
    E('JUAN', '2025-06-14', 'GUARDIA_REAL'), E('JUAN', '2025-06-15', 'GUARDIA_REAL'),
    E('JUAN', '2026-01-31', 'GUARDIA_REAL'), E('JUAN', '2026-02-01', 'GUARDIA_REAL'),
    E('JUAN', '2026-02-10', 'LIBRE')
  ];
  const hints = accountingHints(groupNoteContext(entries), 'JUAN', { config: cfg, desde: '2026-01-01' });
  assert.deepEqual(hints.carryCredits, []);
});

test('daysFromEntries conserva la nota en la etiqueta', () => {
  const d = daysFromEntries([E('X', '2026-01-02', 'LIBRE', 'CH incid 1-7 dic')]);
  assert.equal(d[0].tags[0].meta.note, 'CH incid 1-7 dic');
});

test('el parser guarda la nota de la celda y separa los códigos combinados', async () => {
  const { parseSheetRows } = await import('../js/imports/cuadranteParser.js');
  const rows = [
    ['ENERO'],
    [46023, 1, 2, 3, 4, 5, 6, 7],
    ['', 'J', 'V', 'S', 'D', 'L', 'M', 'X'],
    ['REINOSO', 'CH', 'M JUI', '', '', 'B', 'AP', 'T']
  ];
  const notes = { '3,1': 'CH incid 22-28 diciembre', '3,2': 'Juicio Penal 18 11:30h', '3,5': 'Inicio baja', '3,6': 'AP 2025, 3º' };
  const e = parseSheetRows(rows, notes);
  const at = (date, type) => e.find(x => x.date === date && x.tagType === type);
  assert.equal(at('2026-01-01', 'LIBRE').note, 'CH incid 22-28 diciembre');
  assert.ok(at('2026-01-02', 'TURNO_M'));
  assert.equal(at('2026-01-02', 'JUICIO').note, 'Juicio Penal 18 11:30h');
  assert.equal(at('2026-01-05', 'BAJA').note, undefined);       // las notas de bajas no se guardan
  assert.equal(at('2026-01-06', 'AP').note, 'AP 2025, 3º');
});
