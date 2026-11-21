import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const TEXT_LIMIT_BYTES = 163840;
const SCREENSHOT_LIMITS = { max: 4, max_bytes: 262144 };

const REQUIRED_APP_FILES = [
  "app/index.html",
  "app/style.css",
  "app/app.js",
  "app/data/trophies.json",
];

export function buildGuideDossier(
  dir: string,
  limits: { text_max_bytes: number; screenshots: { max: number; max_bytes: number } },
): Uint8Array {
  const shotsDir = join(dir, "screenshots");
  if (!existsSync(shotsDir)) {
    throw new Error(`screenshots directory missing: ${shotsDir}`);
  }

  const trophiesPath = join(dir, "app", "data", "trophies.json");
  const trophiesDoc = JSON.parse(readFileSync(trophiesPath, "utf8"));
  const trophies = trophiesDoc.trophies;
  if (!Array.isArray(trophies) || trophies.length !== 55) {
    throw new Error("trophies.json must hold an object whose trophies array has exactly 55 entries");
  }

  for (const rel of [...REQUIRED_APP_FILES, "shots.json"]) {
    readFileSync(join(dir, rel));
  }

  return buildDossier(dir, limits);
}

const entryFile = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === entryFile;

if (isMain) {
  const repoRoot = dirname(entryFile);
  const dossier = buildGuideDossier(repoRoot, {
    text_max_bytes: TEXT_LIMIT_BYTES,
    screenshots: SCREENSHOT_LIMITS,
  });
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || repoRoot;
  const outPath = join(outDir, "dossier.json");
  writeFileSync(outPath, dossier);
  console.log(`dossier.json written to ${outPath}`);
}
