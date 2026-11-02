import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../services/publications/publicationView.js', import.meta.url), 'utf8');
const { textoFechaSuceso, textoCoordenadas, ubicacionExactaVisible, accionesDisponibles } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const userId = 'user-1';
const ownerId = 'user-owner';

function pub(overrides = {}) {
  return {
    id: 'pub-1',
    status: 'open',
    occurred_on: '2026-10-31',
    time_slot: 'afternoon',
    approx_latitude: -34.58,
    approx_longitude: -58.43,
    publisher: { id: ownerId },
    exact_location: { address: 'Calle 123' },
    viewer: { is_owner: false, can_claim: true, can_follow: true, can_manage: false, claim_action: 'its_mine', is_following: false },
    ...overrides,
  };
}

test('textoFechaSuceso y textoCoordenadas formatean correctamente', () => {
  assert.equal(textoFechaSuceso(pub()), '31/10/2026 · Tarde');
  assert.equal(textoFechaSuceso(pub({ time_slot: null })), '31/10/2026 · Franja horaria sin indicar');
  assert.equal(textoCoordenadas(pub()), '-34.58, -58.43 (aproximadas)');
});

test('ubicacionExactaVisible protege la caché compartida entre usuarios', () => {
  assert.equal(ubicacionExactaVisible(pub(), ownerId), true);
  assert.equal(ubicacionExactaVisible(pub(), userId), false);
  assert.equal(ubicacionExactaVisible(pub({ exact_location: null }), ownerId), false);
});

test('accionesDisponibles para un tercero en found/lost, dueño, resuelta y offline', () => {
  const found = accionesDisponibles(pub(), { isOnline: true });
  assert.equal(found.reclamo.titulo, 'Es mío');
  assert.equal(found.reclamo.habilitado, true);
  assert.equal(found.seguir.titulo, 'Seguir publicación');

  const lost = accionesDisponibles(pub({ viewer: { ...pub().viewer, claim_action: 'i_found_it' } }), { isOnline: true });
  assert.equal(lost.reclamo.titulo, 'Lo encontré');

  const owner = accionesDisponibles(pub({ viewer: { is_owner: true, can_claim: false, can_follow: false, can_manage: true } }), { isOnline: true });
  assert.equal(owner.reclamo.visible, false);
  assert.equal(owner.seguir.visible, false);
  assert.equal(owner.gestionar.visible, true);

  const resolved = accionesDisponibles(pub({ status: 'resolved', viewer: { ...pub().viewer, can_claim: false, can_follow: false } }), { isOnline: true });
  assert.equal(resolved.motivo, 'Esta publicación ya está resuelta.');

  const offline = accionesDisponibles(pub(), { isOnline: false });
  assert.equal(offline.reclamo.habilitado, false);
  assert.equal(offline.motivo, 'Necesitás conexión a internet para continuar.');
});
