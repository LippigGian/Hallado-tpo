import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

// Toda la ejecución usa el mismo cliente y una única transacción.
export async function runMigrations(client, directory, report = console.log) {
  const files = (await readdir(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
  const applied = [];
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    // El bloqueo transaccional coordina dos compañeros ejecutando migraciones a la vez.
    await client.query('SELECT pg_advisory_xact_lock(784201, 1)');
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const history = await client.query('SELECT name, checksum FROM public.schema_migrations');
    const known = new Map(history.rows.map(row => [row.name, row.checksum]));
    for (const name of known.keys()) {
      if (!files.includes(name)) throw new Error(`Falta la migración aplicada ${name}. Actualizá tu repositorio.`);
    }
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
      if (known.has(name)) {
        if (known.get(name) !== checksum) throw new Error(`La migración ${name} ya aplicada fue modificada. Creá una nueva migración.`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
      applied.push(name);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  for (const name of applied) report(`Aplicada: ${name}`);
  if (!applied.length) report('Sin migraciones pendientes.');
  return applied;
}
