export function readConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535.');
  }
  const databaseUrl = env.DATABASE_URL?.trim() || '';
  if (databaseUrl) {
    let url;
    try { url = new URL(databaseUrl); } catch {
      throw new Error('DATABASE_URL debe ser una URL válida de PostgreSQL.');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('DATABASE_URL debe usar postgres:// o postgresql://.');
    }
  }
  return { port, databaseUrl };
}
