import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const extensionDirectory = join(repositoryRoot, 'extensions', 'u-cursos');
const outputDirectory = join(repositoryRoot, 'dist', 'extensions');
const excludedEntries = new Set(['README.md', 'store']);

function runtimeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.') && !excludedEntries.has(entry.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? runtimeFiles(path) : [relative(extensionDirectory, path)];
    })
    .sort();
}

const { version } = JSON.parse(readFileSync(join(extensionDirectory, 'manifest.json'), 'utf8'));
const archive = join(outputDirectory, `u-roadmaps-u-cursos-${version}.zip`);
const files = runtimeFiles(extensionDirectory);

mkdirSync(outputDirectory, { recursive: true });
rmSync(archive, { force: true });
execFileSync('zip', ['-X', '-q', archive, ...files], { cwd: extensionDirectory, stdio: 'inherit' });

console.log(`${relative(repositoryRoot, archive)} (${files.length} archivos)`);
for (const file of files) console.log(`  ${file}`);
