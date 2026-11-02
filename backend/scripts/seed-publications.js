// Datos de ejemplo para probar el buscador (punto 3) y el detalle (punto 4) sin cargar
// publicaciones a mano desde la app (punto 5). Inserta directamente por SQL en la base
// compartida por el equipo, con el esquema de 006_publications.sql.
//
// Uso (desde backend/, con DATABASE_URL configurado en .env):
//   npm run db:seed                  -> inserta/actualiza las 24 publicaciones de prueba
//   npm run db:seed -- --owner=mail  -> además, asigna 2 publicaciones a esa cuenta real
//   npm run db:seed -- --reset       -> borra únicamente lo que sembró este script
import pg from 'pg';
import { readConfig } from '../src/config.js';
import { recordReputationEvent } from '../src/reputation.js';

const { databaseUrl } = readConfig();
if (!databaseUrl) {
  console.error('Falta DATABASE_URL en backend/.env.');
  process.exitCode = 1;
  process.exit();
}

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const ownerArg = args.find(a => a.startsWith('--owner='));
const ownerEmail = ownerArg ? ownerArg.slice('--owner='.length).trim().toLowerCase() : null;

// Único PNG válido de 1x1 reutilizado para todas las fotos de prueba: evita generar
// bytes de imagen a mano y cualquier riesgo de corromper el formato.
const SAMPLE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=', 'base64');

const USER = i => `5eed0000-0000-4000-8000-10000000000${i}`;
const PUB = i => `5eed0000-0000-4000-8000-2000000000${String(i).padStart(2, '0')}`;
const PHOTO = (pubIndex, photoIndex) => `5eed0000-0000-4000-8000-${`3${String(pubIndex).padStart(2, '0')}${photoIndex}`.padEnd(12, '0')}`;
const REP = i => `5eed0000-0000-4000-8000-40000000000${i}`;

const SEED_USERS = [
  { id: USER(1), email: 'seed-1@hallado.invalid', name: 'Ana (prueba)', neighborhood: 'Palermo' },
  { id: USER(2), email: 'seed-2@hallado.invalid', name: 'Bruno (prueba)', neighborhood: 'Caballito' },
  { id: USER(3), email: 'seed-3@hallado.invalid', name: 'Carla (prueba)', neighborhood: 'Almagro' },
  { id: USER(4), email: 'seed-4@hallado.invalid', name: 'Diego (prueba)', neighborhood: 'Villa Crespo' },
];

// Mismos centroides que mobile/services/search/neighborhoods.js (duplicados a propósito:
// el script de seed no puede importar un módulo que a su vez importa expo-file-system).
const CENTROIDS = {
  'Palermo': [-34.5780, -58.4265],
  'Caballito': [-34.6186, -58.4397],
  'Almagro': [-34.6097, -58.4208],
  'Villa Crespo': [-34.5992, -58.4383],
  'Belgrano': [-34.5622, -58.4583],
  'Recoleta': [-34.5875, -58.3974],
  'San Telmo': [-34.6211, -58.3731],
  'Flores': [-34.6286, -58.4644],
  'Boedo': [-34.6297, -58.4183],
  'Núñez': [-34.5450, -58.4600],
};
const STREET_BY_NEIGHBORHOOD = {
  'Palermo': 'Plaza Serrano, Honduras',
  'Caballito': 'Parque Rivadavia, Av. Rivadavia',
  'Almagro': 'Plaza Almagro, Av. Medrano',
  'Villa Crespo': 'Plaza Julio Cortázar, Av. Corrientes',
  'Belgrano': 'Barrancas de Belgrano, Av. Juramento',
  'Recoleta': 'Plaza Francia, Av. del Libertador',
  'San Telmo': 'Plaza Dorrego, Defensa',
  'Flores': 'Plaza Pueyrredón, Av. Rivadavia',
  'Boedo': 'Plaza Mariano Boedo, Av. Boedo',
  'Núñez': 'Plaza Castelli, Av. Cabildo',
};

// tipo, categoría, título, barrio, días atrás, franja horaria, estado, cantidad de fotos
const ROWS = [
  ['found', 'keys', 'Llavero con 3 llaves y destapador', 'Palermo', 0, 'afternoon', 'open', 2],
  ['found', 'documents', 'Billetera marrón con documentos', 'Caballito', 1, 'morning', 'open', 1],
  ['found', 'electronics', 'Auriculares inalámbricos blancos', 'Almagro', 2, 'night', 'open', 2],
  ['found', 'pets', 'Perrita mestiza negra con collar rojo', 'Villa Crespo', 0, 'morning', 'open', 3],
  ['found', 'clothing', 'Campera de jean talle M', 'Belgrano', 5, 'afternoon', 'open', 1],
  ['found', 'other', 'Paraguas verde plegable', 'Recoleta', 9, 'morning', 'open', 0],
  ['found', 'keys', 'Llave de auto con control', 'San Telmo', 3, 'night', 'claimed', 1],
  ['found', 'electronics', 'Celular con funda azul', 'Palermo', 6, 'afternoon', 'open', 2],
  ['found', 'documents', 'Carpeta con apuntes de facultad', 'Flores', 15, 'morning', 'resolved', 1],
  ['found', 'pets', 'Gato atigrado con cascabel', 'Boedo', 1, 'night', 'open', 2],
  ['found', 'clothing', 'Bufanda de lana gris', 'Núñez', 2, 'early_morning', 'open', 1],
  ['found', 'other', 'Mochila infantil de dinosaurios', 'Caballito', 20, 'afternoon', 'open', 1],
  ['lost', 'keys', 'Llaves con llavero de fútbol', 'Palermo', 1, 'afternoon', 'open', 1],
  ['lost', 'documents', 'Pasaporte en funda negra', 'Recoleta', 0, 'morning', 'open', 0],
  ['lost', 'electronics', 'Notebook gris en estuche', 'Almagro', 4, 'afternoon', 'open', 2],
  ['lost', 'pets', 'Perro beagle llamado Toto', 'Villa Crespo', 2, 'night', 'open', 3],
  ['lost', 'clothing', 'Saco azul de vestir', 'San Telmo', 6, 'night', 'open', 1],
  ['lost', 'other', 'Anteojos recetados marco rojo', 'Belgrano', 1, 'morning', 'claimed', 1],
  ['lost', 'electronics', 'Tablet con funda verde', 'Flores', 8, 'afternoon', 'open', 1],
  ['lost', 'pets', 'Gata blanca con manchas negras', 'Boedo', 3, 'early_morning', 'open', 2],
  ['lost', 'documents', 'Licencia de conducir', 'Caballito', 12, 'morning', 'resolved', 0],
  ['lost', 'keys', 'Llaves de casa con cinta roja', 'Núñez', 0, 'night', 'open', 1],
  ['found', 'keys', 'Llave de candado (prueba propia)', 'Palermo', 1, 'afternoon', 'open', 1],
  ['lost', 'electronics', 'Auriculares negros (prueba propia)', 'Palermo', 2, 'morning', 'open', 1],
];

function isoDaysAgo(days, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Hora representativa de cada franja, en hora de Buenos Aires.
const SLOT_HOUR = { early_morning: '03', morning: '09', afternoon: '15', night: '21' };
function occurredAt(daysAgo, timeSlot) {
  return `${isoDaysAgo(daysAgo)}T${SLOT_HOUR[timeSlot]}:00:00-03:00`;
}

function exactLocation(neighborhood, index) {
  const [lat, lng] = CENTROIDS[neighborhood];
  // Desplazamiento determinístico pequeño (~300m) para no apilar todo en el centroide.
  const offset = ((index % 7) - 3) * 0.001;
  return {
    lat: lat + offset,
    lng: lng - offset,
    address: `${STREET_BY_NEIGHBORHOOD[neighborhood]} ${100 + ((index * 37) % 900)}`,
  };
}

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    const exists = await client.query("SELECT to_regclass('public.publications') AS t");
    if (!exists.rows[0].t) {
      throw new Error('Falta aplicar la migración 006 (correr primero: npm run db:migrate).');
    }
    const publicationIds = ROWS.map((_, i) => PUB(i + 1));

    if (reset) {
      await client.query('BEGIN');
      await client.query('DELETE FROM public.publications WHERE id = ANY($1::uuid[])', [publicationIds]);
      await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [SEED_USERS.map(u => u.id)]);
      await client.query('COMMIT');
      console.log('Se borraron las publicaciones y los usuarios de prueba sembrados por este script.');
      return;
    }

    let ownerId = null;
    if (ownerEmail) {
      const found = await client.query('SELECT id FROM public.users WHERE lower(email)=$1', [ownerEmail]);
      if (!found.rowCount) throw new Error(`No existe ninguna cuenta con el email ${ownerEmail}.`);
      ownerId = found.rows[0].id;
    }

    await client.query('BEGIN');

    for (const user of SEED_USERS) {
      await client.query(
        `INSERT INTO public.users(id,email,password_hash,email_verified_at,name,neighborhood)
         VALUES($1,$2,'seed-not-a-real-password',now(),$3,$4)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.email, user.name, user.neighborhood],
      );
    }

    // Reputación de ejemplo: Ana llega a la insignia "Vecino solidario", Bruno tiene actividad parcial.
    for (let i = 0; i < 6; i++) {
      await recordReputationEvent(client, { userId: USER(1), type: 'return', sourceId: REP(i) });
    }
    for (let i = 6; i < 8; i++) {
      await recordReputationEvent(client, { userId: USER(2), type: 'return', sourceId: REP(i) });
    }
    await recordReputationEvent(client, { userId: USER(2), type: 'rating', sourceId: REP(8), authorId: USER(3), value: 1 });

    // Re-seed: borrar las publicaciones propias (fotos y seguidas se van en cascada) e insertarlas de nuevo
    // con fechas relativas a "hoy", para que el buscador siga mostrando datos recientes.
    await client.query('DELETE FROM public.publications WHERE id = ANY($1::uuid[])', [publicationIds]);

    let assignedToOwner = 0;
    for (let i = 0; i < ROWS.length; i++) {
      const [type, category, title, neighborhood, daysAgo, timeSlot, status, photoCount] = ROWS[i];
      const isOwnTest = i >= 22; // filas 23 y 24 (índice 22 y 23)
      const publisherId = isOwnTest && ownerId ? ownerId : isOwnTest ? USER(4) : SEED_USERS[i % SEED_USERS.length].id;
      if (isOwnTest && ownerId) assignedToOwner++;
      const location = exactLocation(neighborhood, i);
      const description = `Publicación de prueba generada por el seed (${type === 'found' ? 'hallazgo' : 'pérdida'}).`;
      // Los hallazgos llevan pregunta y respuesta de verificación (la exige la tabla).
      const question = type === 'found' ? '¿Qué tiene de particular?' : null;
      const answer = type === 'found' ? 'Dato de prueba' : null;
      await client.query(
        `INSERT INTO public.publications
          (id,user_id,type,category,title,description,neighborhood,occurred_at,status,address,latitude,longitude,verification_question,verification_answer)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [PUB(i + 1), publisherId, type, category, title, description, neighborhood, occurredAt(daysAgo, timeSlot), status, location.address, location.lat, location.lng, question, answer],
      );
      for (let p = 0; p < photoCount; p++) {
        await client.query(
          `INSERT INTO public.publication_photos(id,publication_id,sort_order,data,mime) VALUES ($1,$2,$3,$4,'image/png')`,
          [PHOTO(i + 1, p), PUB(i + 1), p, SAMPLE_PNG],
        );
      }
    }

    await client.query('COMMIT');
    const foundCount = ROWS.filter(r => r[0] === 'found').length;
    const lostCount = ROWS.filter(r => r[0] === 'lost').length;
    console.log(`${ROWS.length} publicaciones de prueba (${foundCount} encontradas, ${lostCount} perdidas).`);
    console.log(ownerEmail ? `${assignedToOwner} quedaron asignadas a ${ownerEmail}.` : 'Las publicaciones de prueba propia quedaron a nombre de Diego (prueba); usá --owner=tu@email para probar la vista de dueño con tu cuenta.');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* sin transacción abierta */ }
    console.error(`No se pudo sembrar: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await main();
