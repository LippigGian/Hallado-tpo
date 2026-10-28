import { createLoginService } from './login-service.js';
import { createSessionTokens } from './session-tokens.js';
import { createRegistrationService } from './registration-service.js';
import { createRegistrationMailer } from './mailer.js';
import { readConfig } from './config.js';
import { createDatabase } from './database.js';
import { createApp } from './app.js';

const config = readConfig();
const database = createDatabase(config.databaseUrl);
const registration = createRegistrationService(database, { secret: process.env.OTP_SECRET, mailer: createRegistrationMailer() });
const login = createLoginService(database, createSessionTokens(process.env.JWT_SECRET));
const app = createApp(database, registration, login);
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Hallado API: http://localhost:${config.port}/health`);
  if (!config.databaseUrl) console.log('PostgreSQL pendiente: configurar DATABASE_URL en backend/.env.');
});
server.on('error', async (error) => {
  console.error(error.code === 'EADDRINUSE' ? 'El puerto está ocupado. Cambiá PORT en .env.' : 'No se pudo iniciar la API.');
  await database.close();
  process.exitCode = 1;
});

function shutdown() {
  server.close(async () => {
    await database.close();
    process.exitCode = 0;
  });
  server.closeIdleConnections();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
