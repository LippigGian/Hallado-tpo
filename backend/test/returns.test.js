// Punto 10: devolución concretada, con una base simulada (sin PostgreSQL).
// La consulta real se verifica con `npm run test:returns` (scripts/check-returns.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { recovererId, returnerId, returnOutcome, serializeReturn } from '../src/return-rules.js';

const secret = 'returns-unit-test-secret-1234567890';
const publisherId = '00000000-0000-4000-8000-000000000010';
const claimantId = '00000000-0000-4000-8000-000000000020';
const strangerId = '00000000-0000-4000-8000-000000000030';
const claimId = '00000000-0000-4000-8000-0000000000d1';
const publicationId = '00000000-0000-4000-8000-0000000000a1';
const returnId = '00000000-0000-4000-8000-0000000000e1';

// "Es mío": el publicador encontró el objeto y quien reclama es el dueño.
const ownerClaim = { id: claimId, kind: 'owner', status: 'accepted', claimant_id: claimantId, publisher_id: publisherId, publication_id: publicationId };
// "Lo encontré": el publicador perdió el objeto y quien reclama lo encontró.
const finderClaim = { ...ownerClaim, kind: 'finder' };

test('quien devuelve tiene el objeto y quien recupera es la otra parte', () => {
  assert.deepEqual([returnerId(ownerClaim), recovererId(ownerClaim)], [publisherId, claimantId]);
  assert.deepEqual([returnerId(finderClaim), recovererId(finderClaim)], [claimantId, publisherId]);
});

test('solo quien recupera confirma, sobre un reclamo aceptado y una sola vez', () => {
  assert.equal(returnOutcome(ownerClaim, claimantId, false), 'ok');
  assert.equal(returnOutcome(finderClaim, publisherId, false), 'ok');
  assert.equal(returnOutcome(ownerClaim, publisherId, false), 'not_recoverer');
  assert.equal(returnOutcome(ownerClaim, strangerId, false), 'not_found');
  assert.equal(returnOutcome({ ...ownerClaim, status: 'pending' }, claimantId, false), 'claim_not_accepted');
  assert.equal(returnOutcome(ownerClaim, claimantId, true), 'already_returned');
});

test('serializeReturn indica el rol y si quien mira puede confirmar', () => {
  assert.deepEqual(serializeReturn(ownerClaim, claimantId), { returned: false, returned_at: null, role: 'recupera', can_confirm: true });
  assert.deepEqual(serializeReturn(ownerClaim, publisherId), { returned: false, returned_at: null, role: 'devuelve', can_confirm: false });
  const at = new Date('2026-11-03T15:00:00Z');
  assert.deepEqual(serializeReturn({ ...ownerClaim, return_id: returnId, returned_at: at }, claimantId), { returned: true, returned_at: at, role: 'recupera', can_confirm: false });
  assert.equal(serializeReturn({ ...ownerClaim, status: 'pending' }, claimantId).can_confirm, false);
});

function claimRow(claim, returned) {
  return {
    ...claim, publication_type: claim.kind === 'owner' ? 'found' : 'lost', publication_title: 'DNI', publication_category: 'documents',
    publication_neighborhood: 'Palermo', claimant_name: 'Ana', publisher_name: 'Bruno', has_photo: false,
    created_at: new Date(), expires_at: new Date(), responded_at: new Date(),
    return_id: returned ? returnId : null, returned_at: returned ? new Date('2026-11-03T15:00:00Z') : null,
  };
}

function makeDatabase({ claim = ownerClaim, alreadyReturned = false } = {}) {
  const calls = [];
  const state = { returned: alreadyReturned };
  const database = {
    calls,
    async transaction(run) { return run(database); },
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (/UPDATE public\.claims SET status = 'expired'/.test(sql)) return { rowCount: 0, rows: [] };
      if (/SELECT session_version FROM public\.users WHERE id=\$1/.test(sql)) {
        return [publisherId, claimantId, strangerId].includes(values[0]) ? { rowCount: 1, rows: [{ session_version: 0 }] } : { rowCount: 0, rows: [] };
      }
      if (/FOR UPDATE OF c, p/.test(sql)) {
        return values[0] === claim.id ? { rowCount: 1, rows: [{ ...claim, already_returned: state.returned }] } : { rowCount: 0, rows: [] };
      }
      if (/INSERT INTO public\.returns/.test(sql)) {
        state.returned = true;
        return { rowCount: 1, rows: [{ id: returnId, returned_at: new Date('2026-11-03T15:00:00Z') }] };
      }
      if (/UPDATE public\.publications SET status = 'resolved'/.test(sql)) return { rowCount: 1, rows: [] };
      if (/INSERT INTO public\.reputation_events/.test(sql)) return { rowCount: 1, rows: [{ id: 'x' }] };
      if (/LEFT JOIN public\.returns ret ON ret\.claim_id = c\.id/.test(sql)) {
        return values[0] === claim.id ? { rowCount: 1, rows: [claimRow(claim, state.returned)] } : { rowCount: 0, rows: [] };
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
  const post = async (path, as) => {
    const response = await fetch(base + path, { method: 'POST', headers: as ? { Authorization: `Bearer ${tokens.sign(as, 0)}` } : {} });
    return { status: response.status, body: await response.json() };
  };
  try {
    await run(post);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

test('POST /claims/:id/return: quien recupera confirma, se resuelve la publicación y suma a quien devolvió', async () => {
  const database = makeDatabase();
  await withServer(database, async post => {
    const { status, body } = await post(`/claims/${claimId}/return`, claimantId);
    assert.equal(status, 200);
    assert.equal(body.claim.return.returned, true);
    assert.equal(body.claim.return.role, 'recupera');
    assert.equal(body.claim.return.can_confirm, false);
  });
  const insert = database.calls.find(call => /INSERT INTO public\.returns/.test(call.sql));
  assert.deepEqual(insert.values, [claimId, publicationId, publisherId, claimantId]);
  assert.ok(database.calls.some(call => /UPDATE public\.publications SET status = 'resolved'/.test(call.sql) && call.values[0] === publicationId));
  const reputation = database.calls.find(call => /INSERT INTO public\.reputation_events/.test(call.sql));
  // user_id, event_type, source_id, author_id, value, message
  assert.deepEqual(reputation.values, [publisherId, 'return', returnId, claimantId, 1, '']);
});

test('POST /claims/:id/return: en "Lo encontré" la devolución suma a quien reclamó', async () => {
  const database = makeDatabase({ claim: finderClaim });
  await withServer(database, async post => {
    assert.equal((await post(`/claims/${claimId}/return`, publisherId)).status, 200);
  });
  const reputation = database.calls.find(call => /INSERT INTO public\.reputation_events/.test(call.sql));
  assert.deepEqual(reputation.values.slice(0, 4), [claimantId, 'return', returnId, publisherId]);
});

test('POST /claims/:id/return: errores de sesión, permisos y estado', async () => {
  await withServer(makeDatabase(), async post => {
    assert.equal((await post(`/claims/${claimId}/return`)).status, 401);
    assert.equal((await post('/claims/no-es-uuid/return', claimantId)).status, 400);
    assert.equal((await post(`/claims/${claimId}/return`, strangerId)).status, 404);
    const holder = await post(`/claims/${claimId}/return`, publisherId);
    assert.deepEqual([holder.status, holder.body.error], [403, 'La devolución la confirma quien recupera el objeto.']);
  });
  await withServer(makeDatabase({ claim: { ...ownerClaim, status: 'pending' } }), async post => {
    assert.equal((await post(`/claims/${claimId}/return`, claimantId)).status, 409);
  });
  const twice = makeDatabase();
  await withServer(twice, async post => {
    assert.equal((await post(`/claims/${claimId}/return`, claimantId)).status, 200);
    const again = await post(`/claims/${claimId}/return`, claimantId);
    assert.deepEqual([again.status, again.body.error], [409, 'La devolución ya fue confirmada.']);
  });
  assert.equal(twice.calls.filter(call => /INSERT INTO public\.returns/.test(call.sql)).length, 1);
});
