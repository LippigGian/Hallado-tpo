import pg from 'pg';

export function createDatabase(databaseUrl) {
  const pool = databaseUrl ? new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
    max: 5,
    idleTimeoutMillis: 10000,
  }) : null;
  pool?.on('error', () => {
    // No imprimir URLs, credenciales ni detalles internos de PostgreSQL.
    console.error('Se perdió una conexión inactiva con PostgreSQL.');
  });

  return {
    async check() {
      if (!pool) return { status: 'not_configured' };
      await pool.query('SELECT 1 AS connected');
      return { status: 'connected' };
    },
    async query(text, values) {
      if (!pool) throw new Error('Database not configured');
      return pool.query(text, values);
    },
    async transaction(callback) {
      if (!pool) throw new Error('Database not configured');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    async close() { if (pool) await pool.end(); },
  };
}
