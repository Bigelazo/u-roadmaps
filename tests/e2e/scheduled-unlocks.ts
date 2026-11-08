import { execFile } from 'node:child_process';
import path from 'node:path';
import { e2eDatabaseUrl } from './database';

const releaseScript = path.join(__dirname, 'release-scheduled-unlocks.run.ts');

export function releaseScheduledUnlocks(now = new Date()) {
  return new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      ['--import=tsx', releaseScript, now.toISOString()],
      { timeout: 30_000, env: { ...process.env, DATABASE_URL: e2eDatabaseUrl() } },
      (error, _stdout, stderr) => {
        if (error)
          reject(new Error(`Scheduled unlock release failed: ${stderr.trim() || error.message}`));
        else resolve();
      },
    );
  });
}
