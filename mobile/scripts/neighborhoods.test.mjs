import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../services/search/neighborhoods.js', import.meta.url), 'utf8');
const { BARRIOS, barrioMasCercano, filtrarBarrios, puntoDeReferencia } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('barrioMasCercano encuentra Palermo desde su propio centroide', () => {
  const resultado = barrioMasCercano(-34.578, -58.4265);
  assert.equal(resultado.nombre, 'Palermo');
  assert.ok(resultado.distanciaKm < 1);
});

test('barrioMasCercano devuelve null fuera de la zona cubierta', () => {
  assert.equal(barrioMasCercano(37.42, -122.08), null); // Mountain View
});

test('filtrarBarrios ignora tildes y mayúsculas, y devuelve como máximo 8', () => {
  assert.ok(filtrarBarrios('nunez').includes('Núñez'));
  assert.ok(filtrarBarrios('NUNEZ').includes('Núñez'));
  assert.ok(filtrarBarrios('villa').length <= 8);
});

test('puntoDeReferencia prioriza la ubicación del dispositivo, luego el barrio, luego null', () => {
  assert.deepEqual(puntoDeReferencia({ lat: -1, lng: -2, barrio: 'Palermo' }), { lat: -1, lng: -2 });
  assert.deepEqual(puntoDeReferencia({ barrio: 'Palermo' }), { lat: -34.5780, lng: -58.4265 });
  assert.equal(puntoDeReferencia({}), null);
  assert.equal(puntoDeReferencia({ barrio: 'Barrio inexistente' }), null);
});

test('los 58 nombres de barrio son únicos', () => {
  const nombres = BARRIOS.map(b => b.nombre);
  assert.equal(new Set(nombres).size, nombres.length);
  assert.equal(nombres.length, 58);
});
