import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDirectory = join(root, 'public/landing');
const rawDirectory = join(tmpdir(), 'u-roadmaps-landing-clips');
const viewport = { width: 1024, height: 640 };
const uCursos = 'https://www.u-cursos.cl';
const uRoadmaps = 'https://roadmap.dcc.uchile.cl';
const courseCode = process.env.LANDING_EXTENSION_COURSE ?? 'CC5003';
const nodeTitle = process.env.LANDING_EXTENSION_NODE;
const channel = process.env.LANDING_EXTENSION_CHANNEL ?? 'chromium';
const brandedChrome = channel.startsWith('chrome') || channel.startsWith('msedge');
const extensionDirectory = resolve(
  process.env.LANDING_EXTENSION_DIST ??
    join(homedir(), 'Documents/u-roadmaps-web-extension/dist/chrome'),
);
const uCursosThemes = { light: 'focus', dark: 'focus-dark' };

function installPointer() {
  if (window !== window.top) return;
  const mount = () => {
    const style = document.createElement('style');
    style.textContent = `
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
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
}

const pause = (page, ms) => page.waitForTimeout(ms);

function drawPointer(page, { x, y }, pressed = false) {
  return page
    .evaluate(
      ({ x, y, pressed }) => {
        const pointer = document.getElementById('landing-pointer');
        if (!pointer) return;
        pointer.style.transform = `translate(${x}px, ${y}px)`;
        pointer.style.opacity = '1';
        if (!pressed) return;
        pointer.classList.remove('pressed');
        void pointer.offsetWidth;
        pointer.classList.add('pressed');
      },
      { x, y, pressed },
    )
    .catch(() => {});
}

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
  const from = { ...pointerOf(page) };
  for (let step = 1; step <= steps; step += 1) {
    const progress = 1 - (1 - step / steps) ** 3;
    const position = {
      x: from.x + (point.x - from.x) * progress,
      y: from.y + (point.y - from.y) * progress,
    };
    await page.mouse.move(position.x, position.y);
    await drawPointer(page, position);
  }
  Object.assign(pointerOf(page), point);
  return point;
}

async function press(page, target, { steps = 22, before = 280, after = 650 } = {}) {
  const point = await glide(page, target, steps);
  await pause(page, before);
  await drawPointer(page, point, true);
  await page.mouse.down();
  await pause(page, 90);
  await page.mouse.up();
  await pause(page, after);
}

async function zoomAt(page, point, notches, direction = -1) {
  await glide(page, point, 14);
  for (let index = 0; index < notches; index += 1) {
    await page.mouse.wheel(0, direction * 100);
    await pause(page, 110);
  }
}

function ffmpegBinary() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const binary = readdirSync(cache)
    .filter((name) => name.startsWith('ffmpeg-'))
    .map((name) => join(cache, name, process.platform === 'darwin' ? 'ffmpeg-mac' : 'ffmpeg-linux'))
    .filter((path) => existsSync(path))
    .find((path) =>
      execFileSync(path, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).includes('VP8'),
    );
  if (!binary) throw new Error('No bundled ffmpeg with a VP8 encoder was found.');
  return binary;
}

function encodeClip(raw, output, start, duration) {
  execFileSync(
    ffmpegBinary(),
    [
      ...['-hide_banner', '-loglevel', 'error', '-y'],
      ...['-ss', start.toFixed(2), '-i', raw, '-t', duration.toFixed(2), '-an'],
      ...['-c:v', 'libvpx', '-b:v', '900k', '-maxrate', '1400k', '-bufsize', '2000k'],
      ...['-crf', '10', '-deadline', 'good', '-cpu-used', '1', output],
    ],
    { stdio: 'inherit' },
  );
}

function launch(profile, options = {}) {
  return chromium.launchPersistentContext(profile, {
    channel,
    headless: true,
    viewport,
    deviceScaleFactor: 1,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    ignoreDefaultArgs: brandedChrome ? ['--disable-extensions', '--use-mock-keychain'] : [],
    args: brandedChrome
      ? []
      : [
          `--disable-extensions-except=${extensionDirectory}`,
          `--load-extension=${extensionDirectory}`,
        ],
    ...options,
  });
}

async function courseUrl(page) {
  if (process.env.LANDING_EXTENSION_COURSE_URL) return process.env.LANDING_EXTENSION_COURSE_URL;
  await page.goto(uCursos);
  const link = page.locator(`a[href*="/${courseCode}/"]`).first();
  await link.waitFor({ timeout: 15000 });
  return new URL(await link.getAttribute('href'), uCursos).href.replace(/#.*$/, '');
}

const roadmapFrame = (page) => page.frameLocator('iframe.u-roadmaps-frame');

async function prepare(page) {
  const url = await courseUrl(page);
  await page.goto(url);
  const entry = page.locator('li.servicio_u_roadmaps a');
  await entry.waitFor({ timeout: 15000 });
  await page
    .locator('li.servicio_u_roadmaps .u-roadmaps-badge:not([hidden])')
    .waitFor({ timeout: 8000 })
    .catch(() => console.warn('No unread badge appeared; recording without it.'));
  await page.waitForLoadState('networkidle').catch(() => {});
  await pause(page, 600);
  await glide(page, { x: 720, y: 420 }, 4);
  return entry;
}

async function pickNode(page, frame) {
  const nodes = frame.locator('.react-flow__node');
  if (nodeTitle) return nodes.filter({ has: frame.locator('p', { hasText: nodeTitle }) }).first();
  const boxes = await nodes.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }),
  );
  const frameBox = await page.locator('iframe.u-roadmaps-frame').boundingBox();
  const center = { x: frameBox.width / 2, y: Math.min(frameBox.height, viewport.height) / 2 };
  const nearest = boxes.reduce(
    (best, box, index) => {
      const distance = Math.hypot(box.x - center.x, box.y - center.y);
      return distance < best.distance ? { index, distance } : best;
    },
    { index: 0, distance: Infinity },
  );
  return nodes.nth(nearest.index);
}

async function perform(page, entry) {
  await pause(page, 700);
  await glide(page, entry, 26);
  await pause(page, 900);
  await press(page, entry, { steps: 4, before: 150, after: 300 });
  const frame = roadmapFrame(page);
  await frame.locator('.react-flow__node').first().waitFor({ timeout: 25000 });
  const frameTop = (await page.locator('iframe.u-roadmaps-frame').boundingBox()).y;
  if (frameTop > viewport.height * 0.4) {
    await page.evaluate((top) => window.scrollBy({ top, behavior: 'smooth' }), frameTop - 140);
  }
  await pause(page, 1400);
  const node = await pickNode(page, frame);
  await zoomAt(page, await centerOf(node), 3);
  await pause(page, 700);
  await press(page, node.getByTestId('roadmap-card'), { steps: 24, after: 1000 });
  const resources = frame.getByRole('region', { name: 'Recursos' }).getByRole('listitem');
  if (
    await resources
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false)
  ) {
    for (let index = 0; index < Math.min(await resources.count(), 2); index += 1) {
      await glide(page, resources.nth(index), 20);
      await pause(page, 1100);
    }
  } else {
    console.warn('The opened node shows no resources; pick one with LANDING_EXTENSION_NODE.');
  }
  await pause(page, 1200);
}

const sessionHosts = [
  'www.u-cursos.cl',
  '.u-cursos.cl',
  'roadmap.dcc.uchile.cl',
  'ucampus.uchile.cl',
];
const sameSiteValues = { 0: 'None', 1: 'Lax', 2: 'Strict' };

function firefoxSessionCookies(firefoxProfile) {
  const copy = mkdtempSync(join(tmpdir(), 'u-roadmaps-firefox-cookies-'));
  try {
    for (const file of ['cookies.sqlite', 'cookies.sqlite-wal']) {
      if (existsSync(join(firefoxProfile, file)))
        copyFileSync(join(firefoxProfile, file), join(copy, file));
    }
    const database = new DatabaseSync(join(copy, 'cookies.sqlite'), { readOnly: true });
    const rows = database
      .prepare(
        `SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite FROM moz_cookies WHERE originAttributes = '' AND host IN (${sessionHosts.map(() => '?').join(', ')})`,
      )
      .all(...sessionHosts);
    database.close();
    return rows.map((row) => {
      const sameSite = sameSiteValues[row.sameSite] ?? 'Lax';
      return {
        name: row.name,
        value: row.value,
        domain: row.host,
        path: row.path,
        expires: row.expiry > 1e11 ? row.expiry / 1000 : row.expiry,
        secure: Boolean(row.isSecure),
        httpOnly: Boolean(row.isHttpOnly),
        sameSite: sameSite === 'None' && !row.isSecure ? 'Lax' : sameSite,
      };
    });
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

async function record(firefoxProfile, theme) {
  const directory = join(rawDirectory, `extension-${theme}`);
  rmSync(directory, { recursive: true, force: true });
  const profile = mkdtempSync(join(tmpdir(), 'u-roadmaps-extension-profile-'));
  const context = await launch(profile, {
    colorScheme: theme,
    recordVideo: { dir: directory, size: viewport },
  });
  await context.addCookies(firefoxSessionCookies(firefoxProfile));
  await context.addCookies([
    { name: 'theme', value: uCursosThemes[theme], url: uCursos },
    { name: 'theme', value: theme, url: uRoadmaps, sameSite: 'None', secure: true },
  ]);
  await context.addInitScript(installPointer);
  const page = context.pages()[0] ?? (await context.newPage());
  const born = Date.now();
  try {
    const entry = await prepare(page);
    const start = (Date.now() - born) / 1000;
    await perform(page, entry);
    const end = (Date.now() - born) / 1000;
    const video = page.video();
    await context.close();
    const output = join(outputDirectory, `extension-${theme}.webm`);
    encodeClip(await video.path(), output, start, end - start);
    console.log(
      `extension-${theme}: ${(end - start).toFixed(1)} s, ${(statSync(output).size / 1024).toFixed(0)} KB`,
    );
  } catch (error) {
    await page.screenshot({ path: join(directory, 'failure.png') }).catch(() => {});
    await context.close();
    throw error;
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const firefoxProfile =
  args.find((arg) => !['light', 'dark'].includes(arg)) ??
  process.env.LANDING_EXTENSION_FIREFOX_PROFILE;
if (!firefoxProfile || !existsSync(join(firefoxProfile, 'cookies.sqlite'))) {
  console.error(
    'Usage: node scripts/landing-clips/record-extension.mjs <Firefox profile signed in to U-Cursos and U-Roadmaps> [light|dark]',
  );
  process.exit(1);
}

mkdirSync(outputDirectory, { recursive: true });
const themes = args.filter((arg) => arg === 'light' || arg === 'dark');
for (const theme of themes.length ? themes : ['light', 'dark']) await record(firefoxProfile, theme);
