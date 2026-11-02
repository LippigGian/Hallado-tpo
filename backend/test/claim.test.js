import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClaim } from '../src/claim-validation.js';
import { claimKindFor } from '../src/claim-rules.js';
import { isParticipant, serializeClaim } from '../src/claim-view.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=';

test('una publicación de algo encontrado se reclama como dueño y una de algo perdido como quien lo encontró', () => {
  assert.equal(claimKindFor('found'), 'owner');
  assert.equal(claimKindFor('lost'), 'finder');
});

test('el reclamo de un dueño exige la respuesta y acepta descripción y foto opcionales', () => {
  const { value, error } = validateClaim({ publication_id: 'x', verification_answer: '  Azul ', description: ' Es mío ', photo: PNG }, 'owner');
  assert.equal(error, undefined);
  assert.equal(value.verification_answer, 'Azul');
  assert.equal(value.description, 'Es mío');
  assert.equal(value.photo.mime, 'image/png');
  assert.equal(value.found_neighborhood, null);

  const minimal = validateClaim({ verification_answer: 'Azul' }, 'owner').value;
  assert.equal(minimal.description, '');
  assert.equal(minimal.photo, null);
});

test('el reclamo de quien encontró exige foto y barrio', () => {
  const { value, error } = validateClaim({ photo: PNG, found_neighborhood: ' Palermo ' }, 'finder');
  assert.equal(error, undefined);
  assert.equal(value.found_neighborhood, 'Palermo');
  assert.equal(value.verification_answer, null);
  assert.equal(value.photo.mime, 'image/png');
});

test('rechaza reclamos inválidos con un mensaje claro', () => {
  const cases = [
    [null, 'owner', /Enviá los datos/],
    [[], 'finder', /Enviá los datos/],
    [{}, 'owner', /respuesta de verificación/],
    [{ verification_answer: '   ' }, 'owner', /respuesta de verificación/],
    [{ verification_answer: 'a'.repeat(101) }, 'owner', /entre 1 y 100/],
    [{ verification_answer: 'Azul', description: 'a'.repeat(501) }, 'owner', /hasta 500/],
    [{ verification_answer: 'Azul', description: 42 }, 'owner', /hasta 500/],
    [{ verification_answer: 'Azul', photo: 'basura' }, 'owner', /JPEG o PNG/],
    [{ verification_answer: 'Azul', found_neighborhood: 'Palermo' }, 'owner', /solo se pide al avisar/],
    [{ verification_answer: 'Azul', status: 'accepted' }, 'owner', /no permitido: status/],
    [{ found_neighborhood: 'Palermo' }, 'finder', /Adjuntá una foto/],
    [{ photo: 'basura', found_neighborhood: 'Palermo' }, 'finder', /JPEG o PNG/],
    [{ photo: PNG }, 'finder', /barrio donde lo encontraste/],
    [{ photo: PNG, found_neighborhood: ' ' }, 'finder', /barrio donde lo encontraste/],
    [{ photo: PNG, found_neighborhood: 'Palermo', verification_answer: 'Azul' }, 'finder', /solo se pide para objetos encontrados/],
  ];
  for (const [body, kind, expected] of cases) {
    assert.match(validateClaim(body, kind).error ?? '', expected, JSON.stringify(body)?.slice(0, 70));
  }
});

const row = {
  id: 'c1', publication_id: 'p1', claimant_id: 'claimant', publisher_id: 'publisher', kind: 'owner', status: 'pending',
  verification_answer: 'Azul', description: '', found_neighborhood: null, has_photo: true,
  created_at: '2026-11-01T10:00:00Z', expires_at: '2026-11-03T10:00:00Z', responded_at: null,
  publication_type: 'found', publication_title: 'Llaves', publication_category: 'keys', publication_neighborhood: 'Caballito',
  publication_address: 'Av. Rivadavia 5000', publication_latitude: -34.6187, publication_longitude: -58.4367,
  verification_question: '¿Color?', expected_answer: 'Azul', cover_photo_id: 'f1', claimant_name: '', publisher_name: 'Ana',
};

test('quien publica ve la respuesta esperada; quien reclama no', () => {
  const publisherView = serializeClaim(row, 'publisher');
  assert.equal(publisherView.role, 'publisher');
  assert.equal(publisherView.expected_answer, 'Azul');
  assert.equal(publisherView.verification_answer, 'Azul');

  const claimantView = serializeClaim(row, 'claimant');
  assert.equal(claimantView.role, 'claimant');
  assert.equal('expected_answer' in claimantView, false);
  assert.equal(claimantView.photo_url, '/claims/c1/photo');
  assert.equal(claimantView.claimant.name, 'Vecino de Hallado');
  assert.equal(claimantView.publication.cover_photo_url, '/publications/p1/photos/f1');
});

test('la dirección exacta aparece solo cuando el reclamo fue aceptado', () => {
  assert.equal('address' in serializeClaim(row, 'claimant').publication, false);
  const accepted = serializeClaim({ ...row, status: 'accepted' }, 'claimant').publication;
  assert.equal(accepted.address, 'Av. Rivadavia 5000');
  assert.equal(accepted.latitude, -34.6187);
});

test('un reclamo de quien encontró no muestra pregunta ni respuesta esperada', () => {
  const view = serializeClaim({ ...row, kind: 'finder', verification_answer: null, found_neighborhood: 'Palermo' }, 'publisher');
  assert.equal(view.verification_question, null);
  assert.equal('expected_answer' in view, false);
  assert.equal(view.found_neighborhood, 'Palermo');
});

test('solo participan quien reclama y quien publicó', () => {
  assert.equal(isParticipant(row, 'claimant'), true);
  assert.equal(isParticipant(row, 'publisher'), true);
  assert.equal(isParticipant(row, 'otra-persona'), false);
});
