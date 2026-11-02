import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('Falta configuración.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect(); await client.query('BEGIN');
const database = { query: (sql, values) => client.query(sql, values) };
const tokens = createSessionTokens(process.env.JWT_SECRET);
const server = createApp(database, undefined, undefined, tokens).listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let checks = 0; function check(a, b) { assert.deepEqual(a, b); checks++; }
async function request(path, { token } = {}) {
  const response = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: response.status, body: await response.json() };
}
try {
  const owner = randomUUID(), viewer = randomUUID();
  for (const id of [owner, viewer]) await client.query("INSERT INTO public.users(id,email,password_hash,email_verified_at,name,neighborhood) VALUES($1,$2,'temporary-not-a-real-password',now(),'Vecino de prueba','Palermo')", [id, `${id}@example.invalid`]);
  const viewerToken = tokens.sign(viewer);

  async function publication({ type = 'found', category = 'keys', title, description = '', neighborhood = 'Palermo', occurredOn, status = 'open', lat, lng, address = 'Calle de prueba 100' }) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO public.publications(id,publisher_id,type,category,title,description,neighborhood,occurred_on,status,exact_address,latitude,longitude)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, owner, type, category, title, description, neighborhood, occurredOn, status, address, lat, lng],
    );
    return id;
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastWeek = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const longAgo = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);

  const foundKeys = await publication({ type: 'found', category: 'keys', title: 'Llavero de prueba azul', occurredOn: today, lat: -34.5780, lng: -58.4265 });
  const foundElectronics = await publication({ type: 'found', category: 'electronics', title: 'Auriculares de prueba', description: 'Encontrados cerca de la plaza', occurredOn: lastWeek, lat: -34.5781, lng: -58.4266 });
  const foundResolved = await publication({ type: 'found', category: 'keys', title: 'Llave resuelta de prueba', occurredOn: today, status: 'resolved', lat: -34.5780, lng: -58.4265 });
  const foundOld = await publication({ type: 'found', category: 'keys', title: 'Llave vieja de prueba', occurredOn: longAgo, lat: -34.6286, lng: -58.4644 });
  const lostKeys = await publication({ type: 'lost', category: 'keys', title: 'Llaves perdidas de prueba', occurredOn: today, lat: -34.5780, lng: -58.4265 });

  // Tipo opuesto: busco lo que perdí ("lost") y encuentro publicaciones "found".
  const lost = await request('/publications?situation=lost&category=keys');
  check(lost.status, 200);
  check(lost.body.results.some(r => r.id === foundKeys), true);
  check(lost.body.results.some(r => r.id === lostKeys), false);

  // Resueltas excluidas.
  check(lost.body.results.some(r => r.id === foundResolved), false);

  // Palabra clave con y sin tilde (acentuación insensible).
  const withAccent = await request('/publications?situation=lost&q=auriculares');
  check(withAccent.body.results.some(r => r.id === foundElectronics), true);
  const plaza = await request('/publications?situation=lost&q=plaza');
  check(plaza.body.results.some(r => r.id === foundElectronics), true);

  // Rango de fechas.
  const ranged = await request(`/publications?situation=lost&from=${lastWeek}&to=${today}&page_size=30`);
  check(ranged.body.results.some(r => r.id === foundOld), false);
  check(ranged.body.results.some(r => r.id === foundKeys), true);

  // Columnas GENERATED redondeadas a ~2 decimales.
  const found = lost.body.results.find(r => r.id === foundKeys);
  check(found.approx_latitude, -34.58);
  check(found.approx_longitude, -58.43);
  for (const field of ['latitude', 'longitude', 'exact_address', 'publisher_id']) check(field in found, false);

  // Orden por cercanía (page_size grande: hay más publicaciones de ejemplo que el tamaño de página por defecto).
  const nearest = await request('/publications?situation=lost&sort=nearest&lat=-34.5780&lng=-58.4265&page_size=30');
  check(nearest.status, 200);
  const ids = nearest.body.results.map(r => r.id);
  check(ids.indexOf(foundKeys) < ids.indexOf(foundOld), true);

  // Paginación.
  const page1 = await request('/publications?situation=lost&page=1&page_size=1');
  check(page1.body.results.length, 1);
  check(page1.body.has_more, page1.body.total > 1);

  // Foto servida.
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=';
  const photoId = randomUUID();
  await client.query("INSERT INTO public.publication_photos(id,publication_id,position,photo_data,photo_mime) VALUES ($1,$2,0,$3,'image/png')", [photoId, foundKeys, Buffer.from(png, 'base64')]);
  const withPhoto = await request(`/publications?situation=lost&category=keys`);
  const photoEntry = withPhoto.body.results.find(r => r.id === foundKeys);
  check(photoEntry.photos.length, 1);
  const photoResponse = await fetch(base + photoEntry.photos[0].url);
  check(photoResponse.status, 200);
  check(photoResponse.headers.get('content-type'), 'image/png');

  // Con sesión, la búsqueda sigue funcionando igual (autenticación opcional).
  const withSession = await request('/publications?situation=lost&category=keys', { token: viewerToken });
  check(withSession.status, 200);

  console.log(`${checks} verificaciones HTTP/PostgreSQL correctas: tipo opuesto, resueltas excluidas, palabra clave con/sin tilde, rango de fechas, columnas redondeadas, orden por cercanía, paginación y foto servida.`);
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await client.query('ROLLBACK'); await client.end();

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('Falta DATABASE_URL o JWT_SECRET.');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('BEGIN');
const database = { query: (sql, values) => client.query(sql, values), transaction: callback => callback(client) };
const tokens = createSessionTokens(process.env.JWT_SECRET);
const server = createApp(database, undefined, undefined, tokens).listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

let checks = 0;
function check(actual, expected) {
  assert.deepEqual(actual, expected);
  checks++;
}
async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = response.headers.get('content-type')?.includes('json');
  return { status: response.status, headers: response.headers, body: isJson ? await response.json() : undefined };
}

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0]).toString('base64');
const lost = (overrides = {}) => ({
  type: 'lost', title: 'Llaves con llavero azul', description: 'Perdí un llavero con tres llaves en la plaza.',
  category: 'keys', occurred_at: new Date(Date.now() - 3600_000).toISOString(), neighborhood: 'Caballito',
  address: 'Av. Rivadavia 5000', latitude: -34.618765, longitude: -58.436789, photos: [PNG, JPEG], ...overrides,
});
const found = (overrides = {}) => lost({
  type: 'found', title: 'Mochila negra', category: 'clothing',
  verification_question: '¿De qué color es el llavero?', verification_answer: 'Azul', ...overrides,
});
const days = ms => ms / 86_400_000;

try {
  const [ownerId, otherId] = [randomUUID(), randomUUID()];
  for (const id of [ownerId, otherId]) {
    await client.query("INSERT INTO public.users(id,email,password_hash,email_verified_at) VALUES($1,$2,'temporary-not-a-real-password',now())", [id, `${id}@example.invalid`]);
  }
  const owner = tokens.sign(ownerId);
  const other = tokens.sign(otherId);

  check((await request('/publications/mine')).status, 401);
  check((await request('/publications', { method: 'POST', body: lost() })).status, 401);
  check((await request('/publications/mine', { token: 'token-falso' })).status, 401);

  const created = await request('/publications', { method: 'POST', token: owner, body: lost() });
  check(created.status, 201);
  const mine = created.body.publication;
  check(mine.status, 'open');
  check(mine.is_owner, true);
  check(mine.photos.length, 2);
  check(mine.verification_question, null);
  check(mine.address, 'Av. Rivadavia 5000');
  check(Math.round(days(new Date(mine.expires_at) - Date.now())), 30);

  const foundResult = await request('/publications', { method: 'POST', token: owner, body: found() });
  check(foundResult.status, 201);
  check(foundResult.body.publication.verification_answer, 'Azul');

  const invalid = [
    [found({ verification_question: undefined }), /verificación/],
    [found({ verification_answer: '' }), /verificación/],
    [lost({ verification_question: '¿Color del llavero?', verification_answer: 'Azul' }), /encontrados/],
    [lost({ photos: [] }), /fotos/],
    [lost({ photos: Array(6).fill(PNG) }), /fotos/],
    [lost({ photos: [Buffer.from('GIF89a').toString('base64')] }), /foto 1/],
    [lost({ occurred_at: new Date(Date.now() + 86_400_000).toISOString() }), /futura/],
    [lost({ category: 'autos' }), /categoría/],
    [lost({ latitude: -34.6, longitude: undefined }), /coordenadas/],
    [lost({ status: 'resolved' }), /no permitido/],
    [lost({ user_id: otherId }), /no permitido/],
  ];
  for (const [body, message] of invalid) {
    const result = await request('/publications', { method: 'POST', token: owner, body });
    check(result.status, 400);
    check(message.test(result.body.error), true);
  }
  check((await request('/publications', { method: 'POST', token: owner, body: [] })).status, 400);

  await client.query("UPDATE public.publications SET created_at = now() - interval '1 hour' WHERE id = $1", [mine.id]);
  const list = await request('/publications/mine', { token: owner });
  check(list.status, 200);
  check(list.body.publications.map(item => item.type), ['found', 'lost']);
  check((await request('/publications/mine', { token: other })).body.publications, []);

  const asOther = await request(`/publications/${mine.id}`, { token: other });
  check(asOther.status, 200);
  check(asOther.body.publication.is_owner, false);
  check(asOther.body.publication.address, null);
  check(asOther.body.publication.latitude, -34.619);
  check(asOther.body.publication.longitude, -58.437);
  const foundAsOther = (await request(`/publications/${foundResult.body.publication.id}`, { token: other })).body.publication;
  check('verification_answer' in foundAsOther, false);
  check(foundAsOther.verification_question, '¿De qué color es el llavero?');
  check((await request(`/publications/${mine.id}`, { token: owner })).body.publication.address, 'Av. Rivadavia 5000');
  check((await request(`/publications/${randomUUID()}`, { token: owner })).status, 404);
  check((await request('/publications/no-es-uuid', { token: owner })).status, 400);

  const [png, jpeg] = mine.photos;
  const pngResponse = await fetch(base + png.url);
  check(pngResponse.status, 200);
  check(pngResponse.headers.get('content-type').startsWith('image/png'), true);
  check(Buffer.from(await pngResponse.arrayBuffer()).toString('base64'), PNG);
  check((await fetch(base + jpeg.url)).headers.get('content-type').startsWith('image/jpeg'), true);
  check((await fetch(`${base}/publications/${mine.id}/photos/${randomUUID()}`)).status, 404);
  check((await fetch(`${base}/publications/${foundResult.body.publication.id}${png.url.slice(png.url.lastIndexOf('/photos'))}`)).status, 404);

  await client.query("UPDATE public.publications SET expires_at = now() - interval '1 minute' WHERE id = $1", [mine.id]);
  check((await request(`/publications/${mine.id}`, { token: owner })).body.publication.status, 'expired');
  check((await request(`/publications/${mine.id}/renew`, { method: 'POST', token: other })).status, 404);
  const renewed = await request(`/publications/${mine.id}/renew`, { method: 'POST', token: owner });
  check(renewed.status, 200);
  check(renewed.body.publication.status, 'open');
  check(Math.round(days(new Date(renewed.body.publication.expires_at) - Date.now())), 30);

  await client.query("UPDATE public.publications SET status = 'claimed', expires_at = now() - interval '1 day' WHERE id = $1", [mine.id]);
  check((await request(`/publications/${mine.id}`, { token: owner })).body.publication.status, 'claimed');
  check((await request(`/publications/${mine.id}/renew`, { method: 'POST', token: owner })).status, 409);

  await assert.rejects(client.query('SAVEPOINT s1').then(() => client.query(
    "INSERT INTO public.publications(user_id,type,title,description,category,occurred_at,neighborhood,address) VALUES($1,'found','Sin pregunta','Descripción larga','keys',now(),'Palermo','Calle 123')", [ownerId])));
  await client.query('ROLLBACK TO SAVEPOINT s1');
  checks++;

  await client.query('UPDATE public.users SET session_version = 1 WHERE id = $1', [ownerId]);
  check((await request('/publications/mine', { token: owner })).status, 401);

  console.log(`${checks} verificaciones HTTP/PostgreSQL correctas: sesión, alta de pérdida y hallazgo, validaciones, privacidad, fotos, vencimiento, renovación y restricciones de la base.`);
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await client.query('ROLLBACK');
  await client.end();
  console.log('Datos temporales descartados; no se modificaron publicaciones reales.');
}
