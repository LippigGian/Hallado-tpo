// Punto 8 - "Cómo llegar": URLs de navegación con la ciudad agregada al destino.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// directions.js importa react-native: se reemplaza por un stub para probar las funciones puras.
const source = (await readFile(new URL('../services/meetingPoint/directions.js', import.meta.url), 'utf8'))
  .replace(/import \{[^}]*\} from 'react-native';/, "const Linking = {}; const Platform = { OS: 'android' };");
const { conCiudad, urlsComoLlegar } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('agrega la ciudad cuando la dirección no la tiene', () => {
  assert.equal(conCiudad('Plaza Serrano, Palermo'), 'Plaza Serrano, Palermo, Buenos Aires, Argentina');
  assert.equal(conCiudad('  Av. Corrientes 1234, CABA '), 'Av. Corrientes 1234, CABA');
  assert.equal(conCiudad('Rivadavia 5000, Buenos Aires'), 'Rivadavia 5000, Buenos Aires');
});

test('Android abre Google Maps en navegación, después la app por defecto y la web', () => {
  const [nav, geo, web] = urlsComoLlegar({ direccion: 'Plaza Serrano, Palermo' }, 'android');
  const destino = encodeURIComponent('Plaza Serrano, Palermo, Buenos Aires, Argentina');
  assert.equal(nav, `google.navigation:q=${destino}`);
  assert.equal(geo, `geo:0,0?q=${destino}`);
  assert.match(web, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=.+&dir_action=navigate$/);
});

test('iOS prueba Google Maps, Apple Maps y la web', () => {
  const urls = urlsComoLlegar({ direccion: 'Plaza Serrano' }, 'ios');
  assert.match(urls[0], /^comgooglemaps:\/\/\?daddr=/);
  assert.match(urls[1], /^maps:\/\/\?daddr=/);
  assert.equal(urls.length, 3);
});

test('sin dirección usa las coordenadas, y sin nada no hay URLs', () => {
  assert.equal(urlsComoLlegar({ latitud: -34.5, longitud: -58.4 }, 'android')[0], `google.navigation:q=${encodeURIComponent('-34.5,-58.4')}`);
  assert.deepEqual(urlsComoLlegar({}, 'android'), []);
  assert.deepEqual(urlsComoLlegar(null, 'android'), []);
});
