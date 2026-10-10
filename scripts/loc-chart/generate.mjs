// Regenera el gráfico de líneas de código por módulo a partir del historial de git.
// Uso: pnpm loc:chart [salida.html] [rama]   (por defecto: loc-chart.html, main)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [out = "loc-chart.html", branch = "main"] = process.argv.slice(2);
const GROUPS = ["roadmap", "notif", "shared", "app", "otras", "dev", "infra", "docs"];
const CODE_EXT = new Set(["ts", "tsx", "js", "mjs", "mts", "css", "sql"]);
const IGNORED = ["graphify-out/", ".agents/", ".claude/", ".next/", "node_modules/"];

// Devuelve [grupo, esTest] o null si el archivo no se cuenta.
function classify(p) {
  if (/(lock\.(yaml|json)|\.lock)$/.test(p) || IGNORED.some((d) => p.startsWith(d))) return null;
  const ext = p.split(".").pop();
  if (ext === "md") return ["docs", 0];
  if (!CODE_EXT.has(ext)) return null;
  const t = p.startsWith("tests/") || /\.(test|spec)\./.test(p) ? 1 : 0;
  const low = p.toLowerCase();
  if (p.includes("/features/roadmap/")) return ["roadmap", t];
  if (p.includes("/features/notifications/") || p.startsWith("novu/")) return ["notif", t];
  if (/\/features\/(academic-overview|institutional-access)\//.test(p)) return ["otras", t];
  if (/^(src\/development\/|src\/integrations\/|tests\/development|tests\/integrations)/.test(p)) return ["dev", t];
  if (p.startsWith("src/shared/")) return ["shared", t];
  if (low.includes("notif")) return ["notif", t];
  if (/roadmap|node|dagre|canvas|graph|editor|vti|geometry|course/.test(low)) return ["roadmap", t];
  if (/^(src\/components\/|src\/lib\/|src\/hooks\/|src\/types\/|tests\/shared)/.test(p)) return ["shared", t];
  if (/^(src\/app\/|tests\/app\/)/.test(p)) return ["app", t];
  return ["infra", t];
}

// --no-renames: un archivo movido resta en su carpeta vieja y suma en la nueva.
const log = execFileSync(
  "git",
  ["log", branch, "--first-parent", "--diff-merges=first-parent", "--reverse", "--no-renames",
    "--numstat", "--date=short", "--format=@@%h|%ad|%s"],
  { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
);

const totals = new Map();
const rows = [];
let meta = null;
const flush = () => {
  if (meta) rows.push([...meta, ...GROUPS.map((g) => [totals.get(`${g}0`) ?? 0, totals.get(`${g}1`) ?? 0])]);
};
for (const line of log.split("\n")) {
  if (line.startsWith("@@")) {
    flush();
    const [hash, date, ...subject] = line.slice(2).split("|");
    meta = [hash, date, subject.join("|").slice(0, 90)];
  } else if (line.trim()) {
    const [added, deleted, path] = line.split("\t");
    if (added === "-") continue; // binario
    const c = classify(path);
    if (c) totals.set(c.join(""), (totals.get(c.join("")) ?? 0) + Number(added) - Number(deleted));
  }
}
flush();

const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "template.html"), "utf8");
const html = template
  .replace("__LOC_DATA__", () => JSON.stringify(rows).replaceAll("</", "<\\/"))
  .replace("__LOC_COMMITS__", String(rows.length))
  .replace("__LOC_DATE__", new Date().toISOString().slice(0, 10));
writeFileSync(out, html);
console.log(`${out}: ${rows.length} commits, ${GROUPS.map((g, i) => `${g}=${rows.at(-1)[3 + i].join("/")}`).join(" ")}`);
