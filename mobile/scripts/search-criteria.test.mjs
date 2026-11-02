import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../services/search/searchCriteria.js', import.meta.url), 'utf8');
const {
  parsearFecha, rangoDeFechas, validarCriterios, criteriosAParams, claveCriterios,
  describirBusqueda, agregarReciente, marcarComoAlerta, quitarAlerta, recientes, alertas,
} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('rangoDeFechas calcula hoy/3 días/semana cruzando de mes', () => {
  const ahora = new Date(2026, 2, 1); // 1/3/2026
  assert.deepEqual(rangoDeFechas({ cuando: 'hoy' }, ahora), { from: '2026-03-01', to: '2026-03-01' });
  assert.deepEqual(rangoDeFechas({ cuando: '3dias' }, ahora), { from: '2026-02-27', to: '2026-03-01' });
  assert.deepEqual(rangoDeFechas({ cuando: 'semana' }, ahora), { from: '2026-02-23', to: '2026-03-01' });
  assert.deepEqual(rangoDeFechas({ cuando: 'rango', desde: '10/02/2026', hasta: '15/02/2026' }, ahora), { from: '2026-02-10', to: '2026-02-15' });
});

test('parsearFecha rechaza fechas inexistentes o mal formateadas', () => {
  assert.equal(parsearFecha('31/02/2026'), null);
  assert.equal(parsearFecha('1/1/2026'), null);
  assert.equal(parsearFecha('29/02/2027'), null); // 2027 no es bisiesto
  assert.equal(parsearFecha('29/02/2028'), '2028-02-29'); // 2028 sí lo es
  assert.equal(parsearFecha('05/10/2026'), '2026-10-05');
});

test('validarCriterios exige los campos obligatorios y rechaza fechas futuras o invertidas', () => {
  const ahora = new Date(2026, 9, 31);
  assert.equal(validarCriterios({}, ahora).queTePaso, 'Elegí si perdiste o encontraste algo.');
  assert.equal(validarCriterios({ queTePaso: 'perdi' }, ahora).categoria, 'Elegí qué es.');
  assert.equal(validarCriterios({ queTePaso: 'perdi', categoria: 'keys', origenUbicacion: 'lista', barrio: '' }, ahora).barrio, 'Elegí un barrio o usá tu ubicación.');
  assert.equal(validarCriterios({ queTePaso: 'perdi', categoria: 'keys' }, ahora).cuando, 'Elegí cuándo pasó.');
  const futuro = validarCriterios({ queTePaso: 'perdi', categoria: 'keys', cuando: 'rango', desde: '01/11/2026', hasta: '02/11/2026' }, ahora);
  assert.equal(futuro.cuando, 'La fecha no puede ser futura.');
  const invertido = validarCriterios({ queTePaso: 'perdi', categoria: 'keys', cuando: 'rango', desde: '20/10/2026', hasta: '10/10/2026' }, ahora);
  assert.equal(invertido.cuando, 'La fecha inicial no puede ser posterior a la final.');
  const ok = validarCriterios({ queTePaso: 'perdi', categoria: 'keys', cuando: 'hoy' }, ahora);
  assert.deepEqual(ok, {});
});

test('criteriosAParams traduce al idioma de la API y omite valores vacíos', () => {
  const ahora = new Date(2026, 9, 31);
  const perdi = criteriosAParams({ queTePaso: 'perdi', categoria: 'keys', cuando: 'hoy' }, { ahora });
  assert.equal(perdi.situation, 'lost');
  assert.equal('neighborhood' in perdi, false);
  assert.equal('q' in perdi, false);
  assert.equal(perdi.page_size, 10);
  const encontre = criteriosAParams({ queTePaso: 'encontre', categoria: 'pets', cuando: 'hoy' }, { ahora });
  assert.equal(encontre.situation, 'found');
  const cercanos = criteriosAParams({ queTePaso: 'perdi', categoria: 'keys', cuando: 'hoy', orden: 'cercanos' }, { ahora, referencia: { lat: -34.58, lng: -58.43 } });
  assert.equal(cercanos.sort, 'nearest');
  assert.equal(cercanos.lat, -34.58);
  assert.equal(cercanos.lng, -58.43);
});

test('claveCriterios no depende del orden de los campos', () => {
  const a = claveCriterios({ categoria: 'keys', queTePaso: 'perdi' });
  const b = claveCriterios({ queTePaso: 'perdi', categoria: 'keys' });
  assert.equal(a, b);
  assert.notEqual(a, claveCriterios({ queTePaso: 'encontre', categoria: 'keys' }));
});

test('describirBusqueda arma un resumen legible', () => {
  const texto = describirBusqueda({ queTePaso: 'perdi', categoria: 'keys', palabras: 'llavero', barrio: 'Palermo', cuando: '3dias' });
  assert.equal(texto, 'Perdí · Llaves · "llavero" · Palermo · Últimos 3 días');
});

test('agregarReciente deduplica, respeta el tope y no expulsa alertas guardadas', () => {
  let lista = [];
  let ahora = new Date(2026, 0, 1);
  for (let i = 0; i < 12; i++) {
    lista = marcarComoAlerta(lista, { queTePaso: 'perdi', categoria: 'keys', cuando: 'hoy', barrio: `Barrio ${i}` }, ahora);
  }
  assert.equal(alertas(lista).length, 12); // marcarComoAlerta no tiene tope propio, agregarReciente sí lo aplica
  for (let i = 0; i < 8; i++) {
    lista = agregarReciente(lista, { queTePaso: 'encontre', categoria: 'pets', cuando: 'hoy', barrio: `Reciente ${i}` }, ahora);
  }
  assert.equal(recientes(lista).length, 5);
  assert.ok(alertas(lista).length >= 10);
  // repetir una búsqueda ya reciente la actualiza en vez de duplicarla
  const antes = lista.length;
  lista = agregarReciente(lista, { queTePaso: 'encontre', categoria: 'pets', cuando: 'hoy', barrio: 'Reciente 7' }, ahora);
  assert.equal(lista.filter(i => i.criterios.barrio === 'Reciente 7').length, 1);
  assert.ok(lista.length <= antes);
});

test('marcarComoAlerta y quitarAlerta', () => {
  let lista = [];
  const criterios = { queTePaso: 'perdi', categoria: 'documents', cuando: 'hoy' };
  lista = agregarReciente(lista, criterios, new Date(2026, 0, 1));
  assert.equal(alertas(lista).length, 0);
  lista = marcarComoAlerta(lista, criterios, new Date(2026, 0, 2));
  assert.equal(alertas(lista).length, 1);
  assert.equal(recientes(lista).length, 0);
  const clave = alertas(lista)[0].clave;
  lista = quitarAlerta(lista, clave);
  assert.equal(alertas(lista).length, 0);
});
