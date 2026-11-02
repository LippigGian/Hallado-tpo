import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { parseSearchQuery, photoUrl, searchPublications } from '../src/publication-search.js';

const secret = 'publications-unit-test-secret-123456789012';
const userId = '00000000-0000-4000-8000-000000000001';
const otherVersionUserId = '00000000-0000-4000-8000-000000000002';

function sampleRow(overrides = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    type: 'found',
    title: 'Llavero con 3 llaves',
    category: 'keys',
    neighborhood: 'Palermo',
    occurred_on: '2026-10-31',
    time_slot: 'afternoon',
    status: 'open',
    approx_latitude: -34.58,
    approx_longitude: -58.43,
    created_at: new Date('2026-10-31T12:00:00Z'),
    distance_km: null,
    photo_ids: ['00000000-0000-4000-8000-0000000000b1'],
    total: 12,
    ...overrides,
  };
}

function makeDatabase({ searchRows = [], searchError = false } = {}) {
  const calls = [];
  const database = {
    calls,
    // Los reclamos vencidos se actualizan antes de cada consulta (punto 7).
    async transaction(run) { return run(database); },
    async query(sql, values) {
      calls.push({ sql, values });
      if (/UPDATE public\.claims SET status = 'expired'/.test(sql)) return { rowCount: 0, rows: [] };
      if (/FROM public\.users WHERE id=\$1/.test(sql)) {
        if (values[0] === userId) return { rowCount: 1, rows: [{ id: userId, session_version: 0 }] };
        if (values[0] === otherVersionUserId) return { rowCount: 1, rows: [{ id: otherVersionUserId, session_version: 7 }] };
        return { rowCount: 0, rows: [] };
      }
      if (/FROM public\.publications p WHERE/.test(sql)) {
        if (searchError) throw new Error('conexión caída');
        return { rowCount: searchRows.length, rows: searchRows };
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
  try {
    await run(base, tokens);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

// 1. parseSearchQuery: cada caso de error 400.
test('parseSearchQuery valida cada parámetro', () => {
  assert.equal(parseSearchQuery({}).error, 'Indicá si perdiste o encontraste algo.');
  assert.equal(parseSearchQuery({ situation: ['lost', 'found'] }).error, 'Parámetros de búsqueda inválidos.');
  assert.equal(parseSearchQuery({ situation: 'lost', category: 'otra' }).error, 'Categoría inválida.');
  assert.equal(parseSearchQuery({ situation: 'lost', q: 'a'.repeat(101) }).error, 'Las palabras clave admiten hasta 100 caracteres.');
  assert.equal(parseSearchQuery({ situation: 'lost', neighborhood: '   ' }).error, 'Barrio o localidad inválido.');
  assert.equal(parseSearchQuery({ situation: 'lost', from: '2026-13-40' }).error, 'Revisá el rango de fechas (formato AAAA-MM-DD).');
  assert.equal(parseSearchQuery({ situation: 'lost', from: '2026-10-20', to: '2026-10-10' }).error, 'La fecha inicial no puede ser posterior a la final.');
  assert.equal(parseSearchQuery({ situation: 'lost', sort: 'random' }).error, 'Orden inválido.');
  assert.equal(parseSearchQuery({ situation: 'lost', lat: '10' }).error, 'Ubicación inválida.');
  assert.equal(parseSearchQuery({ situation: 'lost', lat: 'abc', lng: '10' }).error, 'Ubicación inválida.');
  assert.equal(parseSearchQuery({ situation: 'lost', sort: 'nearest' }).error, 'Para ordenar por cercanía indicá una ubicación.');
  assert.equal(parseSearchQuery({ situation: 'lost', page: '0' }).error, 'Paginación inválida.');
  assert.equal(parseSearchQuery({ situation: 'lost', page_size: '31' }).error, 'Paginación inválida.');
});

// 2. El tipo buscado es el opuesto a lo que le pasó a quien busca.
test('la búsqueda devuelve publicaciones del tipo opuesto', () => {
  assert.equal(parseSearchQuery({ situation: 'lost' }).type, 'found');
  assert.equal(parseSearchQuery({ situation: 'found' }).type, 'lost');
});

// 3. Filtros y paginación arman condiciones y valores.
test('los filtros agregan condiciones SQL y la paginación arma LIMIT/OFFSET', async () => {
  const database = makeDatabase({ searchRows: [] });
  const filters = parseSearchQuery({ situation: 'lost', category: 'keys', neighborhood: 'Palermo', from: '2026-10-01', to: '2026-10-31', page: '2', page_size: '5' });
  await searchPublications(database, filters);
  const { sql, values } = database.calls.at(-1);
  assert.match(sql, /p\.category=\$2/);
  assert.match(sql, /lower\(p\.neighborhood\)=lower\(\$3\)/);
  assert.match(sql, /\(p\.occurred_at AT TIME ZONE 'America\/Argentina\/Buenos_Aires'\)::date>=\$4::date/);
  assert.match(sql, /\(p\.occurred_at AT TIME ZONE 'America\/Argentina\/Buenos_Aires'\)::date<=\$5::date/);
  assert.match(sql, /LIMIT \$6 OFFSET \$7/);
  assert.deepEqual(values, ['found', 'keys', 'Palermo', '2026-10-01', '2026-10-31', 5, 5]);
});

// 4. Palabras clave: escape de comodines y descarte de términos cortos.
test('las palabras clave se normalizan, escapan y filtran por longitud', async () => {
  const database = makeDatabase({ searchRows: [] });
  const filters = parseSearchQuery({ situation: 'lost', q: 'Electrónica a 50%_x' });
  await searchPublications(database, filters);
  const { sql, values } = database.calls.at(-1);
  assert.match(sql, /translate\(lower\(p\.title\|\|' '\|\|p\.description\),'áéíóúüñ','aeiouun'\) LIKE \$2 ESCAPE '\\'/);
  assert.ok(values.includes('%electronica%'));
  assert.ok(values.includes('%50\\%\\_x%'));
  assert.ok(!values.some(v => v === '%a%'));
});

// 5. Estado visible, orden por cercanía y distance_km.
test('el buscador solo muestra abiertas/en reclamo y puede ordenar por cercanía', async () => {
  const database = makeDatabase({ searchRows: [sampleRow({ distance_km: 1.2 })] });
  const filters = parseSearchQuery({ situation: 'lost', sort: 'nearest', lat: '-34.58', lng: '-58.43' });
  const response = await searchPublications(database, filters);
  const { sql } = database.calls.at(-1);
  assert.match(sql, /\(p\.status='claimed' OR \(p\.status='open' AND p\.expires_at>now\(\)\)\)/);
  assert.match(sql, /ORDER BY distance_km ASC/);
  assert.equal(response.results[0].distance_km, 1.2);
});

// 6. Forma de la respuesta: nunca expone datos privados.
test('la respuesta arma las URLs de fotos y nunca expone datos privados', async () => {
  const database = makeDatabase({ searchRows: [sampleRow()] });
  const filters = parseSearchQuery({ situation: 'lost', page: '1', page_size: '10' });
  const response = await searchPublications(database, filters);
  assert.equal(response.total, 12);
  assert.equal(response.has_more, true);
  assert.deepEqual(response.results[0].photos, [{ id: '00000000-0000-4000-8000-0000000000b1', url: photoUrl('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1') }]);
  for (const field of ['latitude', 'longitude', 'address', 'user_id', 'verification_answer']) assert.equal(field in response.results[0], false);
  assert.doesNotMatch(database.calls.at(-1).sql, /p\.address|verification_answer/);
});

// 7. Autenticación opcional en GET /publications.
test('GET /publications acepta anónimo, rechaza token inválido o de sesión revocada', async () => {
  const database = makeDatabase({ searchRows: [sampleRow()] });
  await withServer(database, async (base, tokens) => {
    const anon = await fetch(`${base}/publications?situation=lost`);
    assert.equal(anon.status, 200);
    const badToken = await fetch(`${base}/publications?situation=lost`, { headers: { Authorization: 'Bearer invalido' } });
    assert.equal(badToken.status, 401);
    const revoked = await fetch(`${base}/publications?situation=lost`, { headers: { Authorization: `Bearer ${tokens.sign(otherVersionUserId, 0)}` } });
    assert.equal(revoked.status, 401);
    const ok = await fetch(`${base}/publications?situation=lost`, { headers: { Authorization: `Bearer ${tokens.sign(userId, 0)}` } });
    assert.equal(ok.status, 200);
  });
});

// 8. Un error de base no filtra detalles internos.
test('un error de base al buscar responde 503 sin filtrar detalles', async () => {
  const database = makeDatabase({ searchError: true });
  await withServer(database, async base => {
    const response = await fetch(`${base}/publications?situation=lost`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'No se pudo realizar la búsqueda.' });
  });
});

// 8b. Con 400 no se llega a consultar la base.
test('parámetros inválidos no generan ninguna consulta de búsqueda', async () => {
  const database = makeDatabase({ searchRows: [sampleRow()] });
  await withServer(database, async base => {
    const response = await fetch(`${base}/publications?situation=invalido`);
    assert.equal(response.status, 400);
    assert.equal(database.calls.some(c => /FROM public\.publications p WHERE/.test(c.sql)), false);
  });
});

// 9. Fotos de publicaciones.
test('GET /publications/:id/photos/:photoId sirve la foto o responde 400/404', async () => {
  const publicationId = '00000000-0000-4000-8000-0000000000a1';
  const photoId = '00000000-0000-4000-8000-0000000000b1';
  const bytes = Buffer.from('89504e470d0a1a0a', 'hex');
  const database = {
    async query(sql, values) {
      if (/FROM public\.publication_photos WHERE publication_id = \$1 AND id = \$2/.test(sql)) {
        if (values[0] === publicationId && values[1] === photoId) return { rowCount: 1, rows: [{ data: bytes, mime: 'image/png' }] };
        return { rowCount: 0, rows: [] };
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  };
  await withServer(database, async base => {
    assert.equal((await fetch(`${base}/publications/invalido/photos/${photoId}`)).status, 400);
    assert.equal((await fetch(`${base}/publications/${publicationId}/photos/00000000-0000-4000-8000-0000000000ff`)).status, 404);
    const ok = await fetch(`${base}/publications/${publicationId}/photos/${photoId}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'image/png');
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await ok.arrayBuffer()), bytes);
  });
});
