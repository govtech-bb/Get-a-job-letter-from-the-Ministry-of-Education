// Copies the GovBB Design System stylesheet and assets out of the installed
// package and into the served root, so both deploy targets get them without a
// build step.
//
// The deploy does not run this: netlify/build.sh only assembles _site/ from
// committed files. So the stylesheet has to be committed. The point of
// generating it here is that it stops being an unattributed blob — the header
// records exactly which package version produced it, and `npm run build:ds`
// reproduces it.
//
// Run this after changing the @govtech-bb/frontend version, and commit what it
// writes. `npm run check:ds` fails if the committed copy has drifted.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

// The package does not export ./package.json, so resolve the stylesheet (which
// it does export, as ./css → ./dist/govbb.css) and step up out of dist/.
const PKG = path.resolve(
  path.dirname(require.resolve("@govtech-bb/frontend/css")),
  ".."
);
const VERSION = JSON.parse(
  fs.readFileSync(path.join(PKG, "package.json"), "utf-8")
).version;

// The package's own CSS sits at <pkg>/dist/govbb.css and reaches its fonts with
// url(../assets/fonts/…). We serve the stylesheet from the root instead, where
// the fonts are one level closer, so the URLs are rewritten to match.
function buildStylesheet() {
  const src = fs.readFileSync(path.join(PKG, "dist", "govbb.css"), "utf-8");
  const rewritten = src.replace(/url\((["']?)\.\.\/assets\//g, "url($1./assets/");

  const remaining = rewritten.match(/url\((["']?)\.\.\//g);
  if (remaining) {
    throw new Error(
      `${remaining.length} relative url(../…) reference(s) left after rewriting. ` +
        `The package layout has changed — check dist/govbb.css and update this script.`
    );
  }

  const header =
    `/* GENERATED FILE — do not edit.\n` +
    `   @govtech-bb/frontend@${VERSION}, via \`npm run build:ds\`.\n` +
    `   Font URLs rewritten from ../assets/ to ./assets/ for serving at the root. */\n`;

  return header + rewritten;
}

// Font files are named in the CSS, so a missing one is a silent fallback to a
// system font rather than an error. Copy them all and say how many.
function copyAssets(kind, { overwrite }) {
  const from = path.join(PKG, "assets", kind);
  const to = path.join(ROOT, "assets", kind);
  fs.mkdirSync(to, { recursive: true });

  const copied = [];
  const skipped = [];
  for (const name of fs.readdirSync(from)) {
    const target = path.join(to, name);
    if (!overwrite && fs.existsSync(target)) {
      skipped.push(name);
      continue;
    }
    fs.copyFileSync(path.join(from, name), target);
    copied.push(name);
  }
  return { copied, skipped };
}

// The progressive-enhancement runtime is plain ESM with no build step, so the
// browser can load it directly. Copy it with its directory layout intact —
// index.js imports './src/components/…' and those import back up to it.
function runtimeFiles() {
  // Every .js under src/, not just <dir>/<dir>.js — a component that grows a
  // sibling helper would otherwise be copied incomplete, and the browser's
  // import would 404 and take initAll() down with it for the whole page.
  const out = ["index.js"];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(PKG, rel), { withFileTypes: true })) {
      const child = path.join(rel, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".js")) out.push(child);
    }
  };
  walk("src");
  return out;
}

function copyRuntime() {
  const files = runtimeFiles();
  for (const rel of files) {
    const target = path.join(ROOT, "assets", "govbb", rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(PKG, rel), target);
  }
  return files;
}

// --check has to cover everything build:ds writes, not just the stylesheet: a
// package bump that only touches the runtime JS or a font would otherwise pass
// with a stale committed copy.
function staleCopies() {
  const stale = [];
  const compare = (from, to, label) => {
    if (!fs.existsSync(to) || !fs.readFileSync(from).equals(fs.readFileSync(to))) {
      stale.push(label);
    }
  };
  for (const rel of runtimeFiles()) {
    compare(path.join(PKG, rel), path.join(ROOT, "assets", "govbb", rel), `assets/govbb/${rel}`);
  }
  for (const name of fs.readdirSync(path.join(PKG, "assets", "fonts"))) {
    compare(
      path.join(PKG, "assets", "fonts", name),
      path.join(ROOT, "assets", "fonts", name),
      `assets/fonts/${name}`
    );
  }
  return stale;
}

const check = process.argv.includes("--check");
const css = buildStylesheet();
const cssPath = path.join(ROOT, "styles.css");

if (check) {
  const current = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf-8") : "";
  const stale = staleCopies();
  if (current !== css) stale.unshift("styles.css");
  if (stale.length) {
    console.error(
      `${stale.length} file(s) do not match @govtech-bb/frontend@${VERSION}:\n  ` +
        stale.join("\n  ") +
        `\nRun \`npm run build:ds\` and commit the result.`
    );
    process.exit(1);
  }
  console.log(
    `styles.css, fonts and the runtime are up to date with @govtech-bb/frontend@${VERSION}`
  );
  process.exit(0);
}

fs.writeFileSync(cssPath, css);
console.log(`styles.css  ← @govtech-bb/frontend@${VERSION} (${css.length} bytes)`);

// Fonts belong to the design system, so the package always wins. Images do not:
// assets/images also holds service artwork (the ministry logos), and the crest
// and logo there are the ones the markup already points at, so only add what is
// missing rather than overwriting a file someone chose deliberately.
const fonts = copyAssets("fonts", { overwrite: true });
console.log(`assets/fonts  ${fonts.copied.length} file(s): ${fonts.copied.join(", ")}`);

const images = copyAssets("images", { overwrite: false });
if (images.copied.length) {
  console.log(`assets/images  added ${images.copied.join(", ")}`);
}
if (images.skipped.length) {
  console.log(`assets/images  left alone (already present): ${images.skipped.join(", ")}`);
}

const runtime = copyRuntime();
console.log(`assets/govbb  ${runtime.length} module(s): ${runtime.join(", ")}`);
