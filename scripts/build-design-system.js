// Copies the GovBB Design System stylesheet and assets out of the installed
// package and into the served root, so both deploy targets get them without a
// build step.
//
// Neither target builds: GitHub Pages deploys main/root as-is, and vercel.json
// sets "buildCommand": null. So the stylesheet has to be committed. The point of
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
function copyRuntime() {
  const files = ["index.js"];
  const componentsFrom = path.join(PKG, "src", "components");
  for (const dir of fs.readdirSync(componentsFrom)) {
    const js = path.join("src", "components", dir, `${dir}.js`);
    if (fs.existsSync(path.join(PKG, js))) files.push(js);
  }

  for (const rel of files) {
    const target = path.join(ROOT, "assets", "govbb", rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(PKG, rel), target);
  }
  return files;
}

const check = process.argv.includes("--check");
const css = buildStylesheet();
const cssPath = path.join(ROOT, "styles.css");

if (check) {
  const current = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf-8") : "";
  if (current !== css) {
    console.error(
      `styles.css does not match @govtech-bb/frontend@${VERSION}.\n` +
        `Run \`npm run build:ds\` and commit the result.`
    );
    process.exit(1);
  }
  console.log(`styles.css is up to date with @govtech-bb/frontend@${VERSION}`);
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
