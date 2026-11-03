// Punto 9: verificación de alertas, seguidas y novedades contra PostgreSQL real.
// Requiere la migración 009 aplicada. Con `--with-migration` aplica la 009 dentro de la misma
// transacción (para probarla antes de migrar la base compartida).
// Todo corre en una transacción que se deshace al final: no modifica datos reales.
//
// Dentro de una transacción now() es siempre el mismo instante, así que para simular el paso
// del tiempo se mueven a mano last_seen_at y created_at.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { createSessionTokens } from '../src/session-tokens.js';
import { todayInArgentina } from '../src/alert-validation.js';

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('Falta DATABASE_URL o JWT_SECRET.');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('BEGIN');
if (process.argv.includes('--with-migration')) {
  await client.query(await readFile(new URL('../migrations/009_alerts.sql', import.meta.url), 'utf8'));
  console.log('Migración 009 aplicada solo dentro de esta transacción.');
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

// Barrio único para que las publicaciones reales de la base no cambien los conteos.
const barrio = `Barrio prueba ${randomUUID().slice(0, 8)}`;

async function createPublication(owner, { type = 'found', neighborhood = barrio, title = 'Llavero azul de prueba', daysAgo = 0, minutesAgo = 0 } = {}) {
  const found = type === 'found';
  const inserted = await client.query(
    `INSERT INTO public.publications(user_id,type,title,description,category,occurred_at,neighborhood,address,verification_question,verification_answer,created_at)
     VALUES($1,$2,$3,'Descripción de la publicación','keys',now()-($4::int*interval '1 day'),$5,'Av. Rivadavia 5000',$6,$7,now()-($8::int*interval '1 minute'))
     RETURNING id`,
    [owner.id, type, title, daysAgo, neighborhood, found ? '¿De qué color es?' : null, found ? 'Azul' : null, minutesAgo],
  );
  return inserted.rows[0].id;
}

try {
  const ana = await createUser('Ana');
  const pedro = await createUser('Pedro');
  const hoy = todayInArgentina();

  // Ana perdió un llavero: su alerta busca hallazgos (tipo opuesto).
  const nueva = await createPublication(pedro);
  const vieja = await createPublication(pedro, { minutesAgo: 120 });
  await createPublication(ana); // propia: no cuenta
  await createPublication(pedro, { type: 'lost' }); // mismo tipo que lo que le pasó: no coincide
  await createPublication(pedro, { neighborhood: 'Otro barrio de prueba' });
  await createPublication(pedro, { daysAgo: 10 }); // fuera del rango de fechas
  await createPublication(pedro, { title: 'Billetera marrón' }); // no tiene la palabra clave

  const criterios = { situation: 'lost', category: 'keys', neighborhood: barrio, keywords: 'llavero', date_preset: 'hoy', date_from: hoy, date_to: hoy };
  check((await request('/alerts', { method: 'POST', body: criterios })).status, 401);
  const created = await request('/alerts', { method: 'POST', token: ana.token, body: criterios });
  check(created.status, 201);
  const alerta = created.body.alert;
  check([alerta.date_preset, alerta.date_from, alerta.date_to, alerta.new_count, alerta.paused], ['hoy', hoy, hoy, 0, false]);
  // El índice único ignora mayúsculas y espacios: es la misma búsqueda.
  const duplicada = await request('/alerts', { method: 'POST', token: ana.token, body: { ...criterios, keywords: '  LLAVERO ', neighborhood: barrio.toUpperCase() } });
  check([duplicada.status, duplicada.body.code], [409, 'duplicate']);
  check((await request('/alerts', { method: 'POST', token: ana.token, body: { ...criterios, date_from: hoy, date_to: '2099-01-01' } })).status, 400);

  // Recién creada no tiene novedades. Simulamos que Ana la abrió por última vez hace una hora.
  check((await request('/alerts', { token: ana.token })).body.alerts.map(a => a.new_count), [0]);
  await client.query("UPDATE public.search_alerts SET last_seen_at=now()-interval '1 hour' WHERE id=$1", [alerta.id]);

  const lista = await request('/alerts', { token: ana.token });
  check([lista.status, lista.body.alerts.length, lista.body.alerts[0].new_count], [200, 1, 1]);
  check((await request('/alerts', { token: pedro.token })).body.alerts, []);

  const coincidencias = await request(`/alerts/${alerta.id}/publications`, { token: ana.token });
  check(coincidencias.status, 200);
  check(coincidencias.body.results.map(r => [r.id, r.is_new]), [[nueva, true], [vieja, false]]);
  check(coincidencias.body.total, 2);
  check((await request(`/alerts/${alerta.id}/publications`, { token: pedro.token })).status, 404);

  check((await request('/me/novelties', { token: ana.token })).body.alerts, { new_publications: 1, with_news: 1 });

  // Pausar: no avisa. Reanudar: lo publicado durante la pausa no se acumula.
  const pausada = await request(`/alerts/${alerta.id}`, { method: 'PATCH', token: ana.token, body: { paused: true } });
  check([pausada.status, pausada.body.alert.paused, pausada.body.alert.new_count], [200, true, 0]);
  check((await request('/me/novelties', { token: ana.token })).body.alerts, { new_publications: 0, with_news: 0 });
  check((await request(`/alerts/${alerta.id}`, { method: 'PATCH', token: pedro.token, body: { paused: false } })).status, 404);
  const reanudada = await request(`/alerts/${alerta.id}`, { method: 'PATCH', token: ana.token, body: { paused: false } });
  check([reanudada.body.alert.paused, reanudada.body.alert.new_count], [false, 0]);

  // Marcar como vista.
  await client.query("UPDATE public.search_alerts SET last_seen_at=now()-interval '1 hour' WHERE id=$1", [alerta.id]);
  check((await request('/alerts', { token: ana.token })).body.alerts[0].new_count, 1);
  check((await request(`/alerts/${alerta.id}/seen`, { method: 'POST', token: ana.token })).body.alert.new_count, 0);
  check((await request('/alerts', { token: ana.token })).body.alerts[0].new_count, 0);

  // Eliminar.
  check((await request(`/alerts/${alerta.id}`, { method: 'DELETE', token: pedro.token })).status, 404);
  check((await request(`/alerts/${alerta.id}`, { method: 'DELETE', token: ana.token })).status, 200);
  check((await request('/alerts', { token: ana.token })).body.alerts, []);

  // Tope de 10 alertas por persona.
  for (let i = 0; i < 10; i++) {
    check((await request('/alerts', { method: 'POST', token: ana.token, body: { situation: 'lost', keywords: `palabra${i}` } })).status, 201);
  }
  const tope = await request('/alerts', { method: 'POST', token: ana.token, body: { situation: 'lost', keywords: 'otra' } });
  check([tope.status, tope.body.code], [409, 'limit']);

  // Seguidas: al seguir no hay novedad; cambia el estado y aparece; abrir el detalle la marca como vista.
  check((await request(`/publications/${nueva}/follow`, { method: 'POST', token: ana.token })).status, 200);
  let seguidas = await request('/follows', { token: ana.token });
  check(seguidas.body.publications.map(p => [p.id, p.status, p.has_update]), [[nueva, 'open', false]]);

  await client.query("UPDATE public.publications SET status='claimed' WHERE id=$1", [nueva]);
  seguidas = await request('/follows', { token: ana.token });
  check(seguidas.body.publications.map(p => [p.status, p.previous_status, p.has_update]), [['claimed', 'open', true]]);
  check((await request('/me/novelties', { token: ana.token })).body.follows, { updated: 1 });

  check((await request(`/publications/${nueva}`, { token: ana.token })).status, 200);
  check((await request('/follows', { token: ana.token })).body.publications[0].has_update, false);
  check((await request('/me/novelties', { token: ana.token })).body.follows, { updated: 0 });

  // "Vencida" no se guarda en la base, pero también cuenta como cambio de estado.
  await client.query("UPDATE public.publications SET status='open', expires_at=now()-interval '1 minute' WHERE id=$1", [nueva]);
  seguidas = await request('/follows', { token: ana.token });
  check(seguidas.body.publications.map(p => [p.status, p.previous_status, p.has_update]), [['expired', 'claimed', true]]);
  check((await request('/follows', { token: pedro.token })).body.publications, []);

  // Barrio elegido de la lista en el buscador ("Agronomía") y escrito a mano al publicar
  // ("agronomia ", sin tilde): tienen que coincidir, en el buscador y en la alerta.
  const sufijo = randomUUID().slice(0, 8);
  const conTilde = `Agronomía ${sufijo}`;
  const aMano = `agronomia ${sufijo} `;
  const otroBarrio = await createPublication(pedro, { neighborhood: aMano });
  const busqueda = await request(`/publications?situation=lost&neighborhood=${encodeURIComponent(conTilde)}`);
  check(busqueda.body.results.map(r => r.id), [otroBarrio]);
  const primera = (await request('/alerts', { token: ana.token })).body.alerts[0];
  check((await request(`/alerts/${primera.id}`, { method: 'DELETE', token: ana.token })).status, 200); // libera lugar (tope 10)
  const alertaTilde = await request('/alerts', { method: 'POST', token: ana.token, body: { situation: 'lost', neighborhood: conTilde } });
  check(alertaTilde.status, 201);
  await client.query("UPDATE public.search_alerts SET last_seen_at=now()-interval '1 hour' WHERE id=$1", [alertaTilde.body.alert.id]);
  check((await request('/alerts', { token: ana.token })).body.alerts.find(a => a.id === alertaTilde.body.alert.id).new_count, 1);

  console.log(`${checks} verificaciones HTTP/PostgreSQL correctas: alertas con fechas concretas, mismas coincidencias que el buscador sin las propias, novedades desde la última vista, pausa, eliminación, tope, duplicados y novedades de estado en las seguidas.`);
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await client.query('ROLLBACK');
  await client.end();
  console.log('Datos temporales descartados; no se modificaron alertas ni publicaciones reales.');
}
