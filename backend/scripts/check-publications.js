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
async function request(path, { token, method = 'GET' } = {}) {
  const response = await fetch(base + path, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: response.status, body: await response.json() };
}
try {
  const owner = randomUUID(), viewer = randomUUID();
  for (const id of [owner, viewer]) await client.query("INSERT INTO public.users(id,email,password_hash,email_verified_at,name,neighborhood) VALUES($1,$2,'temporary-not-a-real-password',now(),'Vecino de prueba','Palermo')", [id, `${id}@example.invalid`]);
  const viewerToken = tokens.sign(viewer);
  const ownerToken = tokens.sign(owner);

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

  // Detalle: id inválido/inexistente, anónimo vs. tercero vs. dueño.
  check((await request('/publications/no-es-uuid')).status, 400);
  check((await request(`/publications/${randomUUID()}`)).status, 404);
  const anonDetail = await request(`/publications/${foundKeys}`);
  check(anonDetail.status, 200);
  check(anonDetail.body.publication.exact_location, null);
  check(anonDetail.body.publication.viewer.can_claim, false);
  for (const field of ['latitude', 'longitude', 'exact_address', 'publisher_id']) check(field in anonDetail.body.publication, false);

  const thirdDetail = await request(`/publications/${foundKeys}`, { token: viewerToken });
  check(thirdDetail.body.publication.viewer.can_claim, true);
  check(thirdDetail.body.publication.viewer.claim_action, 'its_mine');
  check(thirdDetail.body.publication.exact_location, null);

  const ownerDetail = await request(`/publications/${foundKeys}`, { token: ownerToken });
  check(ownerDetail.body.publication.exact_location.address, 'Calle de prueba 100');
  check(ownerDetail.body.publication.viewer.can_manage, true);
  check(ownerDetail.body.publication.viewer.can_claim, false);

  // Seguir / dejar de seguir.
  check((await request(`/publications/${foundKeys}/follow`, { method: 'POST' })).status, 401);
  check((await request(`/publications/${foundKeys}/follow`, { method: 'POST', token: ownerToken })).status, 400);
  check((await request(`/publications/${foundResolved}/follow`, { method: 'POST', token: viewerToken })).status, 409);
  const followed = await request(`/publications/${foundKeys}/follow`, { method: 'POST', token: viewerToken });
  check(followed.status, 200);
  check(followed.body, { following: true, followers_count: 1 });
  const repeated = await request(`/publications/${foundKeys}/follow`, { method: 'POST', token: viewerToken });
  check(repeated.body.followers_count, 1);
  const afterFollowDetail = await request(`/publications/${foundKeys}`, { token: viewerToken });
  check(afterFollowDetail.body.publication.viewer.is_following, true);
  check(afterFollowDetail.body.publication.followers_count, 1);
  const unfollowed = await request(`/publications/${foundKeys}/follow`, { method: 'DELETE', token: viewerToken });
  check(unfollowed.body, { following: false, followers_count: 0 });

  console.log(`${checks} verificaciones HTTP/PostgreSQL correctas: tipo opuesto, resueltas excluidas, palabra clave con/sin tilde, rango de fechas, columnas redondeadas, orden por cercanía, paginación, foto servida, detalle según el viewer y seguir/dejar de seguir.`);
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await client.query('ROLLBACK'); await client.end();
  console.log('Datos temporales descartados; no se modificaron publicaciones reales.');
}
