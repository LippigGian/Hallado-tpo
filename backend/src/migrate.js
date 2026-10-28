import pg from 'pg';
import { readConfig } from './config.js';
import { runMigrations } from './migrations.js';

const { databaseUrl } = readConfig();
if (!databaseUrl) {
  console.error('Falta DATABASE_URL en backend/.env.');
  process.exitCode = 1;
} else {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
  client.on('error', () => console.error('Se perdió la conexión con PostgreSQL.'));
  try {
    await client.connect();
    await runMigrations(client, new URL('../migrations/', import.meta.url));
  } catch (error) {
    // No volcar mensajes del servidor que pudieran incluir datos de conexión.
    if (error.message.startsWith('Falta la migración') || error.message.startsWith('La migración')) console.error(error.message);
    else console.error(`No se pudieron aplicar las migraciones (${error.code || 'error'}). Revisá la conexión, permisos y esquema existente.`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
