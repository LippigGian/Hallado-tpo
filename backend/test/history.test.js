// Punto 10: historial de casos resueltos, con una base simulada (sin PostgreSQL).
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { parseHistoryQuery, periodStart, serializeHistoryItem } from '../src/history-rules.js';

const secret = 'history-unit-test-secret-1234567890';
const userId = '00000000-0000-4000-8000-000000000010';
const otherId = '00000000-0000-4000-8000-000000000020';

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

test('serializeHistoryItem arma objeto y contraparte', () => {
  const row = {
    id: 'r1', claim_id: 'c1', returned_at: at('2026-11-01'), publication_id: 'p1', publication_type: 'found',
    publication_title: 'DNI', publication_category: 'documents', cover_photo_id: 'f1', counterpart_id: otherId, counterpart_name: '',
  };
  assert.deepEqual(serializeHistoryItem(row), {
    id: 'r1', claim_id: 'c1', returned_at: at('2026-11-01'),
    publication: { id: 'p1', type: 'found', title: 'DNI', category: 'documents', cover_photo_url: '/publications/p1/photos/f1' },
    counterpart: { id: otherId, name: 'Vecino de Hallado' },
  });
});

function makeDatabase() {
  const calls = [];
  const row = role => ({
    id: `r-${role}`, claim_id: 'c1', returned_at: at('2026-11-01'), publication_id: 'p1', publication_type: 'found',
    publication_title: 'DNI', publication_category: 'documents', cover_photo_id: null, counterpart_id: otherId, counterpart_name: 'Ana',
  });
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (/SELECT session_version FROM public\.users WHERE id=\$1/.test(sql)) return { rowCount: 1, rows: [{ session_version: 0 }] };
      if (/WHERE r\.returner_id = \$1/.test(sql)) return { rowCount: 1, rows: [row('returned')] };
      if (/WHERE r\.recoverer_id = \$1/.test(sql)) return { rowCount: 1, rows: [row('recovered')] };
      throw new Error(`Consulta inesperada en el mock: ${sql}`);
    },
  };
}

async function withServer(database, run) {
  const tokens = createSessionTokens(secret);
  const server = createApp(database, undefined, undefined, tokens).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (path, as) => {
    const response = await fetch(base + path, { headers: as ? { Authorization: `Bearer ${tokens.sign(as, 0)}` } : {} });
    return { status: response.status, body: await response.json() };
  };
  try {
    await run(get);
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
