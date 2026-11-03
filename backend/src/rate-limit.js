import { rateLimit } from 'express-rate-limit';

// Límite de pedidos por IP con el formato de error de la API: { error: mensaje }.
export function limiter(windowMs, limit, message) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: message } });
}
