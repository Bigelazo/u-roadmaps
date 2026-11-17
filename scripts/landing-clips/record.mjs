import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseURL = process.env.LANDING_CLIPS_BASE_URL ?? 'http://localhost:3000';
const outputDirectory = join(root, 'public/landing');
const rawDirectory = join(tmpdir(), 'u-roadmaps-landing-clips');
const viewport = { width: 1024, height: 640 };

const personas = {
  teacher: { personaId: '10000000-0000-4000-8000-000000000001' },
  progressStudent: { studentId: '20000000-0000-4000-8000-000000000020' },
  noticeStudentLight: { studentId: '20000000-0000-4000-8000-000000000026' },
  noticeStudentDark: { studentId: '20000000-0000-4000-8000-000000000027' },
  embedStudent: { studentId: '20000000-0000-4000-8000-000000000023' },
  navigateStudent: { studentId: '20000000-0000-4000-8000-000000000031' },
};

const hiddenDevelopmentChrome = `
  button[aria-label="Cambiar perfil de desarrollo"],
  nextjs-portal { display: none !important; }
`;

function installPointer({ css }) {
  const mount = () => {
    const style = document.createElement('style');
    style.textContent = `${css}
      #landing-pointer { position: fixed; left: 0; top: 0; width: 16px; height: 16px; margin: -8px 0 0 -8px;
        border-radius: 50%; background: #0b1220; border: 3px solid #fff; box-sizing: border-box;
        box-shadow: 0 0 0 1px rgba(11,18,32,.45), 0 2px 8px rgba(0,0,0,.35);
        z-index: 2147483647; pointer-events: none; opacity: 0; transition: opacity .2s; }
      #landing-pointer::after { content: ''; position: absolute; inset: -9px; border-radius: 50%;
        border: 2px solid #3b82f6; opacity: 0; transform: scale(.4); }
      #landing-pointer.pressed::after { animation: landing-pointer-pulse .45s ease-out; }
      @keyframes landing-pointer-pulse { from { opacity: .9; transform: scale(.4); } to { opacity: 0; transform: scale(1.5); } }`;
    document.head.append(style);
    const pointer = document.createElement('div');
    pointer.id = 'landing-pointer';
    document.body.append(pointer);
    const place = (event) => {
      pointer.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      pointer.style.opacity = '1';
    };
    window.addEventListener('mousemove', place, true);
    window.addEventListener('pointermove', place, true);
    window.addEventListener(
      'mousedown',
      (event) => {
        place(event);
        pointer.classList.remove('pressed');
        void pointer.offsetWidth;
        pointer.classList.add('pressed');
      },
      true,
    );
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
}

function readEnvironmentValue(name) {
  if (process.env[name]) return process.env[name];
  const line = readFileSync(join(root, '.env'), 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith(`${name}=`));
  return line?.slice(name.length + 1).replace(/^['"]|['"]$/g, '');
}

async function sessionCookie(context, persona) {
  if (persona.personaId) {
    const response = await context.request.post('/api/development/session', {
      data: { userId: persona.personaId },
    });
    if (!response.ok()) throw new Error(`Persona sign-in failed: ${response.status()}`);
    return;
  }
  const token = await encode({
    token: { sub: persona.studentId, useLocalFixtureData: true },
    secret: readEnvironmentValue('NEXTAUTH_SECRET'),
    maxAge: 60 * 60,
  });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, url: baseURL }]);
}

const pause = (page, ms) => page.waitForTimeout(ms);

async function centerOf(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Not visible: ${locator}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function pointerOf(page) {
  page.pointer ??= { x: viewport.width / 2, y: viewport.height / 2 };
  return page.pointer;
}

async function glide(page, target, steps = 22) {
  const point = 'x' in target ? target : await centerOf(target);
  await page.mouse.move(point.x, point.y, { steps });
  Object.assign(pointerOf(page), point);
  return point;
}

async function press(page, target, { steps = 22, before = 280, after = 650 } = {}) {
  await glide(page, target, steps);
  await pause(page, before);
  await page.mouse.down();
  await pause(page, 90);
  await page.mouse.up();
  await pause(page, after);
}

async function typeSlowly(page, text, delay = 55) {
  await page.keyboard.type(text, { delay });
}

async function zoomAt(page, point, notches, direction = -1) {
  await glide(page, point, 14);
  for (let index = 0; index < notches; index += 1) {
    await page.mouse.wheel(0, direction * 100);
    await pause(page, 110);
  }
}

async function scrollIntoReach(page, locator) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const box = await locator.boundingBox();
    if (box && box.y + box.height < viewport.height - 60 && box.y > 70) return;
    await page.mouse.wheel(0, box && box.y < 70 ? -60 : 60);
    await pause(page, 70);
  }
  await pause(page, 300);
}

async function dragBetween(page, from, to, steps = 30) {
  await glide(page, from, 16);
  await pause(page, 200);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  Object.assign(pointerOf(page), to);
  await pause(page, 250);
  await page.mouse.up();
}

const canvasNode = (page, title) =>
  page
    .locator('.react-flow__node')
    .filter({ has: page.locator('p', { hasText: new RegExp(`^${title}$`) }) });

async function waitForCanvas(page) {
  await page.locator('.react-flow__node').first().waitFor();
  await page.waitForLoadState('networkidle').catch(() => {});
  await pause(page, 900);
}

async function openNodeActions(page, title) {
  const node = canvasNode(page, title);
  await press(page, node.getByRole('button', { name: 'Abrir menú de acciones del nodo' }), {
    after: 750,
  });
}

async function deleteNodeIfPresent(page, title) {
  if ((await canvasNode(page, title).count()) === 0) return false;
  await openNodeActions(page, title);
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar nodo' }).click();
  await canvasNode(page, title).waitFor({ state: 'detached' });
  await pause(page, 800);
  return true;
}

const progressNodeId = '60000000-0000-4000-8000-000000000105';
const progressResourceId = '70000000-0000-4000-8000-000000000104';
const newNodeTitle = 'Integrales definidas';
const lockedForNotice = 'Reglas de derivación';

const clips = {
  'teacher-design': {
    persona: () => personas.teacher,
    path: '/courses/MA1001/2026/2',
    async before(page) {
      await deleteNodeIfPresent(page, newNodeTitle);
    },
    async prepare(page) {
      await waitForCanvas(page);
      await zoomAt(page, { x: 470, y: 330 }, 4);
      await pause(page, 700);
      await glide(page, { x: 760, y: 420 }, 10);
    },
    async perform(page) {
      await pause(page, 300);
      await press(page, page.getByRole('button', { name: 'Crear en el mapa' }), {
        steps: 16,
        after: 450,
      });
      await press(page, page.getByRole('menuitem', { name: 'Crear nodo' }), {
        steps: 10,
        after: 500,
      });
      await page.getByRole('textbox', { name: 'Título' }).focus();
      await typeSlowly(page, newNodeTitle, 45);
      await pause(page, 350);
      await press(page, page.getByRole('dialog').getByRole('button', { name: 'Crear nodo' }), {
        steps: 16,
        before: 150,
        after: 100,
      });
      const created = canvasNode(page, newNodeTitle);
      await created.waitFor();
      await page.getByRole('dialog', { name: 'Crear nodo' }).waitFor({ state: 'detached' });
      await pause(page, 500);
      const source = canvasNode(page, 'Continuidad');
      await glide(page, source.getByTestId('roadmap-card'), 14);
      await pause(page, 250);
      const port = await centerOf(source.locator('[data-node-connector="right"]'));
      await dragBetween(page, port, await centerOf(created.locator('p')), 26);
      await pause(page, 800);
      await openNodeActions(page, newNodeTitle);
      await press(page, page.getByRole('button', { name: 'Bloquear', exact: true }), {
        steps: 12,
        before: 150,
        after: 200,
      });
      const confirm = page.getByRole('button', { name: 'Bloquear nodo' });
      await confirm.waitFor();
      await pause(page, 600);
      await press(page, confirm, { steps: 16, before: 150, after: 200 });
      await page.getByText('Nodo bloqueado exitosamente.').waitFor();
      await pause(page, 1200);
    },
  },
  'teacher-notify': {
    persona: () => personas.teacher,
    path: '/courses/MA1001/2026/2',
    async prepare(page) {
      await waitForCanvas(page);
      await glide(page, { x: 700, y: 300 }, 4);
      await page.mouse.down();
      await page.mouse.move(700, 120, { steps: 10 });
      await page.mouse.up();
      await zoomAt(page, { x: 470, y: 330 }, 3);
      await pause(page, 700);
      await glide(page, { x: 760, y: 360 }, 10);
    },
    async perform(page) {
      await pause(page, 500);
      await openNodeActions(page, lockedForNotice);
      await press(page, page.getByRole('button', { name: 'Bloquear', exact: true }), {
        after: 300,
      });
      const confirm = page.getByRole('button', { name: 'Bloquear nodo' });
      await confirm.waitFor();
      await glide(page, confirm, 26);
      await pause(page, 1800);
      await press(page, confirm, { after: 300 });
      await page.getByText('Nodo bloqueado exitosamente.').waitFor();
      await glide(page, { x: 760, y: 360 }, 26);
      await pause(page, 2200);
    },
    async after(page) {
      await page.goto(baseURL + '/courses/MA1001/2026/2');
      await waitForCanvas(page);
      await openNodeActions(page, lockedForNotice);
      await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
      const branch = page.getByRole('button', { name: 'Incluir dependientes' });
      const single = page.getByRole('button', { name: /^(Desbloquear|Solo este nodo)/ });
      await Promise.race([branch.waitFor(), single.first().waitFor()]);
      if (await branch.count()) await branch.click();
      else await single.first().click();
      await page
        .getByText(/desbloquead/i)
        .first()
        .waitFor();
    },
  },
  'teacher-progress': {
    persona: () => personas.teacher,
    path: '/courses/MA1001/2026/2/participants',
    async prepare(page) {
      await page.getByRole('heading', { name: 'Estudiantes', exact: true }).waitFor();
      await page.evaluate(() => {
        const heading = [...document.querySelectorAll('h2,h3')].find(
          (element) => element.textContent?.trim() === 'Estudiantes',
        );
        window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - 96 });
      });
      await pause(page, 600);
      await glide(page, { x: 820, y: 200 }, 6);
    },
    async perform(page) {
      await pause(page, 700);
      await glide(page, { x: 210, y: 180 }, 26);
      await pause(page, 900);
      for (const [x, y] of [
        [300, 420],
        [520, 470],
        [700, 520],
      ]) {
        await glide(page, { x, y }, 24);
        await pause(page, 350);
      }
      for (let index = 0; index < 14; index += 1) {
        await page.mouse.wheel(0, 45);
        await pause(page, 120);
      }
      await pause(page, 600);
      for (const [x, y] of [
        [480, 300],
        [520, 380],
        [560, 460],
        [600, 540],
      ]) {
        await glide(page, { x, y }, 20);
        await pause(page, 420);
      }
      for (let index = 0; index < 12; index += 1) {
        await page.mouse.wheel(0, 45);
        await pause(page, 120);
      }
      await pause(page, 1200);
    },
  },
  'teacher-versions': {
    persona: () => personas.teacher,
    path: '/courses/FI1001/versions',
    async prepare(page) {
      await page.getByRole('heading', { name: 'Historial de versiones' }).waitFor();
      await pause(page, 600);
      await glide(page, { x: 840, y: 160 }, 6);
    },
    async perform(page) {
      await pause(page, 700);
      for (let index = 0; index < 8; index += 1) {
        await page.mouse.wheel(0, 50);
        await pause(page, 110);
      }
      await pause(page, 700);
      const past = page.getByRole('link', { name: 'Primavera 2025', exact: true });
      await past.scrollIntoViewIfNeeded();
      await pause(page, 400);
      await press(page, past, { after: 300 });
      await page.getByText('Solo lectura').waitFor();
      await waitForCanvas(page);
      await pause(page, 600);
      await glide(page, { x: 640, y: 420 }, 20);
      await page.mouse.down();
      await page.mouse.move(470, 360, { steps: 30 });
      await page.mouse.up();
      await pause(page, 600);
      await press(page, page.getByText('Procedencia', { exact: true }), { after: 1800 });
    },
  },
  'student-navigate': {
    persona: () => personas.navigateStudent,
    path: '/courses/CC1002/2026/2',
    async prepare(page) {
      await waitForCanvas(page);
      await pause(page, 1500);
      const target = canvasNode(page, 'Práctica guiada');
      await zoomAt(page, await centerOf(target), 4);
      await pause(page, 600);
      const start = await centerOf(target);
      await glide(page, { x: 900, y: 330 }, 4);
      await pause(page, 150);
      await page.mouse.down();
      await page.mouse.move(900 + (760 - start.x), 330 + (190 - start.y), { steps: 24 });
      await page.mouse.up();
      await pause(page, 600);
      await glide(page, { x: 860, y: 260 }, 6);
    },
    async perform(page) {
      await pause(page, 500);
      const target = canvasNode(page, 'Práctica guiada');
      const start = await centerOf(target);
      await glide(page, { x: 860, y: 300 }, 12);
      await page.mouse.down();
      await page.mouse.move(860 - (start.x - 560), 300 - (start.y - 330), { steps: 40 });
      await page.mouse.up();
      await pause(page, 700);
      await press(page, target.getByTestId('roadmap-card'), { after: 900 });
      await page.getByRole('region', { name: 'Recursos' }).waitFor();
      const resources = page.getByRole('region', { name: 'Recursos' }).getByRole('listitem');
      for (let index = 0; index < (await resources.count()); index += 1) {
        await glide(page, resources.nth(index), 16);
        await pause(page, 450);
      }
      await pause(page, 1200);
    },
  },
  'student-progress': {
    persona: () => personas.progressStudent,
    path: '/courses/MA1001/2026/2',
    async prepare(page) {
      await page.context().route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
      page.context().on('page', (popup) => popup.close().catch(() => {}));
      await waitForCanvas(page);
      await zoomAt(page, { x: 500, y: 250 }, 3);
      await pause(page, 700);
      await glide(page, { x: 300, y: 420 }, 6);
    },
    async perform(page) {
      await pause(page, 500);
      await press(page, canvasNode(page, 'Tasas').getByTestId('roadmap-card'), { after: 900 });
      const link = page.getByRole('region', { name: 'Recursos' }).getByRole('link').first();
      await press(page, link, { after: 700 });
      await page.bringToFront();
      await press(page, page.getByRole('button', { name: 'Completar' }), { after: 400 });
      await page.getByRole('button', { name: 'Completado' }).waitFor();
      await pause(page, 1200);
      await press(page, page.getByRole('button', { name: 'Cerrar detalle' }), { after: 1200 });
      await press(page, page.getByRole('link', { name: 'U-Roadmaps' }), { after: 300 });
      await page.getByRole('heading', { name: 'Introducción al Cálculo' }).waitFor();
      await pause(page, 500);
      const progress = page
        .getByRole('listitem')
        .filter({ hasText: 'MA1001' })
        .getByText(/de \d+ nodos/)
        .first();
      await scrollIntoReach(page, progress);
      const label = await progress.boundingBox();
      await glide(page, { x: label.x - 70, y: label.y + label.height + 14 }, 24);
      await pause(page, 1800);
    },
    async after() {
      const databaseUrl = readEnvironmentValue('DATABASE_URL').split('?')[0];
      execFileSync('psql', [
        databaseUrl,
        '-c',
        `delete from "Completion" where "userId" = '${personas.progressStudent.studentId}' and "roadmapNodeId" = '${progressNodeId}'`,
        '-c',
        `update "ResourceAccess" set "accessCount" = 0 where "userId" = '${personas.progressStudent.studentId}' and "resourceId" = '${progressResourceId}'`,
      ]);
    },
  },
  'student-notices': {
    persona: (theme) =>
      theme === 'dark' ? personas.noticeStudentDark : personas.noticeStudentLight,
    path: '/academic-overview',
    async prepare(page) {
      await page.getByRole('heading', { name: 'Introducción al Cálculo' }).waitFor();
      await pause(page, 800);
      await glide(page, { x: 820, y: 260 }, 6);
    },
    async perform(page) {
      await pause(page, 600);
      await press(page, page.getByRole('button', { name: /^Avisos/ }).first(), { after: 900 });
      const items = page.getByRole('list', { name: 'Lista de avisos' }).getByRole('listitem');
      for (let index = 0; index < Math.min(await items.count(), 3); index += 1) {
        await glide(page, items.nth(index), 18);
        await pause(page, 650);
      }
      await pause(page, 600);
      await page.keyboard.press('Escape');
      await pause(page, 500);
      const roadmapLink = page.getByRole('link', {
        name: 'Abrir roadmap de Introducción al Cálculo',
      });
      await scrollIntoReach(page, roadmapLink);
      await press(page, roadmapLink, { after: 300 });
      await page.getByRole('dialog').first().waitFor({ timeout: 15000 });
      await pause(page, 900);
      const entendido = page.getByRole('dialog').first().getByRole('button', { name: 'Entendido' });
      await glide(page, entendido, 24);
      await pause(page, 1900);
      await press(page, entendido, { before: 150, after: 900 });
    },
  },
  extension: {
    persona: () => personas.embedStudent,
    path: null,
    async prepare(page) {
      const host = `${baseURL}/landing-clips-embed-host`;
      await page.route(host, (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#fff}@media (prefers-color-scheme: dark){html,body{background:#0b1220}}iframe{border:0;width:100%;height:100%;display:block}</style></head><body></body></html>`,
        }),
      );
      await page.goto(host);
      await page.evaluate((src) => {
        const frame = document.createElement('iframe');
        frame.src = src;
        document.body.append(frame);
      }, `${baseURL}/embed/courses/MA1001/2026/2`);
      const frame = page.frameLocator('iframe');
      await frame.locator('main').waitFor({ timeout: 20000 });
      await page.evaluate(() => document.getElementById('landing-pointer')?.remove());
      await glide(page, { x: 840, y: 470 }, 4);
    },
    async perform(page) {
      const frame = page.frameLocator('iframe');
      await frame.locator('.react-flow__node').first().waitFor({ timeout: 20000 });
      await pause(page, 1200);
      const node = frame
        .locator('.react-flow__node')
        .filter({ has: frame.locator('p', { hasText: /^Sucesiones$/ }) });
      await zoomAt(page, await centerOf(node), 3);
      await pause(page, 700);
      await press(page, node.getByTestId('roadmap-card'), { steps: 24, after: 900 });
      await frame.getByRole('region', { name: 'Recursos' }).waitFor();
      await glide(
        page,
        frame.getByRole('region', { name: 'Recursos' }).getByRole('listitem').first(),
        20,
      );
      await pause(page, 2200);
    },
  },
};

function ffmpegBinary() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const candidates = readdirSync(cache)
    .filter((name) => name.startsWith('ffmpeg-'))
    .map((name) => join(cache, name, process.platform === 'darwin' ? 'ffmpeg-mac' : 'ffmpeg-linux'))
    .filter((path) => existsSync(path));
  const binary = candidates.find((path) =>
    execFileSync(path, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).includes('VP8'),
  );
  if (!binary) throw new Error('No bundled ffmpeg with a VP8 encoder was found.');
  return binary;
}

function encodeClip(raw, output, start, duration) {
  execFileSync(
    ffmpegBinary(),
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      start.toFixed(2),
      '-i',
      raw,
      '-t',
      duration.toFixed(2),
      '-an',
      '-c:v',
      'libvpx',
      '-b:v',
      '900k',
      '-maxrate',
      '1400k',
      '-bufsize',
      '2000k',
      '-crf',
      '10',
      '-deadline',
      'good',
      '-cpu-used',
      '1',
      output,
    ],
    { stdio: 'inherit' },
  );
}

async function record(browser, slug, theme) {
  const clip = clips[slug];
  const contextOptions = {
    baseURL,
    viewport,
    deviceScaleFactor: 1,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    colorScheme: theme,
  };
  const persona = clip.persona(theme);

  if (clip.before) {
    const setup = await browser.newContext(contextOptions);
    await sessionCookie(setup, persona);
    const page = await setup.newPage();
    await page.goto(clip.path);
    await waitForCanvas(page);
    await clip.before(page);
    await setup.close();
  }

  const directory = join(rawDirectory, `${slug}-${theme}`);
  rmSync(directory, { recursive: true, force: true });
  const context = await browser.newContext({
    ...contextOptions,
    recordVideo: { dir: directory, size: viewport },
  });
  await sessionCookie(context, persona);
  await context.addCookies([{ name: 'theme', value: theme, url: baseURL }]);
  await context.addInitScript(installPointer, { css: hiddenDevelopmentChrome });
  const page = await context.newPage();
  const born = Date.now();
  if (clip.path) await page.goto(clip.path);
  await clip.prepare(page);
  const start = (Date.now() - born) / 1000;
  await clip.perform(page).catch(async (error) => {
    await page.screenshot({ path: join(directory, 'failure.png') }).catch(() => {});
    await context.close();
    throw error;
  });
  const end = (Date.now() - born) / 1000;
  const video = page.video();
  await context.close();
  const raw = await video.path();

  const output = join(outputDirectory, `${slug}-${theme}.webm`);
  encodeClip(raw, output, start, end - start);
  console.log(
    `${slug}-${theme}: ${(end - start).toFixed(1)} s, ${(statSync(output).size / 1024).toFixed(0)} KB`,
  );

  if (clip.after) {
    const cleanup = await browser.newContext(contextOptions);
    await sessionCookie(cleanup, persona);
    await clip.after(await cleanup.newPage());
    await cleanup.close();
  }
}

const args = process.argv.slice(2);
const themes = args.filter((arg) => arg === 'light' || arg === 'dark');
const slugs = args.filter((arg) => !themes.includes(arg));
const unknown = slugs.filter((slug) => !clips[slug]);
if (unknown.length) {
  console.error(
    `Unknown clips: ${unknown.join(', ')}. Available: ${Object.keys(clips).join(', ')}`,
  );
  process.exit(1);
}

mkdirSync(outputDirectory, { recursive: true });
const browser = await chromium.launch();
try {
  for (const slug of slugs.length ? slugs : Object.keys(clips)) {
    for (const theme of themes.length ? themes : ['light', 'dark']) {
      await record(browser, slug, theme);
    }
  }
} finally {
  await browser.close();
}
