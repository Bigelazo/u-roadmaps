import { execFile, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { cpus, totalmem } from 'node:os';
import { config } from 'dotenv';

config({ path: '.env', quiet: true });
const exec = promisify(execFile);
const [workers, output] = process.argv.slice(2);
if (!/^[1-4]$/.test(workers ?? '') || !output) {
  throw new Error('Usage: node scripts/measure-e2e.mjs <1-4 workers> <output prefix>');
}

function databaseEnvironment(connection, name) {
  const url = new URL(connection);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== `/${name}`) {
    throw new Error(`Measurement requires the local ${name}.`);
  }
  return {
    ...process.env,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGDATABASE: name,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGCONNECT_TIMEOUT: '5',
    PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=5000',
  };
}
const e2e = databaseEnvironment(process.env.E2E_DATABASE_URL, 'roadmap_e2e_db');
const development = databaseEnvironment(process.env.DATABASE_URL, 'roadmap_dev_db');
async function sql(env, script) {
  const { stdout } = await exec('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', script], {
    env,
    timeout: 15_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout.trim();
}
function fingerprint(env) {
  return sql(
    env,
    `
    BEGIN ISOLATION LEVEL REPEATABLE READ;
    CREATE TEMP TABLE fingerprints (name text, hash text);
    DO $$ DECLARE t record; BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
        EXECUTE format('INSERT INTO fingerprints SELECT %L, md5(coalesce(string_agg(row::text, chr(10) ORDER BY row::text), '''')) FROM (SELECT to_jsonb(t) AS row FROM public.%I t) rows', t.tablename, t.tablename);
      END LOOP;
    END $$;
    SELECT md5(string_agg(name || ':' || hash, chr(10) ORDER BY name)) FROM fingerprints;
    ROLLBACK;
  `,
  );
}
const before = await fingerprint(development);
function seededAcknowledgements() {
  return sql(
    e2e,
    `SELECT json_build_object('count', count(*), 'fingerprint',
      md5(coalesce(string_agg(to_jsonb(a)::text, chr(10) ORDER BY to_jsonb(a)::text), '')))
    FROM "NoticeAcknowledgement" a JOIN "User" u ON u.id = a."recipientId"
    WHERE u."institutionalEmail" LIKE '%@u-roadmaps.test';`,
  );
}
const seededBefore = await seededAcknowledgements();
const log = createWriteStream(`${output}.log`);
const started = performance.now();
const startedAt = new Date().toISOString();
const child = spawn('pnpm', ['test:e2e', `--workers=${workers}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
let finished = false;
const completion = new Promise((resolve) => {
  child.once('error', (error) => {
    finished = true;
    resolve({
      code: 1,
      signal: null,
      error: error.message,
      durationSeconds: (performance.now() - started) / 1000,
    });
  });
  child.once('close', (code, signal) => {
    finished = true;
    resolve({ code, signal, durationSeconds: (performance.now() - started) / 1000 });
  });
});
const samples = [];
const samplingErrors = [];
while (!finished) {
  try {
    const [{ stdout }, connections] = await Promise.all([
      exec('ps', ['-axo', 'pid=,ppid=,%cpu=,rss='], { timeout: 10_000 }),
      sql(
        e2e,
        `SELECT json_build_object(
      'total', count(*), 'e2e', count(*) FILTER (WHERE datname = 'roadmap_e2e_db'))
      FROM pg_stat_activity WHERE backend_type = 'client backend' AND pid <> pg_backend_pid();`,
      ),
    ]);
    const processes = stdout
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/).map(Number));
    const descendants = new Set([child.pid]);
    let previousSize;
    do {
      previousSize = descendants.size;
      for (const [pid, parent] of processes) if (descendants.has(parent)) descendants.add(pid);
    } while (descendants.size !== previousSize);
    const own = processes.filter(([pid]) => descendants.has(pid));
    samples.push({
      seconds: (performance.now() - started) / 1000,
      cpuPercent: own.reduce((sum, row) => sum + row[2], 0),
      rssMiB: own.reduce((sum, row) => sum + row[3], 0) / 1024,
      connections: JSON.parse(connections),
    });
  } catch (error) {
    samplingErrors.push({ seconds: (performance.now() - started) / 1000, message: error.message });
  }
  if (!finished) await new Promise((resolve) => setTimeout(resolve, 1000));
}
const result = await completion;
await new Promise((resolve) => log.end(resolve));
const after = await fingerprint(development);
const seededAfter = await seededAcknowledgements();
const cleanup = JSON.parse(
  await sql(
    e2e,
    `SELECT json_build_object(
  'courses', (SELECT count(*) FROM "Course" WHERE starts_with(code, 'E2E-')),
  'users', (SELECT count(*) FROM "User" WHERE "institutionalEmail" LIKE '%@e2e.u-roadmaps.test'),
  'noticeRejectionTriggers', (SELECT count(*) FROM pg_trigger WHERE tgrelid = '"RoadmapNotice"'::regclass AND NOT tgisinternal AND tgname <> 'own_inbox_changed'));`,
  ),
);
const summary = {
  startedAt,
  machine: { cpu: cpus()[0].model, cores: cpus().length, ramGiB: totalmem() / 1024 ** 3 },
  workers: Number(workers),
  ...result,
  samples: samples.length,
  samplingErrors,
  meanCpuPercent: samples.reduce((sum, sample) => sum + sample.cpuPercent, 0) / samples.length,
  peakCpuPercent: Math.max(...samples.map((sample) => sample.cpuPercent)),
  peakRssMiB: Math.max(...samples.map((sample) => sample.rssMiB)),
  peakConnections: Math.max(...samples.map((sample) => sample.connections.total)),
  peakE2eConnections: Math.max(...samples.map((sample) => sample.connections.e2e)),
  developmentFingerprint: { before, after, unchanged: before === after },
  seededAcknowledgements: {
    before: JSON.parse(seededBefore),
    after: JSON.parse(seededAfter),
    unchanged: seededBefore === seededAfter,
  },
  cleanup,
};
await writeFile(`${output}.json`, JSON.stringify({ summary, samples }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
process.exitCode = result.code ?? 1;
if (
  samplingErrors.length ||
  before !== after ||
  seededBefore !== seededAfter ||
  Object.values(cleanup).some((count) => count !== 0)
)
  process.exitCode = 1;
