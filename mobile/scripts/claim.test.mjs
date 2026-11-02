import test from 'node:test';
import assert from 'node:assert/strict';
import { claimKindFor, isClaimable } from '../config/claimOptions.js';
import { answersMatch } from '../utils/claimAnswers.js';
import { buildClaimPayload, emptyClaimForm, validateClaimForm } from '../utils/claimValidation.js';

const photo = { uri: 'file:///foto.jpg', base64: '/9j/4AAQ' };

test('el tipo de reclamo depende de la publicación', () => {
  assert.equal(claimKindFor('found'), 'owner');
  assert.equal(claimKindFor('lost'), 'finder');
});

test('solo se puede reclamar una publicación ajena abierta o en reclamo', () => {
  assert.equal(isClaimable({ is_owner: false, status: 'open' }), true);
  assert.equal(isClaimable({ is_owner: false, status: 'claimed' }), true);
  assert.equal(isClaimable({ is_owner: true, status: 'open' }), false);
  for (const status of ['resolved', 'expired']) assert.equal(isClaimable({ is_owner: false, status }), false);
});

test('el reclamo de un dueño exige la respuesta', () => {
  const form = { ...emptyClaimForm(), verification_answer: 'Azul' };
  assert.equal(validateClaimForm('owner', form), '');
  assert.match(validateClaimForm('owner', { ...form, verification_answer: '  ' }), /respuesta/);
  assert.match(validateClaimForm('owner', { ...form, verification_answer: 'a'.repeat(101) }), /respuesta/);
  assert.match(validateClaimForm('owner', { ...form, description: 'a'.repeat(501) }), /descripción/);
  assert.equal(validateClaimForm('owner', { ...form, photos: [photo] }), '');
});

test('el reclamo de quien encontró exige foto y barrio', () => {
  const form = { ...emptyClaimForm(), photos: [photo], found_neighborhood: 'Palermo' };
  assert.equal(validateClaimForm('finder', form), '');
  assert.match(validateClaimForm('finder', { ...form, photos: [] }), /foto/);
  assert.match(validateClaimForm('finder', { ...form, found_neighborhood: ' ' }), /barrio/);
  assert.match(validateClaimForm('finder', { ...form, description: 'a'.repeat(501) }), /descripción/);
});

test('buildClaimPayload arma el cuerpo según el tipo de reclamo', () => {
  const owner = buildClaimPayload('p1', 'owner', { ...emptyClaimForm(), verification_answer: ' Azul ', description: ' Es mío ' });
  assert.deepEqual(owner, { publication_id: 'p1', description: 'Es mío', verification_answer: 'Azul' });

  const finder = buildClaimPayload('p1', 'finder', { ...emptyClaimForm(), photos: [photo], found_neighborhood: ' Palermo ' });
  assert.deepEqual(finder, { publication_id: 'p1', photo, found_neighborhood: 'Palermo' });
});

test('answersMatch ignora mayúsculas, espacios y tildes', () => {
  assert.equal(answersMatch(' AZUL ', 'azul'), true);
  assert.equal(answersMatch('Café', 'cafe'), true);
  assert.equal(answersMatch('Rojo', 'Azul'), false);
});
