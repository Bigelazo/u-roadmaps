import { execFile } from 'node:child_process';

const localHosts = ['localhost', '127.0.0.1', '[::1]'];

/** The only database E2E code may touch: the local roadmap_e2e_db. */
export function e2eDatabaseUrl() {
  const connection = process.env.E2E_DATABASE_URL;
  if (!connection) throw new Error('Set E2E_DATABASE_URL in .env.');
  const database = new URL(connection);
  if (!localHosts.includes(database.hostname) || database.pathname !== '/roadmap_e2e_db') {
    throw new Error('E2E requires the local roadmap_e2e_db database.');
  }
  return connection;
}

/**
 * Runs a SQL script with psql in one transaction and returns its unaligned output.
 * The generated Prisma client does not load under Playwright's CommonJS transform
 * (see issue #164), so test data and verification queries share this helper.
 */
export function sql(script: string) {
  const database = new URL(e2eDatabaseUrl());
  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      'psql',
      ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', '-'],
      {
        timeout: 15_000,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          PGHOST: database.hostname.replace(/^\[|\]$/g, ''),
          PGPORT: database.port || '5432',
          PGDATABASE: 'roadmap_e2e_db',
          PGUSER: decodeURIComponent(database.username),
          PGPASSWORD: decodeURIComponent(database.password),
          PGCONNECT_TIMEOUT: '5',
          PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=5000',
        },
      },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`psql failed: ${stderr.trim() || error.message}`));
        else resolve(stdout.trim());
      },
    );
    child.stdin?.end(script);
  });
}

/** Returns the JSON value printed by the last statement of a script. */
export async function queryJson<T>(script: string): Promise<T> {
  const output = await sql(script);
  return JSON.parse(output.split('\n').at(-1) || 'null') as T;
}

export function literal(value: string | number | boolean | Date | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Cannot write ${value} to SQL.`);
    return String(value);
  }
  const text = value instanceof Date ? value.toISOString() : value;
  return `'${text.replaceAll("'", "''")}'`;
}

export function literalList(values: readonly string[]) {
  return values.length ? values.map(literal).join(', ') : 'NULL';
}

export function insert(
  table: string,
  rows: readonly Record<string, string | number | boolean | Date | null | undefined>[],
) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const values = rows.map((row) => `(${columns.map((column) => literal(row[column])).join(', ')})`);
  return `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES\n${values.join(',\n')};\n`;
}
