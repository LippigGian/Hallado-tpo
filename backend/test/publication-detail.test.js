import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { canSeeExactLocation } from '../src/publication-access.js';

const secret = 'publication-detail-unit-test-secret-1234';
const publisherId = '00000000-0000-4000-8000-000000000010';
const viewerId = '00000000-0000-4000-8000-000000000020';

function publicationRow(overrides = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    type: 'found',
    title: 'Llavero con 3 llaves',
    description: 'Encontrado en la plaza.',
    category: 'keys',
    neighborhood: 'Palermo',
    occurred_on: '2026-10-31',
    time_slot: 'afternoon',
    status: 'open',
    approx_latitude: -34.58,
    approx_longitude: -58.43,
    exact_address: 'Honduras 4800',
    latitude: -34.5781,
    longitude: -58.4262,
    created_at: new Date('2026-10-31T12:00:00Z'),
    updated_at: new Date('2026-10-31T12:00:00Z'),
    publisher_id: publisherId,
    photo_ids: ['00000000-0000-4000-8000-0000000000b1'],
    followers_count: 2,
    publisher_name: 'Ana',
    publisher_neighborhood: 'Palermo',
    publisher_photo_mime: null,
    publisher_profile_updated_at: new Date('2026-01-01T00:00:00Z'),
    publisher_created_at: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeDatabase({ row = publicationRow(), following = false, repEvents = { completed_returns: 6, positive_ratings: 0, negative_ratings: 0 }, follow = {} } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      if (/FROM public\.users WHERE id=\$1/.test(sql)) {
        if (values[0] === viewerId || values[0] === publisherId) return { rowCount: 1, rows: [{ id: values[0], session_version: 0 }] };
        return { rowCount: 0, rows: [] };
      }
      if (/FROM public\.publications p JOIN public\.users u/.test(sql)) {
        if (!row || values[0] !== row.id) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [row] };
      }
      if (/FROM public\.publication_follows WHERE publication_id=\$1 AND user_id=\$2/.test(sql)) {
        return { rowCount: following ? 1 : 0, rows: following ? [{}] : [] };
      }
      if (/count\(\*\) FILTER \(WHERE event_type='return'\)/.test(sql)) {
        return { rowCount: 1, rows: [repEvents] };
      }
      if (/e\.event_type='thanks'/.test(sql)) {
        return { rowCount: 0, rows: [] };
      }
      if (/SELECT publisher_id,status FROM public\.publications WHERE id=\$1/.test(sql)) {
        return follow.notFound ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ publisher_id: follow.publisherId ?? publisherId, status: follow.status ?? 'open' }] };
      }
      if (/SELECT 1 FROM public\.publications WHERE id=\$1/.test(sql)) {
        return follow.notFound ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{}] };
      }
      if (/INSERT INTO public\.publication_follows/.test(sql)) {
        return { rowCount: 1, rows: [] };
      }
      if (/DELETE FROM public\.publication_follows/.test(sql)) {
        return { rowCount: 1, rows: [] };
      }
      if (/count\(\*\)::integer AS c FROM public\.publication_follows/.test(sql)) {
        return { rowCount: 1, rows: [{ c: follow.count ?? 1 }] };
      }
      throw new Error(`Consulta inesperada en el mock: ${sql}`);
    },
  };
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

// 1. id inválido / inexistente.
test('GET /publications/:id valida el id y responde 404 si no existe', async () => {
  const database = makeDatabase({ row: null });
  await withServer(database, async base => {
    assert.equal((await fetch(`${base}/publications/no-es-uuid`)).status, 400);
    const response = await fetch(`${base}/publications/${publicationRow().id}`);
    assert.equal(response.status, 404);
  });
});

// 2. Anónimo: sin ubicación exacta, sin autenticar, sin poder reclamar/seguir.
test('anónimo ve el detalle sin ubicación exacta ni acciones habilitadas', async () => {
  const database = makeDatabase();
  await withServer(database, async base => {
    const response = await fetch(`${base}/publications/${publicationRow().id}`);
    assert.equal(response.status, 200);
    const { publication } = await response.json();
    assert.equal(publication.exact_location, null);
    assert.equal(publication.viewer.authenticated, false);
    assert.equal(publication.viewer.can_claim, false);
    assert.equal(publication.viewer.can_follow, false);
    assert.equal(publication.viewer.claim_action, 'its_mine');
  });
});

// 3. Tercero autenticado: puede reclamar y seguir; found -> its_mine, lost -> i_found_it.
test('un tercero autenticado puede reclamar y seguir, según el tipo', async () => {
  const database = makeDatabase({ following: true });
  await withServer(database, async (base, tokens) => {
    const response = await fetch(`${base}/publications/${publicationRow().id}`, { headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } });
    const { publication } = await response.json();
    assert.equal(publication.viewer.can_claim, true);
    assert.equal(publication.viewer.can_follow, true);
    assert.equal(publication.viewer.is_following, true);
    assert.equal(publication.exact_location, null);
  });
  const lostDatabase = makeDatabase({ row: publicationRow({ type: 'lost' }) });
  await withServer(lostDatabase, async (base, tokens) => {
    const response = await fetch(`${base}/publications/${publicationRow().id}`, { headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } });
    const { publication } = await response.json();
    assert.equal(publication.viewer.claim_action, 'i_found_it');
  });
});

// 4. El dueño ve la ubicación exacta y puede gestionar, pero no reclamar ni seguir.
test('el dueño ve la dirección exacta y puede gestionar, no reclamar ni seguir', async () => {
  const database = makeDatabase();
  await withServer(database, async (base, tokens) => {
    const response = await fetch(`${base}/publications/${publicationRow().id}`, { headers: { Authorization: `Bearer ${tokens.sign(publisherId, 0)}` } });
    const { publication } = await response.json();
    assert.deepEqual(publication.exact_location, { address: 'Honduras 4800', latitude: -34.5781, longitude: -58.4262 });
    assert.equal(publication.viewer.is_owner, true);
    assert.equal(publication.viewer.can_manage, true);
    assert.equal(publication.viewer.can_claim, false);
    assert.equal(publication.viewer.can_follow, false);
  });
});

// 5. Resuelta: nadie puede reclamar ni seguir.
test('una publicación resuelta no admite reclamo ni seguimiento', async () => {
  const database = makeDatabase({ row: publicationRow({ status: 'resolved' }) });
  await withServer(database, async (base, tokens) => {
    const response = await fetch(`${base}/publications/${publicationRow().id}`, { headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } });
    const { publication } = await response.json();
    assert.equal(publication.viewer.can_claim, false);
    assert.equal(publication.viewer.can_follow, false);
  });
});

// 6. Nunca expone datos privados sueltos ni el historial de agradecimientos.
test('la respuesta nunca expone campos privados ni el historial de agradecimientos', async () => {
  const database = makeDatabase();
  await withServer(database, async base => {
    const response = await fetch(`${base}/publications/${publicationRow().id}`);
    const { publication } = await response.json();
    for (const field of ['latitude', 'longitude', 'exact_address', 'publisher_id']) assert.equal(field in publication, false);
    for (const field of ['email', 'phone']) assert.equal(field in publication.publisher, false);
    assert.equal('thanks' in publication.publisher.reputation, false);
  });
});

// 7. Seguir / dejar de seguir.
test('POST y DELETE /publications/:id/follow', async () => {
  await withServer(makeDatabase(), async base => {
    assert.equal((await fetch(`${base}/publications/${publicationRow().id}/follow`, { method: 'POST' })).status, 401);
  });
  await withServer(makeDatabase(), async (base, tokens) => {
    assert.equal((await fetch(`${base}/publications/no-es-uuid/follow`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } })).status, 400);
  });
  await withServer(makeDatabase({ follow: { notFound: true } }), async (base, tokens) => {
    assert.equal((await fetch(`${base}/publications/${publicationRow().id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } })).status, 404);
  });
  await withServer(makeDatabase({ follow: { publisherId: viewerId } }), async (base, tokens) => {
    assert.equal((await fetch(`${base}/publications/${publicationRow().id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } })).status, 400);
  });
  await withServer(makeDatabase({ follow: { status: 'resolved' } }), async (base, tokens) => {
    assert.equal((await fetch(`${base}/publications/${publicationRow().id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } })).status, 409);
  });
  await withServer(makeDatabase({ follow: { count: 3 } }), async (base, tokens) => {
    const response = await fetch(`${base}/publications/${publicationRow().id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { following: true, followers_count: 3 });
    const again = await fetch(`${base}/publications/${publicationRow().id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } });
    assert.equal(again.status, 200);
  });
  await withServer(makeDatabase({ follow: { count: 2 } }), async (base, tokens) => {
    const response = await fetch(`${base}/publications/${publicationRow().id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokens.sign(viewerId, 0)}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { following: false, followers_count: 2 });
  });
});

// 8. canSeeExactLocation en aislamiento.
test('canSeeExactLocation solo es true para el publicador', async () => {
  const publication = { publisher_id: publisherId };
  assert.equal(await canSeeExactLocation({}, publication, publisherId), true);
  assert.equal(await canSeeExactLocation({}, publication, viewerId), false);
  assert.equal(await canSeeExactLocation({}, publication, null), false);
});
