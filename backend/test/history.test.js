// Punto 10: historial de casos resueltos, con una base simulada (sin PostgreSQL).
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { parseHistoryQuery, periodStart, serializeHistoryItem } from '../src/history-rules.js';
import { feedbackOutcome, feedbackTarget, validateRating, validateThanks } from '../src/feedback-rules.js';

const secret = 'history-unit-test-secret-1234567890';
const userId = '00000000-0000-4000-8000-000000000010';
const otherId = '00000000-0000-4000-8000-000000000020';
const strangerId = '00000000-0000-4000-8000-000000000030';
const returnId = '00000000-0000-4000-8000-0000000000e1';

// 15:00 UTC = 12:00 en Argentina.
const at = date => new Date(`${date}T15:00:00Z`);

test('periodStart convierte el período en el primer día incluido (hora de Argentina)', () => {
  assert.equal(periodStart('mes', at('2026-11-03')), '2026-10-03');
  assert.equal(periodStart('3meses', at('2026-11-03')), '2026-08-03');
  assert.equal(periodStart('anio', at('2026-11-03')), '2026-01-01');
  assert.equal(periodStart('todo', at('2026-11-03')), null);
  // Día inexistente en el mes destino: último día de ese mes.
  assert.equal(periodStart('mes', at('2026-03-31')), '2026-02-28');
  assert.equal(periodStart('3meses', at('2026-01-15')), '2025-10-15');
  // 1 de enero a las 01:00 UTC todavía es 31 de diciembre en Argentina.
  assert.equal(periodStart('anio', new Date('2026-01-01T01:00:00Z')), '2025-01-01');
});

test('parseHistoryQuery valida período y categoría', () => {
  const now = at('2026-11-03');
  assert.deepEqual(parseHistoryQuery({}, now), { value: { period: 'todo', date_from: null, category: null } });
  assert.deepEqual(parseHistoryQuery({ period: 'mes', category: 'keys' }, now), { value: { period: 'mes', date_from: '2026-10-03', category: 'keys' } });
  assert.equal(parseHistoryQuery({ period: 'semana' }, now).error, 'Período inválido.');
  assert.equal(parseHistoryQuery({ category: 'autos' }, now).error, 'Categoría inválida.');
  assert.equal(parseHistoryQuery({ period: ['mes', 'anio'] }, now).error, 'Parámetros del historial inválidos.');
});

test('serializeHistoryItem arma objeto, contraparte y estado de valoraciones', () => {
  const row = {
    id: 'r1', claim_id: 'c1', returned_at: at('2026-11-01'), publication_id: 'p1', publication_type: 'found',
    publication_title: 'DNI', publication_category: 'documents', cover_photo_id: 'f1', counterpart_id: otherId, counterpart_name: '',
    feedback_until: at('2026-11-08'), feedback_open: true, given_rating: null, received_rating: null, thanks: null,
  };
  assert.deepEqual(serializeHistoryItem(row, 'recoverer'), {
    id: 'r1', claim_id: 'c1', returned_at: at('2026-11-01'),
    publication: { id: 'p1', type: 'found', title: 'DNI', category: 'documents', cover_photo_url: '/publications/p1/photos/f1' },
    counterpart: { id: otherId, name: 'Vecino de Hallado' },
    feedback: { until: at('2026-11-08'), open: true, given_rating: null, received_rating: null, thanks: null, can_rate: true, can_thank: true },
  });
  // Quien devolvió no agradece; ya valorado no se puede volver a valorar; vencido, nada.
  assert.equal(serializeHistoryItem(row, 'returner').feedback.can_thank, false);
  const rated = serializeHistoryItem({ ...row, given_rating: { value: -1, message: 'No vino', created_at: 'x' } }, 'recoverer').feedback;
  assert.deepEqual([rated.can_rate, rated.given_rating], [false, { value: 'negative', message: 'No vino', created_at: 'x' }]);
  const closed = serializeHistoryItem({ ...row, feedback_open: false }, 'recoverer').feedback;
  assert.deepEqual([closed.can_rate, closed.can_thank], [false, false]);
});

test('validateRating y validateThanks: valor obligatorio, mensaje de hasta 200 caracteres', () => {
  assert.deepEqual(validateRating({ value: 'positive' }), { value: { value: 1, message: '' } });
  assert.deepEqual(validateRating({ value: 'negative', message: '  No  vino  ' }), { value: { value: -1, message: 'No vino' } });
  assert.ok(validateRating({ value: 'muy bueno' }).error);
  assert.ok(validateRating({ value: 'toString' }).error);
  assert.ok(validateRating(null).error);
  assert.ok(validateRating({ value: 'positive', message: 'x'.repeat(201) }).error);
  assert.deepEqual(validateThanks({ message: '¡Gracias!' }), { value: { message: '¡Gracias!' } });
  assert.equal(validateThanks({ message: '   ' }).error, 'Escribí tu agradecimiento.');
  assert.ok(validateThanks({ message: 'x'.repeat(201) }).error);
  assert.ok(validateThanks(undefined).error);
});

test('feedbackOutcome: participantes, agradecimiento solo de quien recupera y plazo de 7 días', () => {
  const ret = { returner_id: userId, recoverer_id: otherId, feedback_open: true };
  assert.equal(feedbackOutcome(ret, userId, 'rating'), 'ok');
  assert.equal(feedbackOutcome(ret, otherId, 'rating'), 'ok');
  assert.equal(feedbackOutcome(ret, strangerId, 'rating'), 'not_found');
  assert.equal(feedbackOutcome(undefined, userId, 'rating'), 'not_found');
  assert.equal(feedbackOutcome(ret, userId, 'thanks'), 'not_recoverer');
  assert.equal(feedbackOutcome(ret, otherId, 'thanks'), 'ok');
  assert.equal(feedbackOutcome({ ...ret, feedback_open: false }, otherId, 'rating'), 'window_closed');
  assert.equal(feedbackTarget(ret, userId), otherId);
  assert.equal(feedbackTarget(ret, otherId), userId);
});

// userId devolvió y otherId recuperó. feedbackOpen simula el plazo de 7 días.
function makeDatabase({ feedbackOpen = true } = {}) {
  const calls = [];
  const events = new Set();
  const row = role => ({
    id: `r-${role}`, claim_id: 'c1', returned_at: at('2026-11-01'), publication_id: 'p1', publication_type: 'found',
    publication_title: 'DNI', publication_category: 'documents', cover_photo_id: null, counterpart_id: otherId, counterpart_name: 'Ana',
    feedback_until: at('2026-11-08'), feedback_open: true, given_rating: null, received_rating: null, thanks: null,
  });
  const database = {
    calls,
    async transaction(run) { return run(database); },
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (/SELECT session_version FROM public\.users WHERE id=\$1/.test(sql)) return { rowCount: 1, rows: [{ session_version: 0 }] };
      if (/FROM public\.returns WHERE id = \$1/.test(sql)) {
        return values[0] === returnId
          ? { rowCount: 1, rows: [{ id: returnId, returner_id: userId, recoverer_id: otherId, feedback_open: feedbackOpen }] }
          : { rowCount: 0, rows: [] };
      }
      if (/INSERT INTO public\.reputation_events/.test(sql)) {
        const key = `${values[0]}|${values[1]}|${values[2]}`;
        if (events.has(key)) return { rowCount: 0, rows: [] };
        events.add(key);
        return { rowCount: 1, rows: [{ id: 'x' }] };
      }
      if (/WHERE r\.returner_id = \$1/.test(sql)) return { rowCount: 1, rows: [row('returned')] };
      if (/WHERE r\.recoverer_id = \$1/.test(sql)) return { rowCount: 1, rows: [row('recovered')] };
      throw new Error(`Consulta inesperada en el mock: ${sql}`);
    },
  };
  return database;
}

async function withServer(database, run) {
  const tokens = createSessionTokens(secret);
  const server = createApp(database, undefined, undefined, tokens).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, as, body) => {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(as ? { Authorization: `Bearer ${tokens.sign(as, 0)}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    await run(request);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

test('GET /history devuelve "Devolví" y "Recuperé" con los filtros convertidos a fechas', async () => {
  const database = makeDatabase();
  await withServer(database, async get => {
    const { status, body } = await get('/history?period=anio&category=documents', userId);
    assert.equal(status, 200);
    assert.equal(body.filters.period, 'anio');
    assert.match(body.filters.date_from, /^\d{4}-01-01$/);
    assert.deepEqual([body.returned[0].id, body.recovered[0].id], ['r-returned', 'r-recovered']);
    assert.equal(body.returned[0].counterpart.name, 'Ana');
  });
  const queries = database.calls.filter(call => /FROM public\.returns r/.test(call.sql));
  assert.equal(queries.length, 2);
  for (const call of queries) {
    assert.equal(call.values[0], userId);
    assert.match(call.values[1], /^\d{4}-01-01$/);
    assert.equal(call.values[2], 'documents');
  }
});

test('GET /history: sin filtros trae todo; errores de sesión y de parámetros', async () => {
  const database = makeDatabase();
  await withServer(database, async get => {
    assert.equal((await get('/history')).status, 401);
    assert.equal((await get('/history?period=ayer', userId)).status, 400);
    assert.equal((await get('/history?category=autos', userId)).status, 400);
    const all = await get('/history', userId);
    assert.equal(all.status, 200);
    assert.deepEqual(all.body.filters, { period: 'todo', date_from: null, category: null });
  });
  const last = database.calls.filter(call => /FROM public\.returns r/.test(call.sql)).at(-1);
  assert.deepEqual(last.values, [userId, null, null]);
});

test('POST /history/:id/rating: cada parte valora a la otra una sola vez', async () => {
  const database = makeDatabase();
  await withServer(database, async request => {
    const url = `/history/${returnId}/rating`;
    assert.equal((await request(url, undefined, { value: 'positive' })).status, 401);
    assert.equal((await request('/history/no-es-uuid/rating', otherId, { value: 'positive' })).status, 400);
    assert.equal((await request(url, otherId, { value: 'genial' })).status, 400);
    assert.equal((await request(url, strangerId, { value: 'positive' })).status, 404);
    assert.equal((await request(url, otherId, { value: 'positive', message: 'Muy amable' })).status, 201);
    const again = await request(url, otherId, { value: 'negative' });
    assert.deepEqual([again.status, again.body.error], [409, 'Ya valoraste este caso.']);
    assert.equal((await request(url, userId, { value: 'negative', message: 'Llegó tarde' })).status, 201);
  });
  const ratings = database.calls.filter(call => /INSERT INTO public\.reputation_events/.test(call.sql)).map(call => call.values);
  // user_id (valorado), event_type, source_id, author_id, value, message
  assert.deepEqual(ratings[0], [userId, 'rating', returnId, otherId, 1, 'Muy amable']);
  assert.deepEqual(ratings.at(-1), [otherId, 'rating', returnId, userId, -1, 'Llegó tarde']);
});

test('POST /history/:id/thanks: solo quien recuperó, una vez y con mensaje', async () => {
  const database = makeDatabase();
  await withServer(database, async request => {
    const url = `/history/${returnId}/thanks`;
    assert.equal((await request(url, otherId, { message: '  ' })).status, 400);
    const holder = await request(url, userId, { message: 'Gracias' });
    assert.deepEqual([holder.status, holder.body.error], [403, 'El agradecimiento lo deja quien recuperó el objeto.']);
    assert.equal((await request(url, otherId, { message: '¡Gracias por devolverme el DNI!' })).status, 201);
    assert.equal((await request(url, otherId, { message: 'Otra vez gracias' })).status, 409);
  });
  const thanks = database.calls.find(call => /INSERT INTO public\.reputation_events/.test(call.sql));
  assert.deepEqual(thanks.values, [userId, 'thanks', returnId, otherId, 1, '¡Gracias por devolverme el DNI!']);
});

test('POST /history/:id/rating y /thanks: vencido el plazo de 7 días', async () => {
  const database = makeDatabase({ feedbackOpen: false });
  await withServer(database, async request => {
    const rating = await request(`/history/${returnId}/rating`, otherId, { value: 'positive' });
    assert.deepEqual([rating.status, rating.body.error], [409, 'Pasaron más de 7 días desde la devolución.']);
    assert.equal((await request(`/history/${returnId}/thanks`, otherId, { message: 'Gracias' })).status, 409);
  });
  assert.equal(database.calls.some(call => /INSERT INTO public\.reputation_events/.test(call.sql)), false);
});
