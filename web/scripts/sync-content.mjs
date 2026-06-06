#!/usr/bin/env node
/* sync-content.mjs — copy GVNF projects into the app's static content folder.
 *
 * The published app must be self-contained, so the game data (JSON) is bundled
 * into web/public/content/<id>/ at dev/build time (predev/prebuild hooks).
 * This keeps the repo clean (public/content is git-ignored) while every build
 * ships the games it can play. An index.json lists the available game ids so
 * the menu and router are fully data-driven.
 */
import { cp, mkdir, readdir, rm, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");          // .../<worktree>
const webRoot = resolve(__dirname, "..");                  // .../web
const outDir = join(webRoot, "public", "content");

// Source GVNF projects to bundle. Each entry: { id, from }.
const SOURCES = [
  { id: "umbrella-share", from: join(repoRoot, "games", "umbrella-share") },
  { id: "aoi-after-school", from: join(repoRoot, "docs", "samples", "aoi-after-school") },
  { id: "extensions-demo", from: join(repoRoot, "games", "extensions-demo") },
];

async function isGvnfProject(dir) {
  try {
    await stat(join(dir, "game.json"));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const ids = [];
  for (const src of SOURCES) {
    if (!existsSync(src.from) || !(await isGvnfProject(src.from))) {
      console.warn(`[sync-content] skip ${src.id}: no game.json at ${src.from}`);
      continue;
    }
    const dest = join(outDir, src.id);
    await cp(src.from, dest, {
      recursive: true,
      // never copy generated/source-only cruft into the shippable bundle
      filter: (p) => !/(^|\/)(\.DS_Store|node_modules|adaptation-plan\.md|source\.md)$/.test(p),
    });
    ids.push(src.id);
    console.log(`[sync-content] ${src.id}  <-  ${src.from}`);
  }

  await writeFile(join(outDir, "index.json"), JSON.stringify({ games: ids }, null, 2) + "\n");
  console.log(`[sync-content] wrote index.json (${ids.length} game${ids.length === 1 ? "" : "s"})`);
}

main().catch((e) => {
  console.error("[sync-content] failed:", e);
  process.exit(1);
});
