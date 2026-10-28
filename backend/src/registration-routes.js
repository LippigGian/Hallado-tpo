import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

export function registrationRouter(service) {
  const router = Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intentá más tarde.' } }));
  for (const [path, method] of [['/request-code', 'requestCode'], ['/verify-code', 'verifyCode'], ['/complete', 'complete']]) {
    router.post(path, async (req, res) => {
      try {
        const result = await service[method](req.body);
        if (result.body.retryAfter) res.set('Retry-After', String(result.body.retryAfter));
        res.status(result.status).json(result.body);
      } catch {
        res.status(503).json({ error: 'No se pudo completar la operación. Intentá más tarde.' });
      }
    });
  }
  return router;
}
