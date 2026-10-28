import { readConfig } from './config.js';
import { createDatabase } from './database.js';

const database = createDatabase(readConfig().databaseUrl);
try {
  const result = await database.check();
  if (result.status === 'connected') console.log('Conexión con PostgreSQL correcta.');
  else {
    console.error('Falta configurar DATABASE_URL en backend/.env.');
    process.exitCode = 1;
  }
} catch {
  console.error('No se pudo conectar a PostgreSQL. Revisá el servidor, DATABASE_URL y la configuración TLS del proveedor.');
  process.exitCode = 1;
} finally {
  await database.close();
}
