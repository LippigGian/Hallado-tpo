import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

export function loginRouter(service) {
  const router = Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Demasiados intentos de ingreso. Intentá más tarde.' } }));
  router.post('/', async (req, res) => {
    try {
      const result = await service.login(req.body);
      res.status(result.status).json(result.body);
    } catch {
      res.status(503).json({ error: 'No se pudo iniciar sesión. Intentá más tarde.' });
    }
  });
  return router;
}
