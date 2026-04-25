import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, closeConnection } from './connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('[migrate] Running schema migration...');

  const schemaPath = resolve(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  await sql.unsafe(schema);

  console.log('[migrate] Schema applied successfully.');
  await closeConnection();
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
