// Punto 10 - Historial: funciones puras de mobile/services/history/historyView.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../services/history/historyView.js', import.meta.url), 'utf8');
const {
  textoCaso, textoValoracion, textoPlazo, validarValoracion, validarAgradecimiento,
} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const caso = {
  returned_at: new Date(2026, 10, 1, 12).toISOString(),
  counterpart: { name: 'Ana' },
  feedback: { until: new Date(2026, 10, 8, 12).toISOString(), can_rate: true, can_thank: false },
};

test('textoCaso cambia según la pestaña', () => {
  assert.equal(textoCaso(caso, 'returned'), 'Devolviste a Ana el 01/11/2026');
  assert.equal(textoCaso(caso, 'recovered'), 'Ana te lo devolvió el 01/11/2026');
});

test('textoValoracion y textoPlazo', () => {
  assert.equal(textoValoracion(null), '');
  assert.equal(textoValoracion({ value: 'positive', message: '' }), 'Positiva');
  assert.equal(textoValoracion({ value: 'negative', message: 'No vino' }), 'Negativa: “No vino”');
  assert.equal(textoPlazo(caso), 'Podés hacerlo hasta el 08/11/2026.');
  assert.equal(textoPlazo({ ...caso, feedback: { ...caso.feedback, can_rate: false } }), '');
});

test('validarValoracion: valor obligatorio y mensaje opcional de hasta 200 caracteres', () => {
  assert.ok(validarValoracion({ valor: null, mensaje: '' }).error);
  assert.deepEqual(validarValoracion({ valor: 'positive', mensaje: '   ' }), { value: { value: 'positive' } });
  assert.deepEqual(validarValoracion({ valor: 'negative', mensaje: ' Llegó  tarde ' }), { value: { value: 'negative', message: 'Llegó tarde' } });
  assert.ok(validarValoracion({ valor: 'positive', mensaje: 'x'.repeat(201) }).error);
});

test('validarAgradecimiento: mensaje obligatorio de hasta 200 caracteres', () => {
  assert.equal(validarAgradecimiento({ mensaje: '  ' }).error, 'Escribí tu agradecimiento.');
  assert.deepEqual(validarAgradecimiento({ mensaje: ' ¡Gracias! ' }), { value: { message: '¡Gracias!' } });
  assert.ok(validarAgradecimiento({ mensaje: 'x'.repeat(201) }).error);
});
