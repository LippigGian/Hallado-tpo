import test from 'node:test';
import assert from 'node:assert/strict';
import { stepsFor } from '../config/publicationOptions.js';
import { formatDateTime, maskDate, maskTime, parseDateTime } from '../utils/dateTime.js';
import { buildPayload, emptyForm, validateStep } from '../utils/publicationValidation.js';
import { looksLikeImage, normalizePhoto, photoToBase64, PhotoReadError } from '../utils/photos.js';

const now = new Date(2026, 10, 1, 15, 0); // 01/11/2026 15:00 hora local

function filledForm(overrides = {}) {
  return {
    ...emptyForm(now),
    type: 'lost',
    photos: [{ uri: 'file:///foto-1.jpg', base64: '/9j/4AAQ' }],
    title: 'Llaves con llavero azul',
    description: 'Perdí un llavero con tres llaves en la plaza.',
    category: 'keys',
    date: '31/10/2026',
    time: '18:30',
    neighborhood: 'Caballito',
    address: 'Av. Rivadavia 5000',
    ...overrides,
  };
}

test('los pasos dependen del tipo: la verificación es solo para hallazgos', () => {
  assert.deepEqual(stepsFor('lost'), ['type', 'photos', 'details', 'location']);
  assert.deepEqual(stepsFor(''), ['type', 'photos', 'details', 'location']);
  assert.equal(stepsFor('found').at(-1), 'verification');
});

test('maskDate y maskTime agregan los separadores mientras se escribe', () => {
  assert.equal(maskDate('3'), '3');
  assert.equal(maskDate('311'), '31/1');
  assert.equal(maskDate('31102026'), '31/10/2026');
  assert.equal(maskDate('31/10/2026999'), '31/10/2026');
  assert.equal(maskDate('ab12'), '12');
  assert.equal(maskTime('1830'), '18:30');
  assert.equal(maskTime('18'), '18');
  assert.equal(maskTime('18:3'), '18:3');
});

test('parseDateTime acepta fechas reales y rechaza el resto', () => {
  assert.equal(formatDateTime(parseDateTime('31/10/2026', '18:30')), '31/10/2026 18:30');
  for (const [date, time] of [['31/02/2026', '10:00'], ['32/01/2026', '10:00'], ['10/13/2026', '10:00'],
    ['10/10/2026', '25:00'], ['10/10/2026', '10:61'], ['1/1/2026', '10:00'], ['10/10/2026', '1000'], ['', '']]) {
    assert.equal(parseDateTime(date, time), null, `${date} ${time}`);
  }
});

test('emptyForm arranca con la fecha y hora actuales', () => {
  const form = emptyForm(new Date(2026, 0, 5, 9, 7));
  assert.equal(form.date, '05/01/2026');
  assert.equal(form.time, '09:07');
  assert.deepEqual(form.photos, []);
});

test('cada paso informa el primer problema o queda vacío si está completo', () => {
  assert.match(validateStep('type', filledForm({ type: '' }), now), /perdiste o encontraste/);
  assert.equal(validateStep('type', filledForm(), now), '');

  assert.match(validateStep('photos', filledForm({ photos: [] }), now), /entre 1 y 5 fotos/);
  assert.match(validateStep('photos', filledForm({ photos: Array(6).fill('x') }), now), /entre 1 y 5 fotos/);
  assert.equal(validateStep('photos', filledForm(), now), '');

  assert.match(validateStep('details', filledForm({ title: ' ab ' }), now), /título/);
  assert.match(validateStep('details', filledForm({ description: 'corta' }), now), /descripción/);
  assert.match(validateStep('details', filledForm({ category: '' }), now), /categoría/);
  assert.match(validateStep('details', filledForm({ date: '31/02/2026' }), now), /fecha/);
  assert.match(validateStep('details', filledForm({ date: '02/11/2026' }), now), /futura/);
  assert.match(validateStep('details', filledForm({ date: '01/01/2025' }), now), /más de un año/);
  assert.equal(validateStep('details', filledForm(), now), '');

  assert.match(validateStep('location', filledForm({ neighborhood: '' }), now), /barrio/);
  assert.match(validateStep('location', filledForm({ address: 'a' }), now), /dirección/);
  assert.equal(validateStep('location', filledForm(), now), '');

  assert.match(validateStep('verification', filledForm({ verification_question: '' }), now), /pregunta/);
  assert.match(validateStep('verification', filledForm({ verification_question: '¿De qué color es?' }), now), /respuesta/);
  assert.equal(validateStep('verification', filledForm({ verification_question: '¿De qué color es?', verification_answer: 'Azul' }), now), '');
});

test('buildPayload arma el cuerpo de la API', () => {
  const lost = buildPayload(filledForm({ title: '  Llaves  ', verification_question: 'sobrante', latitude: -34.6, longitude: -58.4 }));
  assert.equal(lost.title, 'Llaves');
  assert.equal(lost.latitude, -34.6);
  assert.equal('verification_question' in lost, false);
  assert.deepEqual(lost.photos, [{ uri: 'file:///foto-1.jpg', base64: '/9j/4AAQ' }]);
  assert.equal(new Date(lost.occurred_at).getTime(), new Date(2026, 9, 31, 18, 30).getTime());

  const found = buildPayload(filledForm({ type: 'found', verification_question: '¿Color?', verification_answer: ' Azul ' }));
  assert.equal(found.verification_answer, 'Azul');
  assert.equal('latitude' in found, false);
});

test('looksLikeImage reconoce JPEG y PNG en base64 y descarta lecturas fallidas', () => {
  assert.equal(looksLikeImage('/9j/4AAQSkZJRg=='), true);
  assert.equal(looksLikeImage('iVBORw0KGgoAAAANSUhEUg=='), true);
  for (const value of ['', null, undefined, 'data:image/jpeg;base64,/9j/4AAQ', 'R0lGODlh', 'AAAA']) {
    assert.equal(looksLikeImage(value), false, String(value));
  }
});

test('normalizePhoto acepta una URI suelta o un objeto', () => {
  assert.deepEqual(normalizePhoto('file:///a.jpg'), { uri: 'file:///a.jpg' });
  assert.deepEqual(normalizePhoto({ uri: 'file:///a.jpg', base64: 'x' }), { uri: 'file:///a.jpg', base64: 'x' });
});

test('photoToBase64 usa el base64 del selector y falla con un mensaje claro si la foto no es legible', async () => {
  assert.equal(await photoToBase64({ uri: 'file:///a.jpg', base64: '/9j/4AAQSkZJRg==' }), '/9j/4AAQSkZJRg==');
  // Sin base64 se intenta leer el archivo; en este entorno no existe, así que debe fallar con PhotoReadError.
  await assert.rejects(() => photoToBase64('file:///no-existe.jpg'), error => error instanceof PhotoReadError && /Quitala/.test(error.message));
  await assert.rejects(() => photoToBase64({ uri: 'file:///a.jpg', base64: 'texto-cualquiera' }), PhotoReadError);
});
