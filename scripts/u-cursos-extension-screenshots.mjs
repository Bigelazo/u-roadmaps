import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(join(repositoryRoot, 'package.json'))('@playwright/test');

const extensionDirectory = join(repositoryRoot, 'extensions', 'u-cursos');
const outputDirectory = join(extensionDirectory, 'store', 'screenshots');
const publicCoursePage = 'https://www.u-cursos.cl/ingenieria/2026/2/CC5003/1/datos_curso/';
const uRoadmapsOrigin = 'https://roadmap.dcc.uchile.cl';
const mockedUnreadCount = 3;
const networkIcon = readFileSync(join(extensionDirectory, 'icons', 'network.svg'), 'utf8');

const embeddedConnectionMock = `<!doctype html>
<html lang="es">
<meta charset="utf-8" />
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3f5f7;
    font-family: system-ui, sans-serif; color: #1f2933; }
  main { max-width: 28rem; padding: 4rem 1.5rem; display: flex; flex-direction: column;
    align-items: center; gap: 1rem; text-align: center; }
  main svg { width: 40px; height: 40px; }
  h1 { margin: 0; font-size: 1.25rem; }
  p { margin: 0; color: #52606d; line-height: 1.5; }
  .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; }
  .button { border-radius: 8px; padding: 0.6rem 1rem; font: 600 0.9rem system-ui, sans-serif;
    border: 1px solid #024ad8; }
  .primary { background: #024ad8; color: #fff; }
  .secondary { background: #fff; color: #024ad8; }
</style>
<main>
  ${networkIcon}
  <h1>Ingresa a U-Roadmaps</h1>
  <p>Ingresa con U-Pasaporte en una pestaña nueva. Cuando termines, vuelve aquí para ver el roadmap.</p>
  <div class="actions">
    <span class="button primary">Ingresar con U-Pasaporte</span>
    <span class="button secondary">Ya ingresé</span>
  </div>
</main>
</html>`;

const promotionalTile = `<!doctype html>
<html lang="es">
<meta charset="utf-8" />
<style>
  body { margin: 0; width: 440px; height: 280px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 20px; background: #f3f5f7;
    font-family: system-ui, sans-serif; }
  .logo { width: 104px; height: 104px; border-radius: 24px; background: #fff; display: grid;
    place-items: center; box-shadow: 0 2px 10px rgb(2 74 216 / 0.15); }
  .logo svg { width: 64px; height: 64px; }
  h1 { margin: 0; font-size: 30px; font-weight: 700; color: #024ad8; letter-spacing: -0.01em; }
</style>
<div class="logo">${networkIcon}</div>
<h1>U-Roadmaps en U-Cursos</h1>
</html>`;

async function launchWithExtension() {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: 'es-CL',
    args: [
      `--disable-extensions-except=${extensionDirectory}`,
      `--load-extension=${extensionDirectory}`,
    ],
  });
  await context.route(`${uRoadmapsOrigin}/api/**/notifications/count`, (route) =>
    route.fulfill({ json: { unread: mockedUnreadCount } }),
  );
  await context.route(`${uRoadmapsOrigin}/embed/**`, (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: embeddedConnectionMock }),
  );
  return context;
}

async function captureCoursePage(context) {
  const page = await context.newPage();
  await page.goto(publicCoursePage, { waitUntil: 'networkidle' });
  await page.locator('li.servicio_u_roadmaps .u-roadmaps-badge:not([hidden])').waitFor();
  await page.screenshot({ path: join(outputDirectory, '01-servicio-con-notificaciones.png') });

  await page.locator('li.servicio_u_roadmaps a').click();
  await page.frameLocator('iframe.u-roadmaps-frame').getByText('Ya ingresé').waitFor();
  await page.screenshot({ path: join(outputDirectory, '02-roadmap-embebido-conexion.png') });
  await page.close();
}

async function capturePromotionalTile(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 440, height: 280 });
  await page.setContent(promotionalTile);
  await page.screenshot({ path: join(outputDirectory, 'promocional-440x280.png') });
  await page.close();
}

mkdirSync(outputDirectory, { recursive: true });
const context = await launchWithExtension();
try {
  await captureCoursePage(context);
  await capturePromotionalTile(context);
} finally {
  await context.close();
}
console.log(`Capturas en ${outputDirectory}`);
