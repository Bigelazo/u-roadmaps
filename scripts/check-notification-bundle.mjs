import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = join(process.env.NEXT_DIST_DIR ?? '.next', 'static');
const secret = process.env.NOVU_SECRET_KEY;
if (!secret || secret.length < 16) {
  throw new Error('Set NOVU_SECRET_KEY to the same non-production sentinel used for the build.');
}
let checked = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (/\.(js|map)$/.test(entry.name)) {
      const content = await readFile(path, 'utf8');
      if (content.includes(secret) || content.includes('NOVU_SECRET_KEY')) {
        throw new Error(`Novu server secret found in browser artifact: ${path}`);
      }
      checked += 1;
    }
  }
}
await inspect(directory);
if (!checked) throw new Error('No browser artifacts found; build the application first.');
console.info(`Checked ${checked} browser artifacts: Novu server secret absent.`);
