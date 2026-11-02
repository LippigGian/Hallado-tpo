import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
import {
  acceptOutcome, holderId, proposalOutcome, roleOf, serializeAgreement, validateProposal,
} from '../src/meeting-point-rules.js';

const publisher = '00000000-0000-4000-8000-000000000001';
const claimant = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';
const claimId = '00000000-0000-4000-8000-0000000000c1';

const ownerClaim = { id: claimId, kind: 'owner', status: 'accepted', claimant_id: claimant, publisher_id: publisher };
const finderClaim = { ...ownerClaim, kind: 'finder' };
const proposal = (by, extra = {}) => ({
  id: `p-${by}-${extra.n || 1}`, proposed_by: by, address: 'Plaza Serrano, Palermo', schedule: 'Sábado 11 h', reference: '', accepted_at: null, created_at: new Date('2026-11-02T12:00:00Z'), ...extra,
});

test('quien tiene el objeto: el publicador en "Es mío" y quien reclamó en "Lo encontré"', () => {
  assert.equal(holderId(ownerClaim), publisher);
  assert.equal(holderId(finderClaim), claimant);
  assert.equal(roleOf(ownerClaim, publisher), 'tiene_objeto');
  assert.equal(roleOf(ownerClaim, claimant), 'otra_parte');
  assert.equal(roleOf(finderClaim, claimant), 'tiene_objeto');
});

test('la propuesta exige dirección (5 a 200) y horario, y recorta espacios', () => {
  assert.deepEqual(validateProposal({ direccion: '  Plaza Serrano ', horario: ' Sábado 11 h ', referencia: ' Banco verde ' }).value,
    { address: 'Plaza Serrano', schedule: 'Sábado 11 h', reference: 'Banco verde' });
  assert.match(validateProposal({ direccion: 'abc', horario: 'hoy' }).error, /dirección/);
  assert.match(validateProposal({ direccion: 'x'.repeat(201), horario: 'hoy' }).error, /dirección/);
  assert.match(validateProposal({ direccion: 'Plaza Serrano', horario: '   ' }).error, /horario/);
  assert.match(validateProposal({ direccion: 'Plaza Serrano', horario: 'hoy', referencia: 'x'.repeat(201) }).error, /referencia/);
  assert.match(validateProposal(null).error, /dirección/);
});

test('el primer punto lo propone quien tiene el objeto y nadie propone dos veces seguidas', () => {
  assert.equal(proposalOutcome(ownerClaim, [], publisher), 'ok');
  assert.equal(proposalOutcome(ownerClaim, [], claimant), 'not_holder');
  assert.equal(proposalOutcome(finderClaim, [], claimant), 'ok');
  assert.equal(proposalOutcome(ownerClaim, [proposal(publisher)], publisher), 'own_turn');
  assert.equal(proposalOutcome(ownerClaim, [proposal(publisher)], claimant), 'ok');
  assert.equal(proposalOutcome({ ...ownerClaim, status: 'pending' }, [], publisher), 'claim_not_accepted');
});

test('acepta solo la otra parte la última propuesta, y una sola vez', () => {
  assert.equal(acceptOutcome(ownerClaim, [], claimant), 'no_proposal');
  assert.equal(acceptOutcome(ownerClaim, [proposal(publisher)], publisher), 'own_proposal');
  assert.equal(acceptOutcome(ownerClaim, [proposal(publisher)], claimant), 'ok');
  assert.equal(acceptOutcome(ownerClaim, [proposal(publisher), proposal(claimant)], publisher), 'ok');
  assert.equal(acceptOutcome(ownerClaim, [proposal(publisher, { accepted_at: new Date() })], claimant), 'already_agreed');
  assert.equal(proposalOutcome(ownerClaim, [proposal(publisher, { accepted_at: new Date() })], claimant), 'already_agreed');
});

test('la vista del acuerdo indica estado, rol y qué puede hacer quien mira', () => {
  const empty = serializeAgreement(ownerClaim, [], publisher);
  assert.equal(empty.estado, 'sin_propuesta');
  assert.equal(empty.rol, 'tiene_objeto');
  assert.equal(empty.puedeProponer, true);
  assert.equal(serializeAgreement(ownerClaim, [], claimant).puedeProponer, false);

  const proposed = serializeAgreement(ownerClaim, [proposal(publisher)], claimant);
  assert.equal(proposed.estado, 'propuesto');
  assert.equal(proposed.puedeResponder, true);
  assert.equal(proposed.propuestas[0].propuestoPor, 'tiene_objeto');
  assert.equal(proposed.propuestas[0].esMia, false);
  assert.equal(proposed.propuestas[0].direccion, 'Plaza Serrano, Palermo');

  const agreed = serializeAgreement(ownerClaim, [proposal(publisher), proposal(claimant, { n: 2, accepted_at: new Date() })], publisher);
  assert.equal(agreed.estado, 'aceptado');
  assert.equal(agreed.aceptado.propuestoPor, 'otra_parte');
  assert.equal(agreed.puedeResponder, false);
});

// --- HTTP con una base simulada ---------------------------------------------------------

function makeDatabase({ claim = ownerClaim, proposals = [] } = {}) {
  const state = { proposals: [...proposals] };
  const database = {
    state,
    async transaction(run) { return run(database); },
    async query(sql, values) {
      if (/UPDATE public\.claims SET status = 'expired'/.test(sql)) return { rowCount: 0, rows: [] };
      if (/FROM public\.users WHERE id=\$1/.test(sql)) {
        return [publisher, claimant, stranger].includes(values[0]) ? { rowCount: 1, rows: [{ session_version: 0 }] } : { rowCount: 0, rows: [] };
      }
      if (/FROM public\.claims c\s+JOIN public\.publications p ON p\.id = c\.publication_id\s+JOIN/.test(sql)) {
        return values[0] === claim.id ? { rowCount: 1, rows: [claim] } : { rowCount: 0, rows: [] };
      }
      if (/FOR UPDATE OF c/.test(sql)) return values[0] === claim.id ? { rowCount: 1, rows: [claim] } : { rowCount: 0, rows: [] };
      if (/FROM public\.meeting_point_proposals WHERE claim_id = \$1/.test(sql)) return { rowCount: state.proposals.length, rows: state.proposals };
      if (/INSERT INTO public\.meeting_point_proposals/.test(sql)) {
        state.proposals.push(proposal(values[1], { id: `p${state.proposals.length + 1}`, address: values[2], schedule: values[3], reference: values[4] }));
        return { rowCount: 1, rows: [] };
      }
      if (/UPDATE public\.meeting_point_proposals SET accepted_at = now\(\)/.test(sql)) {
        state.proposals = state.proposals.map(p => (p.id === values[0] ? { ...p, accepted_at: new Date() } : p));
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Consulta inesperada en el mock: ${sql}`);
    },
  };
  return database;
}

async function withServer(database, run) {
  const tokens = createSessionTokens('meeting-point-unit-test-secret-1234567');
  const server = createApp(database, undefined, undefined, tokens).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, user, { method = 'GET', body } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { ...(user ? { Authorization: `Bearer ${tokens.sign(user, 0)}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    await run(call);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

const path = `/claims/${claimId}/meeting-point`;
const punto = { direccion: 'Plaza Serrano, Palermo', horario: 'Sábado 11 h' };

test('HTTP: sesión, participantes e id válidos', async () => {
  await withServer(makeDatabase(), async call => {
    assert.equal((await call(path)).status, 401);
    assert.equal((await call('/claims/no-es-uuid/meeting-point', publisher)).status, 400);
    assert.equal((await call(path, stranger)).status, 404);
    const own = await call(path, publisher);
    assert.equal(own.status, 200);
    assert.equal(own.body.meeting_point.estado, 'sin_propuesta');
  });
});

test('HTTP: proponer, sugerir otro punto y aceptar', async () => {
  const database = makeDatabase();
  await withServer(database, async call => {
    assert.equal((await call(`${path}/proposals`, claimant, { method: 'POST', body: punto })).status, 409);
    assert.equal((await call(`${path}/proposals`, publisher, { method: 'POST', body: { direccion: 'ab', horario: '' } })).status, 400);

    const first = await call(`${path}/proposals`, publisher, { method: 'POST', body: punto });
    assert.equal(first.status, 201);
    assert.equal(first.body.meeting_point.estado, 'propuesto');
    assert.equal((await call(`${path}/proposals`, publisher, { method: 'POST', body: punto })).status, 409);
    assert.equal((await call(`${path}/accept`, publisher, { method: 'POST' })).status, 409);

    const alternative = await call(`${path}/proposals`, claimant, { method: 'POST', body: { direccion: 'Parque Centenario', horario: 'Domingo 10 h' } });
    assert.equal(alternative.status, 201);
    assert.equal(alternative.body.meeting_point.propuestas.length, 2);

    const accepted = await call(`${path}/accept`, publisher, { method: 'POST' });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.meeting_point.estado, 'aceptado');
    assert.equal(accepted.body.meeting_point.aceptado.direccion, 'Parque Centenario');
    assert.equal((await call(`${path}/accept`, claimant, { method: 'POST' })).status, 409);
    assert.equal((await call(`${path}/proposals`, claimant, { method: 'POST', body: punto })).status, 409);
  });
});

test('HTTP: no se acuerda punto de encuentro en un reclamo pendiente', async () => {
  await withServer(makeDatabase({ claim: { ...ownerClaim, status: 'pending' } }), async call => {
    const response = await call(`${path}/proposals`, publisher, { method: 'POST', body: punto });
    assert.equal(response.status, 409);
    assert.match(response.body.error, /aceptado el reclamo/);
  });
});
