// Punto 8: verificación del punto de encuentro contra PostgreSQL real (requiere la migración 008).
// Todo corre en una transacción que se deshace al final: no modifica datos reales.
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
  return { status: response.status, body: await response.json() };
}
const post = (path, token, body) => request(path, { method: 'POST', token, body });

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=';

async function createUser(name) {
  const id = randomUUID();
  await client.query(
    "INSERT INTO public.users(id,email,password_hash,email_verified_at,name) VALUES($1,$2,'temporary-not-a-real-password',now(),$3)",
    [id, `${id}@example.invalid`, name],
  );
  return { id, token: tokens.sign(id) };
}

async function createPublication(owner, type) {
  const found = type === 'found';
  const inserted = await client.query(
    `INSERT INTO public.publications(user_id,type,title,description,category,occurred_at,neighborhood,address,latitude,longitude,verification_question,verification_answer)
     VALUES($1,$2,'Llaves de prueba','Descripción de la publicación','keys',now(),'Caballito','Av. Rivadavia 5000',-34.618765,-58.436789,$3,$4) RETURNING id`,
    [owner.id, type, found ? '¿De qué color es el llavero?' : null, found ? 'Azul' : null],
  );
  return inserted.rows[0].id;
}

try {
  const owner = await createUser('Dueño');
  const ana = await createUser('Ana');
  const intruso = await createUser('Intruso');

  // "Es mío" sobre algo encontrado: el objeto lo tiene quien publicó.
  const found = await createPublication(owner, 'found');
  const claim = await post('/claims', ana.token, { publication_id: found, verification_answer: 'Azul' });
  check(claim.status, 201);
  const path = `/claims/${claim.body.claim.id}/meeting-point`;
  const punto = { direccion: 'Plaza Irlanda, Caballito', horario: 'Sábado 11 h', referencia: 'Entrada por Gaona' };

  check((await post(`${path}/proposals`, owner.token, punto)).status, 409); // reclamo todavía pendiente
  check((await post(`/claims/${claim.body.claim.id}/accept`, owner.token)).status, 200);

  check((await request(path)).status, 401);
  check((await request(path, { token: intruso.token })).status, 404);
  const empty = await request(path, { token: owner.token });
  check([empty.status, empty.body.meeting_point.estado, empty.body.meeting_point.rol], [200, 'sin_propuesta', 'tiene_objeto']);
  check((await request(path, { token: ana.token })).body.meeting_point.rol, 'otra_parte');

  check((await post(`${path}/proposals`, ana.token, punto)).status, 409);
  check((await post(`${path}/proposals`, owner.token, { direccion: 'ab', horario: '' })).status, 400);
  const first = await post(`${path}/proposals`, owner.token, punto);
  check([first.status, first.body.meeting_point.estado, first.body.meeting_point.propuestas[0].referencia], [201, 'propuesto', 'Entrada por Gaona']);
  check((await post(`${path}/proposals`, owner.token, punto)).status, 409);
  check((await post(`${path}/accept`, owner.token)).status, 409);

  const alternative = await post(`${path}/proposals`, ana.token, { direccion: 'Parque Centenario', horario: 'Domingo 10 h' });
  check([alternative.status, alternative.body.meeting_point.propuestas.length], [201, 2]);
  check((await request(path, { token: owner.token })).body.meeting_point.puedeResponder, true);

  const accepted = await post(`${path}/accept`, owner.token);
  check([accepted.status, accepted.body.meeting_point.estado, accepted.body.meeting_point.aceptado.direccion], [200, 'aceptado', 'Parque Centenario']);
  check((await post(`${path}/accept`, ana.token)).status, 409);
  check((await post(`${path}/proposals`, ana.token, punto)).status, 409);
  check((await request(path, { token: ana.token })).body.meeting_point.aceptado.propuestoPor, 'otra_parte');

  // La base no admite dos propuestas aceptadas para el mismo reclamo.
  await client.query('SAVEPOINT unico');
  await assert.rejects(client.query(
    "INSERT INTO public.meeting_point_proposals(claim_id,proposed_by,address,schedule,accepted_at) VALUES($1,$2,'Otro lugar','Lunes',now())",
    [claim.body.claim.id, owner.id],
  ));
  await client.query('ROLLBACK TO SAVEPOINT unico');
  checks++;

  // "Lo encontré" sobre algo perdido: el objeto lo tiene quien reclamó.
  const lost = await createPublication(owner, 'lost');
  const finder = await post('/claims', ana.token, { publication_id: lost, photo: PNG, found_neighborhood: 'Palermo' });
  check(finder.status, 201);
  check((await post(`/claims/${finder.body.claim.id}/accept`, owner.token)).status, 200);
  const finderPath = `/claims/${finder.body.claim.id}/meeting-point`;
  check((await request(finderPath, { token: ana.token })).body.meeting_point.rol, 'tiene_objeto');
  check((await post(`${finderPath}/proposals`, owner.token, punto)).status, 409);
  check((await post(`${finderPath}/proposals`, ana.token, punto)).status, 201);

  console.log(`${checks} verificaciones HTTP/PostgreSQL correctas: punto de encuentro solo con reclamo aceptado, quién propone primero según el tipo, alternativas por turnos, aceptación única y privacidad entre participantes.`);
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await client.query('ROLLBACK');
  await client.end();
  console.log('Datos temporales descartados; no se modificaron reclamos reales.');
}
