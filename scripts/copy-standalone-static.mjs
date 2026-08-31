import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';

// `output: 'standalone'` deja fuera los recursos estáticos, porque espera que
// un CDN los sirva. El despliegue con pm2 ejecuta el servidor mínimo desde
// `<distDir>/standalone`, así que necesita esos archivos junto al servidor.
const distDir = process.env.NEXT_DIST_DIR ?? '.next';
const source = join(distDir, 'static');
const target = join(distDir, 'standalone', distDir, 'static');

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log(`Recursos estáticos copiados a ${target}`);
