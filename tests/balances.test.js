import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalances, upcomingEvents, guardsOfYear, countersFromBalances } from '../js/domain/balances.js';

const cfg = { asuntosAnuales: 8, vacacionesAnuales: 25, excludeWeekendsVacation: true, diasPorGuardia: 5 };
const tag = (dateISO, ...types) => ({ dateISO, tags: types.map(type => ({ type })) });
const credit = (dateISO, amount = 5) => ({ kind: 'CREDIT', category: 'GUARDIA', amount, dateISO, sourceRef: `G.${dateISO.slice(8)}/${dateISO.slice(5, 7)}` });
const debit = (dateISO, sourceRef = '') => ({ kind: 'DEBIT', category: 'LIBRE', amount: -1, dateISO, sourceRef });

// ─── Libres: ganar difiere, gastar reserva ───

test('libres: guardias futuras quedan "por generar"; libres futuros quedan "reservados"', () => {
  const ledger = [
    credit('2026-06-01'), credit('2026-06-29'),     // trabajadas
    credit('2026-11-09'), credit('2026-12-21'),     // futuras
    debit('2026-06-10'), debit('2026-07-01'),       // disfrutados
    debit('2026-11-20')                             // pedido a futuro
  ];
  const b = computeBalances([], ledger, cfg, { today: '2026-11-01' });
  assert.equal(b.libres.generados, 10);
  assert.equal(b.libres.porGenerar, 10);
  assert.equal(b.libres.disfrutados, 2);
  assert.equal(b.libres.reservados, 1);
  assert.equal(b.libres.disponibles, 7); // 10 − 2 − 1
  assert.equal(b.guardias.realizadas, 2);
  assert.equal(b.guardias.planificadas, 2);
  assert.deepEqual(b.guardias.proximas, ['2026-11-09', '2026-12-21']);
});

test('libres: el lunes de la guardia ya cuenta como generada ese mismo día', () => {
  const b = computeBalances([], [credit('2026-11-09')], cfg, { today: '2026-11-09' });
  assert.equal(b.libres.generados, 5);
  assert.equal(b.guardias.realizadas, 1);
  assert.equal(b.guardias.planificadas, 0);
});

test('libres: el arrastre manual se suma y lo anterior al corte se descuenta de él', () => {
  const config = { ...cfg, carryovers: { 2026: { libres: 4, primerLibre: '2026-03-01' } } };
  const ledger = [credit('2026-03-02'), debit('2026-01-15'), debit('2026-02-10'), debit('2026-03-10')];
  const b = computeBalances([], ledger, config, { today: '2026-11-01' });
  assert.equal(b.libres.delArrastre, 2);
  assert.equal(b.libres.arrastreRestante, 2);
  assert.equal(b.libres.disfrutados, 1);
  assert.equal(b.libres.disponibles, 6); // 2 restantes del arrastre + 5 − 1
});

test('libres: el saldo real puede ser negativo (pedido de más) y el contador lo muestra como 0', () => {
  // pedidos a futuro sin guardias que los cubran
  const b = computeBalances([], [debit('2026-11-20'), debit('2026-11-21')], cfg, { today: '2026-11-01' });
  assert.equal(b.libres.disponibles, -2);
  assert.equal(countersFromBalances(b).libresAcumulados, 0);
});

test('libres: solo cuenta el año pedido', () => {
  const b = computeBalances([], [credit('2025-12-01'), debit('2025-12-20')], cfg, { today: '2026-11-01' });
  assert.equal(b.libres.generados, 0);
  assert.equal(b.libres.disfrutados, 0);
});

// ─── AP y vacaciones: disfrutados + planificados contra el cupo ───

test('vacaciones: separa disfrutadas y planificadas (caso CARMEN en julio)', () => {
  const days = [
    tag('2026-01-02', 'VACACIONES'), tag('2026-03-30', 'VACACIONES'), tag('2026-03-31', 'VACACIONES'),
    tag('2026-04-01', 'VACACIONES'),
    tag('2026-08-03', 'VACACIONES'), tag('2026-08-04', 'VACACIONES'), tag('2026-08-08', 'VACACIONES') // sábado: no cuenta
  ];
  const b = computeBalances(days, [], cfg, { today: '2026-07-09' });
  assert.equal(b.vacaciones.disfrutados, 4);
  assert.equal(b.vacaciones.planificados, 2);
  assert.equal(b.vacaciones.disponibles, 19); // 25 − 4 − 2
});

test('AP: los anteriores a la fecha de corte son del año anterior y no tocan el cupo', () => {
  const days = ['01-20', '01-21', '02-05', '02-16', '03-04', '06-15', '06-16'].map(md => tag(`2026-${md}`, 'AP'));
  const config = { ...cfg, carryovers: { 2026: { ap: 5, primerAP: '2026-06-15' } } };
  const b = computeBalances(days, [], config, { today: '2026-11-01' });
  assert.equal(b.ap.delArrastre, 5);
  assert.equal(b.ap.arrastreRestante, 0);
  assert.equal(b.ap.disfrutados, 2);
  assert.equal(b.ap.disponibles, 6); // 8 − 2
});

test('AP: un cupo de 0 se respeta (no cae al valor por defecto)', () => {
  const b = computeBalances([tag('2026-12-02', 'AP')], [], { ...cfg, asuntosAnuales: 0 }, { today: '2026-11-01' });
  assert.equal(b.ap.cupo, 0);
  assert.equal(b.ap.disponibles, -1); // pedido a futuro por encima del cupo: se avisa
});

// ─── Guardias desde etiquetas (sin crédito en el ledger) ───

test('guardias: una semana con GUARDIA_REAL futura cuenta como planificada aunque no haya crédito', () => {
  const days = [tag('2026-12-22', 'GUARDIA_REAL'), tag('2026-12-23', 'GUARDIA_REAL'), tag('2026-02-17', 'GUARDIA_REAL')];
  const b = computeBalances(days, [], cfg, { today: '2026-11-01' });
  assert.equal(b.guardias.realizadas, 1);
  assert.equal(b.guardias.planificadas, 1);
  assert.deepEqual(b.guardias.proximas, ['2026-12-21']);
});

// ─── Próximos eventos ───

test('upcomingEvents agrupa tramos saltando fines de semana y ordena por fecha', () => {
  const days = [
    tag('2026-11-02', 'TURNO_M'),                       // turnos: no son eventos
    tag('2026-11-09', 'GUARDIA_REAL'), tag('2026-11-10', 'GUARDIA_REAL'),
    tag('2026-11-20', 'LIBRE'),
    tag('2026-12-04', 'VACACIONES'), tag('2026-12-07', 'VACACIONES'), tag('2026-12-08', 'VACACIONES'), // vie→lun→mar
    tag('2026-10-01', 'VACACIONES')                     // pasado: fuera
  ];
  const ev = upcomingEvents(days, '2026-11-01');
  assert.deepEqual(ev.map(e => [e.type, e.start, e.end, e.count]), [
    ['GUARDIA_REAL', '2026-11-09', '2026-11-15', 0],  // la guardia es la semana completa
    ['LIBRE', '2026-11-20', '2026-11-20', 1],
    ['VACACIONES', '2026-12-04', '2026-12-08', 3]
  ]);
  assert.equal(ev[0].inDays, 8);
});

test('guardsOfYear devuelve las guardias del año en orden con su consumo', () => {
  const ledger = [credit('2026-12-21'), credit('2026-02-16'), debit('2026-02-20', 'G.16/02'), credit('2025-12-01')];
  const g = guardsOfYear(ledger, 2026, 5, '2026-11-01');
  assert.deepEqual(g.map(x => [x.dateISO, x.used, x.worked]), [
    ['2026-02-16', 1, true],
    ['2026-12-21', 0, false]
  ]);
});


// ─── Caso JUAN (cuadrante real, 2/11/2026) ───
// Guardias: 9 feb, 18 may, 20 jul, 3 ago, 21 sep, 19 oct (trabajadas) y 14 dic.
// CH: 12 y 17 feb; 26, 28, 29 may; 2, 4, 8, 15, 19, 22 jun; 14-18 sep; 22 sep;
// 15 y 19 oct; 4 y 5 nov (pedidos). El del 22 jun no lo cubre ninguna guardia
// de 2026: es de 2025. A él le quedan 2 de agosto + 5 + 5 = 12 por disfrutar.
const juanLedger = () => [
  ...['2026-02-09', '2026-05-18', '2026-07-20', '2026-08-03', '2026-09-21', '2026-10-19', '2026-12-14'].map(d => credit(d)),
  ...['2026-02-12', '2026-02-17', '2026-05-26', '2026-05-28', '2026-05-29', '2026-06-02', '2026-06-04', '2026-06-08',
    '2026-06-15', '2026-06-19', '2026-06-22', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18',
    '2026-09-22', '2026-10-15', '2026-10-19', '2026-11-04', '2026-11-05'].map(d => debit(d))
];

test('caso JUAN: el libre que no cubre ninguna guardia del año cuenta como del año anterior', () => {
  const b = computeBalances([], juanLedger(), cfg, { today: '2026-11-02' });
  assert.equal(b.libres.generados, 30);
  assert.equal(b.libres.arrastreEstimado, 1);
  assert.deepEqual(b.libres.sinGuardia, ['2026-06-22']);
  assert.equal(b.libres.disfrutados, 18);
  assert.equal(b.libres.reservados, 2);
  assert.deepEqual(b.libres.reservadosFechas, ['2026-11-04', '2026-11-05']);
  assert.equal(b.libres.disponibles, 10);   // para pedir
  assert.equal(b.libres.porDisfrutar, 12);  // 2 de agosto + 5 + 5
});

test('caso JUAN: con arrastre indicado a mano no se estima nada', () => {
  const b = computeBalances([], juanLedger(), { ...cfg, carryovers: { 2026: { libres: 3 } } }, { today: '2026-11-02' });
  assert.equal(b.libres.arrastreEstimado, 0);
  assert.equal(b.libres.disfrutados, 19);
  assert.equal(b.libres.disponibles, 3 + 30 - 19 - 2);
});

test('guardsOfYear separa disfrutados de pedidos (agosto: 3 + 2)', () => {
  const ledger = [credit('2026-07-20'), credit('2026-08-03'),
    ...['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'].map(d => debit(d, 'G.20/07')),
    ...['2026-09-22', '2026-10-15', '2026-10-19', '2026-11-04', '2026-11-05'].map(d => debit(d, 'G.03/08'))];
  const ago = guardsOfYear(ledger, 2026, 5, '2026-11-02').find(g => g.dateISO === '2026-08-03');
  assert.equal(ago.used, 5);
  assert.equal(ago.enjoyed, 3);
  assert.equal(ago.requested, 2);
  assert.deepEqual(ago.requestedDates, ['2026-11-04', '2026-11-05']);
});

test('caso JUAN: AP que exceden el cupo ya disfrutados cuentan como del año anterior (los primeros)', () => {
  const ap = ['2026-01-09', '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16', '2026-01-23',
    '2026-02-06', '2026-02-13', '2026-02-19', '2026-02-20'].map(d => tag(d, 'AP'));
  const b = computeBalances(ap, [], cfg, { today: '2026-11-02' });
  assert.equal(b.ap.arrastreEstimado, 3);
  assert.deepEqual(b.ap.estimadoFechas, ['2026-01-09', '2026-01-12', '2026-01-13']);
  assert.equal(b.ap.disfrutados, 8);
  assert.equal(b.ap.disponibles, 0);
  // con arrastre indicado a mano, manda lo indicado
  const m = computeBalances(ap, [], { ...cfg, carryovers: { 2026: { ap: 3, primerAP: '2026-01-14' } } }, { today: '2026-11-02' });
  assert.equal(m.ap.arrastreEstimado, 0);
  assert.equal(m.ap.delArrastre, 3);
  assert.equal(m.ap.disponibles, 0);
});

// ─── Caducidad de los AP del año anterior (25 de marzo) ───

test('AP: los de antes del 25/03 gastan primero el arrastre; lo que sobra caduca', () => {
  const ap = ['2026-01-15', '2026-02-10', '2026-04-20', '2026-06-01'].map(d => tag(d, 'AP'));
  const conf = { ...cfg, carryovers: { 2026: { ap: 3 } } };
  // 1 de marzo: 2 AP del arrastre (ene, feb); queda 1 de arrastre hasta el 25/03
  const marzo = computeBalances(ap.slice(0, 2), [], conf, { today: '2026-03-01' });
  assert.equal(marzo.ap.delArrastre, 2);
  assert.equal(marzo.ap.disfrutados, 0);
  assert.equal(marzo.ap.arrastreRestante, 1);
  assert.equal(marzo.ap.caduca, '2026-03-25');
  assert.equal(marzo.ap.disponibles, 9);
  // noviembre: el que quedaba caducó; abril y junio son del cupo de 2026
  const nov = computeBalances(ap, [], conf, { today: '2026-11-03' });
  assert.equal(nov.ap.delArrastre, 2);
  assert.equal(nov.ap.arrastreCaducado, 1);
  assert.equal(nov.ap.arrastreRestante, 0);
  assert.equal(nov.ap.disfrutados, 2);
  assert.equal(nov.ap.disponibles, 6);
});

test('AP: la fecha de caducidad es configurable (por año o por regla del grupo)', () => {
  const ap = [tag('2026-04-10', 'AP')];
  const porAno = computeBalances(ap, [], { ...cfg, carryovers: { 2026: { ap: 1, caducaAP: '2026-04-30' } } }, { today: '2026-11-03' });
  assert.equal(porAno.ap.delArrastre, 1);      // 10/04 aún valía el de 2025
  const regla = computeBalances(ap, [], { ...cfg, apPlazo: '03-25', carryovers: { 2026: { ap: 1 } } }, { today: '2026-11-03' });
  assert.equal(regla.ap.delArrastre, 0);       // 10/04 ya no: cuenta en el cupo de 2026
  assert.equal(regla.ap.disfrutados, 1);
});

test('AP estimado: solo los anteriores a la caducidad pueden ser del año anterior', () => {
  // 9 AP con cupo 8: el sobrante solo puede ser uno de los anteriores al 25/03
  const ap = ['01-15', '02-02', '04-01', '04-02', '05-04', '05-05', '06-01', '06-02', '06-03'].map(md => tag(`2026-${md}`, 'AP'));
  const b = computeBalances(ap, [], cfg, { today: '2026-11-03' });
  assert.equal(b.ap.arrastreEstimado, 1);      // el del 15/01
  assert.deepEqual(b.ap.estimadoFechas, ['2026-01-15']);
  assert.equal(b.ap.disponibles, 0);
});

// ─── Libres concedidos que no computan ───
test('un libre marcado como concedido no resta ni consume guardia', () => {
  const ledger = [credit('2026-06-01'), debit('2026-06-10', 'G.01/06'), debit('2026-06-22', 'G.01/06')];
  const conf = { ...cfg, libresExentos: ['2026-06-22'] };
  const b = computeBalances([], ledger, conf, { today: '2026-11-02' });
  assert.equal(b.libres.disfrutados, 1);
  assert.equal(b.libres.disponibles, 4);
  assert.deepEqual(b.libres.concedidosFechas, ['2026-06-22']);
  const g = guardsOfYear(ledger, 2026, 5, '2026-11-02', conf.libresExentos)[0];
  assert.equal(g.used, 1);
});

// ─── Guardia que cruza de año: cuenta en el año en que termina (caso MARIO) ───
test('caso MARIO: la guardia del 29/12/2025 al 04/01/2026 cuenta en 2026', async () => {
  const { guardYear } = await import('../js/domain/reconcile.js');
  assert.equal(guardYear('2025-12-29'), 2026);
  assert.equal(guardYear('2026-12-28'), 2027);
  assert.equal(guardYear('2026-12-21'), 2026);

  const ledger = [credit('2025-12-22'), credit('2025-12-29'), credit('2026-01-12'),
    debit('2026-01-13', 'G.29/12'), debit('2026-01-14', 'G.29/12'), debit('2026-01-15', 'G.29/12')];
  const days = [tag('2025-12-31', 'GUARDIA_REAL'), tag('2026-01-01', 'GUARDIA_REAL'), tag('2026-01-04', 'GUARDIA_REAL')];
  const b26 = computeBalances(days, ledger, cfg, { today: '2026-11-03' });
  assert.equal(b26.libres.generados, 10);          // 29/12 + 12/01
  assert.equal(b26.guardias.realizadas, 2);
  assert.equal(b26.libres.disfrutados, 3);
  assert.equal(b26.libres.arrastreEstimado, 0);    // cubiertos por la guardia de 2026
  assert.equal(b26.libres.disponibles, 7);
  const g = guardsOfYear(ledger, 2026, 5, '2026-11-03');
  assert.deepEqual(g.map(x => `${x.dateISO}:${x.used}`), ['2025-12-29:3', '2026-01-12:0']);

  const b25 = computeBalances(days, ledger, cfg, { today: '2026-11-03', year: 2025 });
  assert.equal(b25.libres.generados, 5);           // solo la del 22/12 (termina en 2025)
  assert.equal(b25.guardias.realizadas, 1);
});

test('guardias realizadas: el festivo pegado no suma otra guardia', () => {
  const days = ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'].map(d => tag(d, 'GUARDIA_REAL'));
  const b = computeBalances(days, [credit('2026-10-05')], cfg, { today: '2026-11-03' });
  assert.equal(b.guardias.realizadas, 1);
  assert.equal(b.libres.generados, 5);
});

// ─── Caso TESA: 3 días por guardia (fin de semana) y 2 por festivo suelto ───
test('caso TESA: festivo suelto = 2 días (no es guardia); guardia de fin de semana = 3', async () => {
  const { planLedgerFromDays } = await import('../js/domain/reconcile.js');
  const conf = { ...cfg, diasPorGuardia: 3, diasPorFestivo: 2 };
  const inc = d => tag(d, 'GUARDIA_REAL');
  const days = [inc('2026-01-06'), inc('2026-08-22'), inc('2026-08-23'), inc('2026-10-09'), inc('2026-12-05'), inc('2026-12-06'),
    ...['2026-01-09', '2026-01-12', '2026-09-01', '2026-09-18', '2026-09-21', '2026-10-23', '2026-10-26'].map(d => tag(d, 'LIBRE'))];
  const plan = planLedgerFromDays(days, [], conf);
  assert.deepEqual(plan.creditsToAdd.map(c => `${c.sourceRef}:${c.amount}${c.festivo ? 'F' : ''}`),
    ['F.06/01:2F', 'G.17/08:3', 'F.09/10:2F', 'G.30/11:3']);
  // cada libre a su compensación: ene → festivo 6/1, sep → guardia de agosto, oct → festivo 9/10
  assert.deepEqual(plan.debitsToAdd.map(d => `${d.dateISO}>${d.sourceRef}`), [
    '2026-01-09>F.06/01', '2026-01-12>F.06/01', '2026-09-01>G.17/08', '2026-09-18>G.17/08', '2026-09-21>G.17/08',
    '2026-10-23>F.09/10', '2026-10-26>F.09/10']);

  const ledger = [
    ...plan.creditsToAdd.map(c => ({ kind: 'CREDIT', category: 'GUARDIA', amount: c.amount, dateISO: c.dateISO, sourceRef: c.sourceRef, ...(c.festivo ? { festivo: true } : {}) })),
    ...plan.debitsToAdd.map(d => debit(d.dateISO, d.sourceRef))
  ];
  const b = computeBalances(days, ledger, conf, { today: '2026-11-03' });
  assert.equal(b.libres.generados, 7);         // 3 + 2 + 2
  assert.equal(b.libres.porGenerar, 3);        // guardia del 5-6 dic
  assert.equal(b.guardias.realizadas, 1);      // solo la de agosto es guardia
  assert.equal(b.guardias.festivos, 2);
  assert.equal(b.libres.disponibles, 0);
  const g = guardsOfYear(ledger, 2026, 3, '2026-11-03');
  assert.deepEqual(g.map(x => `${x.dateISO}:${x.used}/${x.total}${x.festivo ? 'F' : ''}`),
    ['2026-01-06:2/2F', '2026-08-17:3/3', '2026-10-09:2/2F', '2026-11-30:0/3']);
});

test('sin compensación de festivo configurada, un INC suelto sigue contando como guardia', async () => {
  const { planLedgerFromDays } = await import('../js/domain/reconcile.js');
  const plan = planLedgerFromDays([tag('2026-01-06', 'GUARDIA_REAL')], [], cfg);
  assert.deepEqual(plan.creditsToAdd.map(c => `${c.sourceRef}:${c.amount}`), ['G.05/01:5']);
});

test('upcomingEvents: la guardia es la semana entera aunque el INC solo esté en el fin de semana (Juan 14-20 dic)', () => {
  const days = [tag('2026-12-19', 'GUARDIA_REAL'), tag('2026-12-20', 'GUARDIA_REAL'),
    // Mario: guardia 29/12-04/01 con festivo pegado el 6/01
    tag('2026-12-31', 'GUARDIA_REAL'), tag('2027-01-01', 'GUARDIA_REAL'), tag('2027-01-03', 'GUARDIA_REAL'), tag('2027-01-06', 'GUARDIA_REAL')];
  const ev = upcomingEvents(days, '2026-11-03');
  assert.deepEqual(ev.map(e => [e.label, e.start, e.end, e.semana]), [
    ['Guardia', '2026-12-14', '2026-12-20', true],
    ['Guardia', '2026-12-28', '2027-01-06', true]
  ]);
  // festivo suelto con compensación propia (Tesa): un solo día
  const tesa = upcomingEvents([tag('2026-12-08', 'GUARDIA_REAL')], '2026-11-03', { separateFestivos: true });
  assert.deepEqual(tesa.map(e => [e.label, e.start, e.end]), [['Festivo (INC)', '2026-12-08', '2026-12-08']]);
});

test('AP y vacaciones guardan qué días son de cada grupo (para el detalle)', () => {
  const days = [
    ...['2026-01-09', '2026-01-12', '2026-01-13', '2026-02-06', '2026-11-20'].map(d => tag(d, 'AP')),
    ...['2026-08-03', '2026-08-04', '2026-08-08', '2026-12-21'].map(d => tag(d, 'VACACIONES'))   // 8/8 es sábado
  ];
  const b = computeBalances(days, [], { ...cfg, asuntosAnuales: 2 }, { today: '2026-11-03' });
  assert.deepEqual(b.ap.fechas, {
    anterior: ['2026-01-09', '2026-01-12', '2026-01-13'],   // pasan del cupo (2): de 2025
    disfrutados: ['2026-02-06'],
    pedidos: ['2026-11-20']
  });
  assert.deepEqual(b.vacaciones.fechas, { anterior: [], disfrutados: ['2026-08-03', '2026-08-04'], pedidos: ['2026-12-21'] });
});

// ─── Orden de compensación (v30) ───

const noted = (dateISO, guardMonday) => ({ ...debit(dateISO, `G.${guardMonday.slice(8)}/${guardMonday.slice(5, 7)}`), sourceDate: guardMonday });

test('por orden: si una guardia posterior ya se compensó entera, lo que queda de las anteriores no cuenta', () => {
  const ledger = [
    credit('2026-02-02'), credit('2026-03-02'), credit('2026-05-04'),
    noted('2026-02-10', '2026-02-02'), noted('2026-02-11', '2026-02-02'),           // febrero: 2 de 5
    ...['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-16'].map(d => noted(d, '2026-03-02')) // marzo: entera
  ];
  const b = computeBalances([], ledger, cfg, { today: '2026-06-01' });
  assert.equal(b.libres.cerrados, 3);              // febrero queda cerrada
  assert.equal(b.libres.disponibles, 5);           // solo la de mayo, entera
  const g = guardsOfYear(ledger, 2026, 5, '2026-06-01');
  assert.deepEqual(g.map(t => [t.dateISO, Boolean(t.cerrada)]), [['2026-02-02', true], ['2026-03-02', false], ['2026-05-04', false]]);
  assert.equal(g[0].cerradaPor, '2026-03-02');
});

test('por orden: sin una guardia posterior entera no se cierra nada (y lo ya pedido a una guardia se respeta)', () => {
  const ledger = [
    credit('2026-02-02'), credit('2026-03-02'),
    noted('2026-02-10', '2026-02-02'),
    noted('2026-03-10', '2026-03-02'), noted('2026-03-11', '2026-03-02'), noted('2026-07-01', '2026-03-02') // 2 disfrutados + 1 pedido
  ];
  const b = computeBalances([], ledger, cfg, { today: '2026-06-01' });
  assert.equal(b.libres.cerrados, 0);
  assert.equal(b.libres.disponibles, 6);           // 4 + 2
});

test('por orden: los días cogidos por adelantado los cubre su guardia aún por hacer', () => {
  const ledger = [
    credit('2026-02-02'), credit('2026-07-06'),
    ...['2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-16'].map(d => noted(d, '2026-02-02')),
    noted('2026-06-15', '2026-07-06'), noted('2026-06-16', '2026-07-06') // a cuenta de la guardia de julio
  ];
  const b = computeBalances([], ledger, cfg, { today: '2026-06-20' });
  assert.equal(b.libres.adelantados, 2);
  assert.equal(b.libres.disponibles, 0);           // antes salía −2
  assert.equal(b.libres.porGenerarLibres, 3);      // la de julio dará 3 más
});
