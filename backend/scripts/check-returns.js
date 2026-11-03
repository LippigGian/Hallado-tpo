// Punto 10: verificación de devolución, historial, valoraciones y agradecimientos contra
// PostgreSQL real. Requiere la migración 010 aplicada. Con `--with-migration` aplica la 010
// dentro de la misma transacción (para probarla antes de migrar la base compartida).
// Todo corre en una transacción que se deshace al final: no modifica datos reales.
//
// Dentro de una transacción now() es siempre el mismo instante, así que para simular el paso
// del tiempo se mueve a mano returns.returned_at.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('Falta DATABASE_URL o JWT_SECRET.');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('BEGIN');
if (process.argv.includes('--with-migration')) {
  await client.query(await readFile(new URL('../migrations/010_returns.sql', import.meta.url), 'utf8'));
  console.log('Migración 010 aplicada solo dentro de esta transacción.');
}
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
  return { status: response.status, body: await response.json() };
}

async function createUser(name) {
  const id = randomUUID();
  await client.query(
    "INSERT INTO public.users(id,email,password_hash,email_verified_at,name) VALUES($1,$2,'temporary-not-a-real-password',now(),$3)",
    [id, `${id}@example.invalid`, name],
  );
  return { id, token: tokens.sign(id) };
}

async function createPublication(owner, { type, category, title }) {
  const found = type === 'found';
  const inserted = await client.query(
    `INSERT INTO public.publications(user_id,type,title,description,category,occurred_at,neighborhood,address,verification_question,verification_answer,status)
     VALUES($1,$2,$3,'Descripción de la publicación',$4,now(),'Palermo','Av. Santa Fe 3000',$5,$6,'claimed')
     RETURNING id`,
    [owner.id, type, title, category, found ? '¿De qué color es?' : null, found ? 'Azul' : null],
  );
  return inserted.rows[0].id;
}

// Reclamo ya resuelto por quien publicó (el flujo de aceptar se prueba en check-claims.js).
async function createClaim(publicationId, claimant, kind, status = 'accepted') {
  const inserted = await client.query(
    `INSERT INTO public.claims(publication_id,claimant_id,kind,status,verification_answer,found_neighborhood,photo_data,photo_mime,responded_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $4 = 'pending' THEN NULL ELSE now() END)
     RETURNING id`,
    kind === 'owner'
      ? [publicationId, claimant.id, kind, status, 'Azul', null, null, null]
      : [publicationId, claimant.id, kind, status, null, 'Palermo', Buffer.from([1]), 'image/png'],
  );
  return inserted.rows[0].id;
}

const ids = cases => cases.map(item => item.id);

try {
  const ana = await createUser('Ana');
  const pedro = await createUser('Pedro');
  const lucia = await createUser('Lucía');

  // Caso 1 ("Es mío"): Ana encontró unas llaves y Pedro es el dueño. Ana devuelve, Pedro recupera.
  const llaves = await createPublication(ana, { type: 'found', category: 'keys', title: 'Llaves con llavero azul' });
  const reclamoLlaves = await createClaim(llaves, pedro, 'owner');
  // Caso 2 ("Lo encontré"): Ana perdió su DNI y Pedro lo encontró. Pedro devuelve, Ana recupera.
  const dni = await createPublication(ana, { type: 'lost', category: 'documents', title: 'DNI perdido' });
  const reclamoDni = await createClaim(dni, pedro, 'finder');
  // Caso 3: reclamo pendiente, todavía no se puede confirmar.
  const billetera = await createPublication(ana, { type: 'found', category: 'other', title: 'Billetera marrón' });
  const reclamoPendiente = await createClaim(billetera, lucia, 'owner', 'pending');

  // Confirmar la devolución: solo quien recupera, una vez, sobre un reclamo aceptado.
  check((await request(`/claims/${reclamoLlaves}/return`, { method: 'POST' })).status, 401);
  check((await request(`/claims/${reclamoLlaves}/return`, { method: 'POST', token: lucia.token })).status, 404);
  check((await request(`/claims/${reclamoLlaves}/return`, { method: 'POST', token: ana.token })).status, 403);
  check((await request(`/claims/${reclamoPendiente}/return`, { method: 'POST', token: lucia.token })).status, 409);
  const devuelto = await request(`/claims/${reclamoLlaves}/return`, { method: 'POST', token: pedro.token });
  check([devuelto.status, devuelto.body.claim.return.returned, devuelto.body.claim.return.role], [200, true, 'recupera']);
  check((await request(`/claims/${reclamoLlaves}/return`, { method: 'POST', token: pedro.token })).status, 409);
  const vistoPorAna = (await request(`/claims/${reclamoLlaves}`, { token: ana.token })).body.claim.return;
  check([vistoPorAna.returned, vistoPorAna.role, vistoPorAna.can_confirm], [true, 'devuelve', false]);
  check((await client.query('SELECT status FROM public.publications WHERE id=$1', [llaves])).rows[0].status, 'resolved');
  check((await request(`/claims/${reclamoDni}/return`, { method: 'POST', token: ana.token })).status, 200);

  // Con la devolución confirmada ya no se acuerda punto de encuentro, pero se puede consultar.
  const punto = { direccion: 'Plaza Serrano, Palermo', horario: 'Sábado 11 h' };
  check((await request(`/claims/${reclamoLlaves}/meeting-point/proposals`, { method: 'POST', token: ana.token, body: punto })).status, 409);
  check((await request(`/claims/${reclamoLlaves}/meeting-point/accept`, { method: 'POST', token: pedro.token })).status, 409);
  const acuerdo = await request(`/claims/${reclamoLlaves}/meeting-point`, { token: ana.token });
  check([acuerdo.status, acuerdo.body.meeting_point.puedeProponer], [200, false]);

  const casos = (await client.query('SELECT id, claim_id FROM public.returns WHERE claim_id = ANY($1)', [[reclamoLlaves, reclamoDni]])).rows;
  const caso1 = casos.find(row => row.claim_id === reclamoLlaves).id;
  const caso2 = casos.find(row => row.claim_id === reclamoDni).id;

  // Historial: pestañas, contraparte y filtros.
  check((await request('/history')).status, 401);
  let historial = (await request('/history', { token: ana.token })).body;
  check([ids(historial.returned), ids(historial.recovered)], [[caso1], [caso2]]);
  check([historial.returned[0].counterpart.name, historial.returned[0].publication.title], ['Pedro', 'Llaves con llavero azul']);
  historial = (await request('/history', { token: pedro.token })).body;
  check([ids(historial.returned), ids(historial.recovered)], [[caso2], [caso1]]);
  historial = (await request('/history?category=documents', { token: ana.token })).body;
  check([ids(historial.returned), ids(historial.recovered)], [[], [caso2]]);
  check(ids((await request('/history', { token: lucia.token })).body.returned), []);

  // El caso 2 se devolvió hace 40 días: sale del último mes y ya no admite valoraciones.
  await client.query("UPDATE public.returns SET returned_at = now() - interval '40 days' WHERE id=$1", [caso2]);
  check(ids((await request('/history?period=mes', { token: ana.token })).body.recovered), []);
  check(ids((await request('/history?period=3meses', { token: ana.token })).body.recovered), [caso2]);
  check((await request('/history?period=semana', { token: ana.token })).status, 400);

  // Valoraciones: cada parte a la otra, una vez, dentro de los 7 días.
  check((await request(`/history/${caso1}/rating`, { method: 'POST', token: lucia.token, body: { value: 'positive' } })).status, 404);
  check((await request(`/history/${caso1}/rating`, { method: 'POST', token: pedro.token, body: { value: 'positive', message: 'Muy amable' } })).status, 201);
  check((await request(`/history/${caso1}/rating`, { method: 'POST', token: pedro.token, body: { value: 'negative' } })).status, 409);
  check((await request(`/history/${caso1}/rating`, { method: 'POST', token: ana.token, body: { value: 'negative', message: 'Llegó una hora tarde' } })).status, 201);
  check((await request(`/history/${caso2}/rating`, { method: 'POST', token: ana.token, body: { value: 'positive' } })).status, 409);

  // Agradecimiento: solo quien recuperó (Pedro, en el caso 1), una vez.
  check((await request(`/history/${caso1}/thanks`, { method: 'POST', token: ana.token, body: { message: 'Gracias' } })).status, 403);
  check((await request(`/history/${caso1}/thanks`, { method: 'POST', token: pedro.token, body: { message: '¡Gracias por cuidar mis llaves!' } })).status, 201);
  check((await request(`/history/${caso1}/thanks`, { method: 'POST', token: pedro.token, body: { message: 'Otra vez' } })).status, 409);
  check((await request(`/history/${caso2}/thanks`, { method: 'POST', token: ana.token, body: { message: 'Gracias' } })).status, 409);

  // El historial refleja lo enviado y lo recibido.
  historial = (await request('/history', { token: ana.token })).body;
  const fb1 = historial.returned[0].feedback;
  check([fb1.open, fb1.can_rate, fb1.can_thank], [true, false, false]);
  check([fb1.given_rating.value, fb1.given_rating.message], ['negative', 'Llegó una hora tarde']);
  check([fb1.received_rating.value, fb1.received_rating.message], ['positive', 'Muy amable']);
  check(fb1.thanks.message, '¡Gracias por cuidar mis llaves!');
  const fb2 = historial.recovered[0].feedback;
  check([fb2.open, fb2.can_rate, fb2.can_thank, fb2.given_rating, fb2.thanks], [false, false, false, null, null]);
  const fbPedro = (await request('/history', { token: pedro.token })).body.recovered[0].feedback;
  check([fbPedro.given_rating.value, fbPedro.received_rating.value, fbPedro.can_rate, fbPedro.can_thank], ['positive', 'negative', false, false]);

  // Reputación pública (punto 2): devoluciones, valoraciones y agradecimientos recibidos.
  const perfilAna = (await request(`/profiles/${ana.id}`)).body.profile.reputation;
  check([perfilAna.completed_returns, perfilAna.positive_ratings, perfilAna.negative_ratings, perfilAna.score], [1, 1, 0, 2]);
  check(perfilAna.thanks.map(t => [t.message, t.author_name]), [['¡Gracias por cuidar mis llaves!', 'Pedro']]);
  const perfilPedro = (await request(`/profiles/${pedro.id}`)).body.profile.reputation;
  check([perfilPedro.completed_returns, perfilPedro.positive_ratings, perfilPedro.negative_ratings, perfilPedro.score], [1, 0, 1, 0]);

  console.log(`${checks} verificaciones HTTP/PostgreSQL correctas: devolución confirmada por quien recupera, publicación resuelta, historial con pestañas y filtros, valoraciones y agradecimiento únicos dentro de los 7 días, y reputación pública.`);
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await client.query('ROLLBACK');
  await client.end();
  console.log('Datos temporales descartados; no se modificaron reclamos, devoluciones ni reputación reales.');
}
