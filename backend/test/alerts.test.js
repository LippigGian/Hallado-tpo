// Punto 9: alertas, seguidas y novedades con una base simulada (sin PostgreSQL).
// La consulta real se verifica con `npm run test:alerts` (scripts/check-alerts.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { validateAlert, validateAlertUpdate } from '../src/alert-validation.js';
import { todayInArgentina } from '../src/dates.js';
import { alertFilters } from '../src/alert-service.js';

const secret = 'alerts-unit-test-secret-1234567890';
const userId = '00000000-0000-4000-8000-000000000030';
const otherId = '00000000-0000-4000-8000-000000000040';
const alertId = '00000000-0000-4000-8000-0000000000c1';
const publicationId = '00000000-0000-4000-8000-0000000000a1';

function alertRow(overrides = {}) {
  return {
    id: alertId,
    situation: 'lost',
    category: 'keys',
    neighborhood: 'Palermo',
    keywords: 'llavero azul',
    date_preset: '3dias',
    date_from: '2026-10-31',
    date_to: '2026-11-02',
    paused: false,
    last_seen_at: new Date('2026-11-01T12:00:00Z'),
    created_at: new Date('2026-11-01T12:00:00Z'),
    ...overrides,
  };
}

function makeDatabase({ alerts = [alertRow()], newCount = 2, follows = [], existingCount = null, duplicate = false } = {}) {
  const calls = [];
  const state = { alerts: alerts.map(a => ({ ...a })) };
  const database = {
    calls,
    state,
    async transaction(run) { return run(database); },
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (/UPDATE public\.claims SET status = 'expired'/.test(sql)) return { rowCount: 0, rows: [] };
      if (/SELECT session_version FROM public\.users WHERE id=\$1/.test(sql)) {
        return [userId, otherId].includes(values[0]) ? { rowCount: 1, rows: [{ session_version: 0 }] } : { rowCount: 0, rows: [] };
      }
      if (/FROM public\.users WHERE id=\$1 FOR UPDATE/.test(sql)) return { rowCount: 1, rows: [{}] };
      if (/SELECT count\(\*\)::integer AS c FROM public\.search_alerts WHERE user_id=\$1/.test(sql)) {
        return { rowCount: 1, rows: [{ c: existingCount ?? state.alerts.length }] };
      }
      if (/INSERT INTO public\.search_alerts/.test(sql)) {
        if (duplicate) return { rowCount: 0, rows: [] };
        const [, situation, category, neighborhood, keywords, date_preset, date_from, date_to] = values;
        const row = alertRow({ id: '00000000-0000-4000-8000-0000000000c2', situation, category, neighborhood, keywords, date_preset, date_from, date_to });
        state.alerts.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (/FROM public\.search_alerts WHERE user_id=\$1 ORDER BY/.test(sql)) {
        return { rowCount: state.alerts.length, rows: values[0] === userId ? state.alerts : [] };
      }
      // Antes que el SELECT por id: su regex también coincide con el DELETE.
      if (/DELETE FROM public\.search_alerts/.test(sql)) {
        const before = state.alerts.length;
        state.alerts = state.alerts.filter(a => !(a.id === values[0] && values[1] === userId));
        return { rowCount: before - state.alerts.length, rows: [] };
      }
      if (/FROM public\.search_alerts WHERE id=\$1 AND user_id=\$2/.test(sql)) {
        const row = values[1] === userId ? state.alerts.find(a => a.id === values[0]) : null;
        return row ? { rowCount: 1, rows: [row] } : { rowCount: 0, rows: [] };
      }
      if (/UPDATE public\.search_alerts\s+SET last_seen_at = CASE/.test(sql)) {
        const row = values[1] === userId ? state.alerts.find(a => a.id === values[0]) : null;
        if (!row) return { rowCount: 0, rows: [] };
        if (row.paused && !values[2]) row.last_seen_at = new Date();
        row.paused = values[2];
        return { rowCount: 1, rows: [row] };
      }
      if (/UPDATE public\.search_alerts SET last_seen_at=now\(\)/.test(sql)) {
        const row = values[1] === userId ? state.alerts.find(a => a.id === values[0]) : null;
        if (!row) return { rowCount: 0, rows: [] };
        row.last_seen_at = new Date();
        return { rowCount: 1, rows: [row] };
      }
      if (/SELECT count\(\*\)::integer AS c FROM public\.publications p WHERE/.test(sql)) {
        return { rowCount: 1, rows: [{ c: newCount }] };
      }
      if (/FROM public\.publications p WHERE .* ORDER BY p\.created_at DESC/s.test(sql)) {
        return {
          rowCount: 2,
          rows: [
            { id: publicationId, type: 'found', title: 'Llavero azul', category: 'keys', neighborhood: 'Palermo', occurred_on: '2026-11-01', time_slot: 'morning', status: 'open', photo_ids: [], is_new: true, total: 2 },
            { id: '00000000-0000-4000-8000-0000000000a2', type: 'found', title: 'Llaves', category: 'keys', neighborhood: 'Palermo', occurred_on: '2026-10-31', time_slot: 'night', status: 'claimed', photo_ids: [], is_new: false, total: 2 },
          ],
        };
      }
      if (/FROM public\.publication_follows f JOIN public\.publications p ON p\.id=f\.publication_id\s+WHERE f\.user_id=\$1\s+ORDER BY/.test(sql)) {
        return { rowCount: follows.length, rows: follows };
      }
      if (/SELECT count\(\*\)::integer AS c FROM public\.publication_follows f JOIN/.test(sql)) {
        return { rowCount: 1, rows: [{ c: follows.filter(f => f.has_update).length }] };
      }
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
  const request = async (path, { method = 'GET', body, as = userId } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(as ? { Authorization: `Bearer ${tokens.sign(as, 0)}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    await run(request);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

const NOW = new Date('2026-11-02T15:00:00Z'); // 12:00 en Argentina

test('validateAlert normaliza criterios y exige fechas concretas con su opción', () => {
  const { value } = validateAlert({
    situation: 'lost', category: 'keys', neighborhood: '  Palermo ', keywords: ' llavero   azul ',
    date_preset: 'hoy', date_from: '2026-11-02', date_to: '2026-11-02',
  }, NOW);
  assert.deepEqual(value, {
    situation: 'lost', category: 'keys', neighborhood: 'Palermo', keywords: 'llavero azul',
    date_preset: 'hoy', date_from: '2026-11-02', date_to: '2026-11-02',
  });

  // Sin fecha también es válida: coincide con cualquier fecha del suceso.
  assert.deepEqual(validateAlert({ situation: 'found', neighborhood: '', keywords: '' }, NOW).value, {
    situation: 'found', category: null, neighborhood: null, keywords: null, date_preset: null, date_from: null, date_to: null,
  });

  const errors = [
    [null, 'Datos de la alerta inválidos.'],
    [{ situation: 'otra' }, 'Indicá si perdiste o encontraste algo.'],
    [{ situation: 'lost', category: 'autos' }, 'Categoría inválida.'],
    [{ situation: 'lost', keywords: 'x'.repeat(101) }, 'Las palabras clave admiten hasta 100 caracteres.'],
    [{ situation: 'lost', neighborhood: 5 }, 'Barrio o localidad inválido.'],
    // La opción sin fechas concretas (o al revés) no se acepta.
    [{ situation: 'lost', date_preset: 'semana' }, 'Revisá el rango de fechas (formato AAAA-MM-DD).'],
    [{ situation: 'lost', date_from: '2026-11-01', date_to: '2026-11-02' }, 'Indicá cuándo pasó.'],
    [{ situation: 'lost', date_preset: 'ayer', date_from: '2026-11-01', date_to: '2026-11-02' }, 'Indicá cuándo pasó.'],
    [{ situation: 'lost', date_preset: 'rango', date_from: '2026-02-30', date_to: '2026-03-02' }, 'Revisá el rango de fechas (formato AAAA-MM-DD).'],
    [{ situation: 'lost', date_preset: 'rango', date_from: '2026-11-02', date_to: '2026-11-01' }, 'La fecha inicial no puede ser posterior a la final.'],
    [{ situation: 'lost', date_preset: 'rango', date_from: '2026-11-01', date_to: '2026-11-03' }, 'La fecha no puede ser futura.'],
  ];
  for (const [body, error] of errors) assert.equal(validateAlert(body, NOW).error, error, JSON.stringify(body));
});

test('todayInArgentina usa la zona de Buenos Aires', () => {
  assert.equal(todayInArgentina(new Date('2026-11-03T01:30:00Z')), '2026-11-02'); // 22:30 del 2 en Argentina
  assert.equal(todayInArgentina(new Date('2026-11-03T03:30:00Z')), '2026-11-03');
});

test('validateAlertUpdate solo acepta pausar o reanudar', () => {
  assert.deepEqual(validateAlertUpdate({ paused: true }).value, { paused: true });
  assert.ok(validateAlertUpdate({ paused: 'si' }).error);
  assert.ok(validateAlertUpdate(null).error);
});

test('alertFilters usa el tipo opuesto y las mismas palabras clave que el buscador', () => {
  assert.deepEqual(alertFilters(alertRow({ keywords: 'Llavero AZUL a' })), {
    type: 'found', category: 'keys', terms: ['llavero', 'azul'], neighborhood: 'Palermo', from: '2026-10-31', to: '2026-11-02',
  });
  assert.equal(alertFilters(alertRow({ situation: 'found' })).type, 'lost');
  assert.deepEqual(alertFilters(alertRow({ keywords: null })).terms, []);
});

test('las rutas del punto 9 requieren sesión', async () => {
  await withServer(makeDatabase(), async request => {
    for (const [method, path] of [['GET', '/alerts'], ['POST', '/alerts'], ['GET', '/follows'], ['GET', '/me/novelties'], ['DELETE', `/alerts/${alertId}`]]) {
      assert.equal((await request(path, { method, as: null })).status, 401, `${method} ${path}`);
    }
  });
});

test('GET /alerts devuelve cada alerta con sus publicaciones nuevas, excluyendo las propias', async () => {
  const database = makeDatabase({ alerts: [alertRow(), alertRow({ id: '00000000-0000-4000-8000-0000000000c3', paused: true })] });
  await withServer(database, async request => {
    const { status, body } = await request('/alerts');
    assert.equal(status, 200);
    assert.equal(body.max_alerts, 10);
    assert.deepEqual(body.alerts.map(a => [a.paused, a.new_count]), [[false, 2], [true, 0]]);
    assert.equal(body.alerts[0].date_from, '2026-10-31');
  });
  // Solo se cuentan las de la alerta activa, con las mismas condiciones que el buscador.
  const counts = database.calls.filter(call => /count\(\*\)::integer AS c FROM public\.publications p/.test(call.sql));
  assert.equal(counts.length, 1);
  const [count] = counts;
  assert.match(count.sql, /p\.status='claimed' OR \(p\.status='open' AND p\.expires_at>now\(\)\)/);
  assert.match(count.sql, /p\.user_id<>\$\d+/);
  assert.match(count.sql, /p\.created_at>\$\d+/);
  assert.deepEqual(count.values.slice(0, 2), ['found', 'keys']);
  assert.ok(count.values.includes(userId));
  assert.ok(count.values.includes('%llavero%') && count.values.includes('%azul%'));
});

test('el barrio se compara sin tildes, mayúsculas ni espacios en los extremos', async () => {
  const database = makeDatabase({ alerts: [alertRow({ neighborhood: 'Agronomía' })] });
  await withServer(database, async request => { await request('/alerts'); });
  const count = database.calls.find(call => /count\(\*\)::integer AS c FROM public\.publications p/.test(call.sql));
  assert.match(count.sql, /translate\(lower\(btrim\(p\.neighborhood\)\),'áéíóúüñ','aeiouun'\)=translate\(lower\(btrim\(\$\d+\)\),'áéíóúüñ','aeiouun'\)/);
  assert.ok(count.values.includes('Agronomía'));
});

test('la última vista se compara con microsegundos, no con el Date de JavaScript', async () => {
  // Un Date solo tiene milisegundos: .123456 pasaría a .123 y una publicación creada en .1234
  // (antes de la última vista) contaría como nueva.
  const exact = '2026-11-01 12:00:00.123456+00';
  const database = makeDatabase({ alerts: [alertRow({ last_seen_exact: exact })] });
  await withServer(database, async request => {
    await request('/alerts');
    await request(`/alerts/${alertId}/publications`);
  });
  const count = database.calls.find(call => /count\(\*\)::integer AS c FROM public\.publications p/.test(call.sql));
  const search = database.calls.find(call => /ORDER BY p\.created_at DESC/.test(call.sql));
  assert.ok(count.values.includes(exact));
  assert.ok(search.values.includes(exact));
});

test('POST /alerts crea la alerta, rechaza duplicados y respeta el tope', async () => {
  const body = { situation: 'lost', category: 'pets', neighborhood: 'Caballito', date_preset: 'semana', date_from: '2026-10-27', date_to: '2026-11-02' };
  const ok = makeDatabase({ alerts: [] });
  await withServer(ok, async request => {
    const created = await request('/alerts', { method: 'POST', body });
    assert.equal(created.status, 201);
    assert.equal(created.body.alert.new_count, 0);
    assert.equal(created.body.alert.date_preset, 'semana');
    assert.equal((await request('/alerts', { method: 'POST', body: { situation: 'x' } })).status, 400);
  });
  const insert = ok.calls.find(call => /INSERT INTO public\.search_alerts/.test(call.sql));
  assert.deepEqual(insert.values, [userId, 'lost', 'pets', 'Caballito', null, 'semana', '2026-10-27', '2026-11-02']);

  await withServer(makeDatabase({ duplicate: true }), async request => {
    const response = await request('/alerts', { method: 'POST', body });
    assert.deepEqual([response.status, response.body.code], [409, 'duplicate']);
  });
  await withServer(makeDatabase({ existingCount: 10 }), async request => {
    const response = await request('/alerts', { method: 'POST', body });
    assert.deepEqual([response.status, response.body.code], [409, 'limit']);
  });
});

test('PATCH /alerts/:id pausa y reanuda; al reanudar no acumula lo publicado en pausa', async () => {
  const database = makeDatabase({ alerts: [alertRow({ paused: true })] });
  await withServer(database, async request => {
    assert.equal((await request('/alerts/no-es-uuid', { method: 'PATCH', body: { paused: true } })).status, 400);
    assert.equal((await request(`/alerts/${alertId}`, { method: 'PATCH', body: {} })).status, 400);
    assert.equal((await request(`/alerts/${alertId}`, { method: 'PATCH', body: { paused: false }, as: otherId })).status, 404);
    const resumed = await request(`/alerts/${alertId}`, { method: 'PATCH', body: { paused: false } });
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.alert.paused, false);
    const paused = await request(`/alerts/${alertId}`, { method: 'PATCH', body: { paused: true } });
    assert.deepEqual([paused.body.alert.paused, paused.body.alert.new_count], [true, 0]);
  });
  const update = database.calls.find(call => /UPDATE public\.search_alerts\s+SET last_seen_at = CASE/.test(call.sql));
  assert.match(update.sql, /CASE WHEN paused AND NOT \$3::boolean THEN now\(\) ELSE last_seen_at END/);
});

test('DELETE /alerts/:id solo elimina alertas propias', async () => {
  const database = makeDatabase();
  await withServer(database, async request => {
    assert.equal((await request(`/alerts/${alertId}`, { method: 'DELETE', as: otherId })).status, 404);
    assert.deepEqual(await request(`/alerts/${alertId}`, { method: 'DELETE' }), { status: 200, body: { deleted: true } });
    assert.equal((await request(`/alerts/${alertId}`, { method: 'DELETE' })).status, 404);
  });
});

test('GET /alerts/:id/publications lista coincidencias marcando las nuevas, sin marcar la alerta como vista', async () => {
  const database = makeDatabase();
  await withServer(database, async request => {
    assert.equal((await request(`/alerts/${alertId}/publications?page=0`)).status, 400);
    assert.equal((await request(`/alerts/${alertId}/publications`, { as: otherId })).status, 404);
    const { status, body } = await request(`/alerts/${alertId}/publications`);
    assert.equal(status, 200);
    assert.equal(body.alert.id, alertId);
    assert.deepEqual(body.results.map(r => r.is_new), [true, false]);
    assert.equal(body.total, 2);
  });
  const search = database.calls.find(call => /ORDER BY p\.created_at DESC/.test(call.sql));
  assert.match(search.sql, /\(p\.created_at>\$\d+::timestamptz\) AS is_new/);
  assert.match(search.sql, /p\.user_id<>\$\d+/);
  assert.equal(database.calls.some(call => /UPDATE public\.search_alerts/.test(call.sql)), false);
});

test('POST /alerts/:id/seen deja la alerta sin novedades', async () => {
  await withServer(makeDatabase(), async request => {
    const { status, body } = await request(`/alerts/${alertId}/seen`, { method: 'POST' });
    assert.deepEqual([status, body.alert.new_count], [200, 0]);
    assert.equal((await request(`/alerts/${alertId}/seen`, { method: 'POST', as: otherId })).status, 404);
  });
});

test('GET /follows devuelve las seguidas con su novedad de estado', async () => {
  const follows = [
    { id: publicationId, type: 'found', title: 'Llavero', category: 'keys', neighborhood: 'Palermo', status: 'claimed', photo_ids: ['00000000-0000-4000-8000-0000000000b1'], last_seen_status: 'open', has_update: true, followed_at: new Date('2026-11-01T00:00:00Z') },
    { id: '00000000-0000-4000-8000-0000000000a2', type: 'lost', title: 'Perro', category: 'pets', neighborhood: 'Caballito', status: 'open', photo_ids: [], last_seen_status: 'open', has_update: false, followed_at: new Date('2026-10-30T00:00:00Z') },
  ];
  const database = makeDatabase({ follows });
  await withServer(database, async request => {
    const { status, body } = await request('/follows');
    assert.equal(status, 200);
    assert.deepEqual(body.publications.map(p => [p.status, p.previous_status, p.has_update]), [['claimed', 'open', true], ['open', 'open', false]]);
    assert.equal(body.publications[0].photos[0].url, `/publications/${publicationId}/photos/00000000-0000-4000-8000-0000000000b1`);
  });
  const list = database.calls.find(call => /FROM public\.publication_follows f JOIN/.test(call.sql));
  assert.match(list.sql, /f\.last_seen_status IS NOT NULL AND f\.last_seen_status<>CASE WHEN p\.status = 'open' AND p\.expires_at <= now\(\) THEN 'expired'/);
  assert.match(list.sql, /ORDER BY has_update DESC/);
});

test('GET /me/novelties suma las novedades de alertas activas y seguidas', async () => {
  const follows = [{ has_update: true }, { has_update: false }, { has_update: true }];
  const alerts = [alertRow(), alertRow({ id: '00000000-0000-4000-8000-0000000000c3' }), alertRow({ id: '00000000-0000-4000-8000-0000000000c4', paused: true })];
  await withServer(makeDatabase({ alerts, newCount: 3, follows }), async request => {
    assert.deepEqual(await request('/me/novelties'), {
      status: 200,
      body: { alerts: { new_publications: 6, with_news: 2 }, follows: { updated: 2 } },
    });
  });
  await withServer(makeDatabase({ alerts: [], follows: [] }), async request => {
    assert.deepEqual((await request('/me/novelties')).body, { alerts: { new_publications: 0, with_news: 0 }, follows: { updated: 0 } });
  });
});
