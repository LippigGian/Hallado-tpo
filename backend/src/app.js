import { sessionRouter } from './session-routes.js';
import { loginRouter } from './login-routes.js';
import express from 'express';
import { registrationRouter } from './registration-routes.js';

export function createApp(database, registrationService, loginService, sessionTokens, recoveryService) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // Liveness: la API está encendida, independientemente de PostgreSQL.
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'hallado-api' });
  });

  // Readiness: consulta real y de solo lectura a PostgreSQL.
  app.get('/health/db', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const result = await database.check();
      if (result.status !== 'connected') {
        return res.status(503).json({ status: 'unavailable', database: 'not_configured' });
      }
      return res.json({ status: 'ok', database: 'connected' });
    } catch {
      return res.status(503).json({ status: 'unavailable', database: 'disconnected' });
    }
  });

  if (sessionTokens) app.use('/auth', sessionRouter(database, sessionTokens));
  if (loginService) app.use('/auth/login', loginRouter(loginService));
  if (recoveryService) app.use('/auth/password-reset', registrationRouter(recoveryService));
  if (registrationService) app.use('/auth/register', registrationRouter(registrationService));

  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'El cuerpo debe ser JSON válido.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  });
  return app;
}
