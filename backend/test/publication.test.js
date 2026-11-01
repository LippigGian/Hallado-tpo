import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImage } from '../src/image-validation.js';
import { validatePublication } from '../src/publication-validation.js';
import { serializePublication } from '../src/publication-view.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0]).toString('base64');
const now = new Date('2026-11-01T15:00:00Z');

function lostBody(overrides = {}) {
  return {
    type: 'lost',
    title: 'Llaves con llavero azul',
    description: 'Perdí un llavero con tres llaves en la plaza.',
    category: 'keys',
    occurred_at: '2026-10-31T18:30:00Z',
    neighborhood: 'Caballito',
    address: 'Av. Rivadavia 5000',
    photos: [PNG],
    ...overrides,
  };
}
const foundBody = (overrides = {}) => lostBody({
  type: 'found',
  verification_question: '¿De qué color es el llavero?',
  verification_answer: 'Azul',
  ...overrides,
});

test('parseImage detecta JPEG y PNG por su contenido y rechaza el resto', () => {
  assert.equal(parseImage(PNG).mime, 'image/png');
  assert.equal(parseImage(JPEG).mime, 'image/jpeg');
  assert.equal(parseImage(Buffer.from('GIF89a-no-soportado').toString('base64')), null);
  assert.equal(parseImage('no es base64!!'), null);
  assert.equal(parseImage(''), null);
  assert.equal(parseImage(42), null);
  assert.equal(parseImage('A'.repeat(3_000_000)), null);
});

test('una pérdida válida se normaliza y no lleva verificación', () => {
  const { error, value } = validatePublication(lostBody({ title: '  Llaves  ', latitude: -34.61, longitude: -58.43 }), now);
  assert.equal(error, undefined);
  assert.equal(value.title, 'Llaves');
  assert.equal(value.verification_question, null);
  assert.equal(value.latitude, -34.61);
  assert.equal(value.photos[0].mime, 'image/png');
  assert.ok(value.occurred_at instanceof Date);
});

test('un hallazgo exige pregunta y respuesta; una pérdida no las admite', () => {
  assert.equal(validatePublication(foundBody(), now).value.verification_answer, 'Azul');
  for (const missing of [{ verification_question: '' }, { verification_answer: undefined }, { verification_question: 'cort' }]) {
    assert.match(validatePublication(foundBody(missing), now).error, /verificación/);
  }
  assert.match(validatePublication(lostBody({ verification_question: '¿Color?' }), now).error, /encontrados/);
});

test('rechaza datos inválidos con un mensaje claro', () => {
  const cases = [
    [null, /Enviá los datos/],
    [[], /Enviá los datos/],
    [lostBody({ type: 'otro' }), /perdiste o encontraste/],
    [lostBody({ title: 'ab' }), /título/],
    [lostBody({ description: 'corta' }), /descripción/],
    [lostBody({ category: 'autos' }), /categoría/],
    [lostBody({ occurred_at: undefined }), /fecha/],
    [lostBody({ occurred_at: 'ayer' }), /fecha/],
    [lostBody({ occurred_at: '2026-11-02T15:00:00Z' }), /futura/],
    [lostBody({ occurred_at: '2025-01-01T00:00:00Z' }), /más de un año/],
    [lostBody({ neighborhood: '  ' }), /barrio/],
    [lostBody({ address: '' }), /dirección/],
    [lostBody({ latitude: -34.6 }), /latitud y longitud/],
    [lostBody({ latitude: 95, longitude: 0 }), /coordenadas/],
    [lostBody({ latitude: '1', longitude: '2' }), /coordenadas/],
    [lostBody({ photos: [] }), /entre 1 y 5 fotos/],
    [lostBody({ photos: undefined }), /entre 1 y 5 fotos/],
    [lostBody({ photos: Array(6).fill(PNG) }), /entre 1 y 5 fotos/],
    [lostBody({ photos: [PNG, 'basura'] }), /foto 2/],
    [lostBody({ status: 'resolved' }), /no permitido: status/],
    [lostBody({ user_id: 'otro' }), /no permitido: user_id/],
  ];
  for (const [body, expected] of cases) {
    assert.match(validatePublication(body, now).error ?? '', expected, JSON.stringify(body)?.slice(0, 80));
  }
});

test('las coordenadas son opcionales y solo se aceptan en pareja', () => {
  assert.equal(validatePublication(lostBody({ latitude: null, longitude: null }), now).value.latitude, null);
  assert.equal(validatePublication(lostBody(), now).value.longitude, null);
});

const row = {
  id: 'p1', user_id: 'owner', type: 'found', title: 'Llaves', description: 'Descripción larga',
  category: 'keys', occurred_at: '2026-10-31T18:30:00Z', neighborhood: 'Caballito', address: 'Av. Rivadavia 5000',
  latitude: -34.618765, longitude: -58.436789, verification_question: '¿Color?', verification_answer: 'Azul',
  status: 'open', expires_at: '2026-12-01T00:00:00Z', created_at: '2026-11-01T00:00:00Z', photo_ids: ['f1', 'f2'],
};

test('quien publica ve todo; el resto no ve la dirección exacta ni la respuesta', () => {
  const owner = serializePublication(row, 'owner');
  assert.equal(owner.is_owner, true);
  assert.equal(owner.address, 'Av. Rivadavia 5000');
  assert.equal(owner.verification_answer, 'Azul');
  assert.equal(owner.latitude, -34.618765);

  const other = serializePublication(row, 'otra-persona');
  assert.equal(other.is_owner, false);
  assert.equal(other.address, null);
  assert.equal('verification_answer' in other, false);
  assert.equal(other.verification_question, '¿Color?');
  assert.equal(other.latitude, -34.619);
  assert.equal(other.longitude, -58.437);
  assert.deepEqual(other.photos[0], { id: 'f1', url: '/publications/p1/photos/f1' });
});

test('con reclamo aceptado se desbloquea la ubicación exacta, nunca la respuesta', () => {
  const claimant = serializePublication(row, 'reclamante', { exactLocation: true });
  assert.equal(claimant.address, 'Av. Rivadavia 5000');
  assert.equal(claimant.latitude, -34.618765);
  assert.equal('verification_answer' in claimant, false);
});

test('sin coordenadas, la vista pública mantiene null', () => {
  const view = serializePublication({ ...row, latitude: null, longitude: null }, 'otra-persona');
  assert.equal(view.latitude, null);
  assert.equal(view.longitude, null);
});
