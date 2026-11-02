import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';

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

async function createUser(name) {
  const id = randomUUID();
  await client.query(
    "INSERT INTO public.users(id,email,password_hash,email_verified_at,name,phone,share_phone_after_claim) VALUES($1,$2,'temporary-not-a-real-password',now(),$3,'+54 11 5555 0000',true)",
    [id, `${id}@example.invalid`, name],
  );
  return { id, token: tokens.sign(id) };
}

async function createPublication(owner, type) {
  const found = type === 'found';
  const inserted = await client.query(
    `INSERT INTO public.publications(user_id,type,title,description,category,occurred_at,neighborhood,address,latitude,longitude,verification_question,verification_answer)
     VALUES($1,$2,$3,'Descripción de la publicación','keys',now(),'Caballito','Av. Rivadavia 5000',-34.618765,-58.436789,$4,$5) RETURNING id`,
    [owner.id, type, found ? 'Llaves encontradas' : 'Llaves perdidas', found ? '¿De qué color es el llavero?' : null, found ? 'Azul' : null],
  );
  await client.query("INSERT INTO public.publication_photos(publication_id,sort_order,mime,data) VALUES($1,0,'image/png',$2)", [inserted.rows[0].id, Buffer.from(PNG, 'base64')]);
  return inserted.rows[0].id;
}

const ownerClaim = (publicationId, overrides = {}) => ({ publication_id: publicationId, verification_answer: 'Azul', description: 'Es mío', ...overrides });
const finderClaim = (publicationId, overrides = {}) => ({ publication_id: publicationId, photo: JPEG, found_neighborhood: 'Palermo', ...overrides });
const post = (path, token, body) => request(path, { method: 'POST', token, body });
const publicationStatus = async (publicationId, token) => (await request(`/publications/${publicationId}`, { token })).body.publication.status;

try {
  const owner = await createUser('Dueño');
  const ana = await createUser('Ana');
  const beto = await createUser('Beto');
  const carla = await createUser('Carla');
  const stranger = await createUser('Intruso');
  const found = await createPublication(owner, 'found');
  const lost = await createPublication(owner, 'lost');

  check((await request('/claims/mine')).status, 401);
  check((await post('/claims', null, ownerClaim(found))).status, 401);

  check((await post('/claims', ana.token, { verification_answer: 'Azul' })).status, 400);
  check((await post('/claims', ana.token, ownerClaim(randomUUID()))).status, 404);
  check((await post('/claims', owner.token, ownerClaim(found))).status, 403);
  check((await post('/claims', ana.token, ownerClaim(found, { verification_answer: '' }))).body.error.includes('respuesta'), true);
  check((await post('/claims', ana.token, ownerClaim(found, { kind: 'finder' }))).status, 400);
  check((await post('/claims', ana.token, ownerClaim(found, { photo: 'no-es-una-imagen' }))).status, 400);
  check((await post('/claims', ana.token, ownerClaim(found, { found_neighborhood: 'Palermo' }))).status, 400);

  const first = await post('/claims', ana.token, ownerClaim(found));
  check(first.status, 201);
  check(first.body.claim.status, 'pending');
  check(first.body.claim.kind, 'owner');
  check(first.body.claim.role, 'claimant');
  check(first.body.claim.photo_url, null);
  check('expected_answer' in first.body.claim, false);
  check('address' in first.body.claim.publication, false);
  check(Math.round((new Date(first.body.claim.expires_at) - Date.now()) / 3_600_000), 48);
  check(await publicationStatus(found, owner.token), 'claimed');

  check((await post('/claims', ana.token, ownerClaim(found))).status, 409);

  const second = await post('/claims', beto.token, ownerClaim(found, { photo: PNG, verification_answer: 'Rojo' }));
  check(second.status, 201);
  check(second.body.claim.photo_url, `/claims/${second.body.claim.id}/photo`);

  const asPublisher = await request(`/claims/${second.body.claim.id}`, { token: owner.token });
  check(asPublisher.body.claim.role, 'publisher');
  check(asPublisher.body.claim.expected_answer, 'Azul');
  check(asPublisher.body.claim.verification_answer, 'Rojo');
  check(asPublisher.body.claim.verification_question, '¿De qué color es el llavero?');
  check((await request(`/claims/${second.body.claim.id}`, { token: beto.token })).body.claim.role, 'claimant');
  check((await request(`/claims/${second.body.claim.id}`, { token: stranger.token })).status, 404);
  check((await request('/claims/no-es-uuid', { token: ana.token })).status, 400);

  const photoAsClaimant = await fetch(`${base}/claims/${second.body.claim.id}/photo`, { headers: { Authorization: `Bearer ${beto.token}` } });
  check(photoAsClaimant.status, 200);
  check(photoAsClaimant.headers.get('content-type').startsWith('image/png'), true);
  check(Buffer.from(await photoAsClaimant.arrayBuffer()).toString('base64'), PNG);
  check((await fetch(`${base}/claims/${second.body.claim.id}/photo`, { headers: { Authorization: `Bearer ${owner.token}` } })).status, 200);
  check((await fetch(`${base}/claims/${second.body.claim.id}/photo`, { headers: { Authorization: `Bearer ${stranger.token}` } })).status, 404);
  check((await fetch(`${base}/claims/${second.body.claim.id}/photo`)).status, 401);
  check((await fetch(`${base}/claims/${first.body.claim.id}/photo`, { headers: { Authorization: `Bearer ${owner.token}` } })).status, 404);

  await client.query("UPDATE public.claims SET created_at = now() - interval '1 hour' WHERE id = $1", [first.body.claim.id]);
  const mineAna = (await request('/claims/mine', { token: ana.token })).body;
  const mineOwner = (await request('/claims/mine', { token: owner.token })).body;
  check([mineAna.sent.length, mineAna.received.length], [1, 0]);
  check([mineOwner.sent.length, mineOwner.received.length], [0, 2]);
  check(mineOwner.received.map(claim => claim.claimant.name), ['Beto', 'Ana']);
  check((await request('/claims/mine', { token: stranger.token })).body, { sent: [], received: [] });

  check((await post(`/claims/${first.body.claim.id}/accept`, ana.token)).status, 404);
  check((await post(`/claims/${first.body.claim.id}/accept`, stranger.token)).status, 404);
  check((await post(`/claims/${randomUUID()}/accept`, owner.token)).status, 404);

  check((await request(`/profiles/${owner.id}/contact?claimId=${first.body.claim.id}`, { token: ana.token })).status, 403);
  check((await request(`/publications/${found}`, { token: ana.token })).body.publication.address, null);

  const accepted = await post(`/claims/${first.body.claim.id}/accept`, owner.token);
  check(accepted.status, 200);
  check(accepted.body.claim.status, 'accepted');
  check(accepted.body.claim.publication.address, 'Av. Rivadavia 5000');
  check((await request(`/claims/${second.body.claim.id}`, { token: beto.token })).body.claim.status, 'rejected');
  check(await publicationStatus(found, owner.token), 'claimed');

  check((await request(`/profiles/${owner.id}/contact?claimId=${first.body.claim.id}`, { token: ana.token })).body.phone, '+54 11 5555 0000');
  check((await request(`/profiles/${ana.id}/contact?claimId=${first.body.claim.id}`, { token: owner.token })).body.phone, '+54 11 5555 0000');
  check((await request(`/profiles/${owner.id}/contact?claimId=${first.body.claim.id}`, { token: beto.token })).status, 403);
  check((await request(`/publications/${found}`, { token: ana.token })).body.publication.address, 'Av. Rivadavia 5000');
  check((await request(`/publications/${found}`, { token: beto.token })).body.publication.address, null);

  check((await post(`/claims/${first.body.claim.id}/accept`, owner.token)).status, 409);
  check((await post(`/claims/${first.body.claim.id}/reject`, owner.token)).status, 409);
  check((await post('/claims', carla.token, ownerClaim(found))).status, 409);

  check((await post('/claims', carla.token, { publication_id: lost, photo: JPEG })).body.error.includes('barrio'), true);
  check((await post('/claims', carla.token, { publication_id: lost, found_neighborhood: 'Palermo' })).body.error.includes('foto'), true);
  check((await post('/claims', carla.token, finderClaim(lost, { verification_answer: 'Azul' }))).status, 400);

  const finder = await post('/claims', carla.token, finderClaim(lost));
  check(finder.status, 201);
  check(finder.body.claim.kind, 'finder');
  check(finder.body.claim.found_neighborhood, 'Palermo');
  check(finder.body.claim.verification_question, null);
  check(await publicationStatus(lost, owner.token), 'claimed');

  const rejected = await post(`/claims/${finder.body.claim.id}/reject`, owner.token);
  check(rejected.status, 200);
  check(rejected.body.claim.status, 'rejected');
  check(await publicationStatus(lost, owner.token), 'open');
  check((await request(`/profiles/${owner.id}/contact?claimId=${finder.body.claim.id}`, { token: carla.token })).status, 403);

  for (const attempt of [2, 3]) {
    const retry = await post('/claims', carla.token, finderClaim(lost, { description: `Intento ${attempt}` }));
    check(retry.status, 201);
    check((await post(`/claims/${retry.body.claim.id}/reject`, owner.token)).status, 200);
  }
  const exhausted = await post('/claims', carla.token, finderClaim(lost));
  check(exhausted.status, 409);
  check(exhausted.body.error.includes('3 intentos'), true);
  check((await post('/claims', beto.token, finderClaim(lost))).status, 201);

  await client.query("UPDATE public.claims SET expires_at = now() - interval '1 minute' WHERE publication_id = $1 AND status = 'pending'", [lost]);
  const expiredList = (await request('/claims/mine', { token: beto.token })).body.sent;
  check(expiredList.find(claim => claim.publication.id === lost).status, 'expired');
  check(await publicationStatus(lost, owner.token), 'open');
  const expiredClaimId = expiredList.find(claim => claim.publication.id === lost).id;
  check((await post(`/claims/${expiredClaimId}/accept`, owner.token)).status, 409);
  const afterExpiry = await post('/claims', beto.token, finderClaim(lost));
  check(afterExpiry.status, 201);

  await client.query("UPDATE public.claims SET expires_at = now() - interval '1 second' WHERE id = $1", [afterExpiry.body.claim.id]);
  check((await post(`/claims/${afterExpiry.body.claim.id}/accept`, owner.token)).status, 409);
  check((await request(`/claims/${afterExpiry.body.claim.id}`, { token: owner.token })).body.claim.status, 'expired');

  await client.query("UPDATE public.publications SET status = 'resolved' WHERE id = $1", [lost]);
  check((await post('/claims', stranger.token, finderClaim(lost))).status, 409);
  await client.query("UPDATE public.publications SET status = 'open', expires_at = now() - interval '1 day' WHERE id = $1", [lost]);
  check((await post('/claims', stranger.token, finderClaim(lost))).status, 409);

  await client.query('SAVEPOINT constraints');
  await assert.rejects(client.query(
    "INSERT INTO public.claims(publication_id,claimant_id,kind,found_neighborhood) VALUES($1,$2,'finder','Palermo')",
    [lost, stranger.id],
  ));
  await client.query('ROLLBACK TO SAVEPOINT constraints');
  checks++;

  await client.query('UPDATE public.users SET session_version = 1 WHERE id = $1', [ana.id]);
  check((await request('/claims/mine', { token: ana.token })).status, 401);

  console.log(`${checks} verificaciones HTTP/PostgreSQL correctas: validaciones, reclamos de dueño y de quien encontró, límite de 3 intentos, aceptar y rechazar, vencimiento a 48 horas, privacidad de fotos, contacto y dirección tras aceptar, y restricciones de la base.`);
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await client.query('ROLLBACK');
  await client.end();
  console.log('Datos temporales descartados; no se modificaron reclamos reales.');
}
