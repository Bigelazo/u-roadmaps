import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = process.env.NEXT_DIST_DIR ?? '.next';
const retired = /@novu\/|novu\.(?:co|com)|NOVU_SECRET_KEY|NEXT_PUBLIC_NOVU_|subscriberHash/;
let checked = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (/\.(js|map|json)$/.test(entry.name)) {
      if (retired.test(await readFile(path, 'utf8'))) {
        throw new Error(`Retired notification integration found in artifact: ${path}`);
      }
      checked += 1;
    }
  }
}
await inspect(join(directory, 'static'));
await inspect(join(directory, 'server'));
for (const path of ['package.json', 'pnpm-lock.yaml']) {
  if (retired.test(await readFile(path, 'utf8'))) {
    throw new Error(`Retired notification dependency found in ${path}`);
  }
}
if (!checked) throw new Error('No build artifacts found; build the application first.');
console.info(
  `Checked ${checked} browser and server artifacts: retired notification SDKs and configuration absent.`,
);
