// Punto 9 - Alertas y seguidas: funciones puras de mobile/services/search/searchCriteria.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../services/search/searchCriteria.js', import.meta.url), 'utf8');
const {
  criteriosAAlerta, describirFechaAlerta, describirAlerta, textoNovedadAlerta, textoCambioEstado, textoContador,
} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const AHORA = new Date(2026, 10, 2, 12); // 2/11/2026

test('criteriosAAlerta convierte la opción de fecha en un rango concreto', () => {
  const base = { queTePaso: 'perdi', categoria: 'keys', palabras: ' llavero azul ', origenUbicacion: 'lista', barrio: 'Palermo' };
  assert.deepEqual(criteriosAAlerta({ ...base, cuando: 'hoy' }, AHORA), {
    situation: 'lost', category: 'keys', neighborhood: 'Palermo', keywords: 'llavero azul',
    date_preset: 'hoy', date_from: '2026-11-02', date_to: '2026-11-02',
  });
  const tresDias = criteriosAAlerta({ ...base, cuando: '3dias' }, AHORA);
  assert.deepEqual([tresDias.date_preset, tresDias.date_from, tresDias.date_to], ['3dias', '2026-10-31', '2026-11-02']);
  const semana = criteriosAAlerta({ ...base, cuando: 'semana' }, AHORA);
  assert.deepEqual([semana.date_from, semana.date_to], ['2026-10-27', '2026-11-02']);
  const rango = criteriosAAlerta({ ...base, cuando: 'rango', desde: '10/10/2026', hasta: '15/10/2026' }, AHORA);
  assert.deepEqual([rango.date_preset, rango.date_from, rango.date_to], ['rango', '2026-10-10', '2026-10-15']);
});

test('criteriosAAlerta: todos los barrios, sin palabras clave y sin fecha', () => {
  assert.deepEqual(criteriosAAlerta({ queTePaso: 'encontre', categoria: 'pets', palabras: '  ', origenUbicacion: 'todos', barrio: 'Palermo' }, AHORA), {
    situation: 'found', category: 'pets', neighborhood: null, keywords: null, date_preset: null, date_from: null, date_to: null,
  });
});

test('una alerta guardada antes conserva sus fechas: el rango no se corre', () => {
  const guardadaEl28 = new Date(2026, 9, 28, 9);
  const alerta = criteriosAAlerta({ queTePaso: 'perdi', categoria: 'keys', cuando: 'hoy' }, guardadaEl28);
  assert.deepEqual([alerta.date_from, alerta.date_to], ['2026-10-28', '2026-10-28']);
});

test('describirFechaAlerta muestra la opción elegida y sus fechas', () => {
  assert.equal(describirFechaAlerta({ date_preset: '3dias', date_from: '2026-10-31', date_to: '2026-11-02' }, AHORA), 'Últimos 3 días (31/10 – 02/11)');
  assert.equal(describirFechaAlerta({ date_preset: 'hoy', date_from: '2026-11-02', date_to: '2026-11-02' }, AHORA), 'Hoy (02/11)');
  assert.equal(describirFechaAlerta({ date_preset: 'rango', date_from: '2025-12-28', date_to: '2026-01-03' }, AHORA), 'Fechas elegidas (28/12/2025 – 03/01/2026)');
  assert.equal(describirFechaAlerta({}, AHORA), 'Cualquier fecha');
});

test('describirAlerta y textoNovedadAlerta', () => {
  assert.equal(describirAlerta({ situation: 'lost', category: 'keys', keywords: 'llavero', neighborhood: 'Palermo' }), 'Perdí · Llaves · "llavero" · Palermo');
  assert.equal(describirAlerta({ situation: 'found', category: null, keywords: null, neighborhood: null }), 'Encontré · Todos los barrios');
  assert.equal(textoNovedadAlerta({ new_count: 1 }), '1 publicación nueva');
  assert.equal(textoNovedadAlerta({ new_count: 3 }), '3 publicaciones nuevas');
  assert.equal(textoNovedadAlerta({ new_count: 0 }), 'Sin publicaciones nuevas');
  assert.equal(textoNovedadAlerta({ new_count: 5, paused: true }), 'Pausada');
});

test('textoCambioEstado y textoContador', () => {
  assert.equal(textoCambioEstado({ has_update: true, previous_status: 'open', status: 'claimed' }), 'Cambió de estado: Abierta → En reclamo');
  assert.equal(textoCambioEstado({ has_update: true, previous_status: null, status: 'expired' }), 'Cambió de estado: Vencida');
  assert.equal(textoCambioEstado({ has_update: false, status: 'open' }), '');
  assert.equal(textoContador(0), '');
  assert.equal(textoContador(7), '7');
  assert.equal(textoContador(150), '99+');
});
