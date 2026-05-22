// One-off: render assets/images/govbb-creast.svg as a high-resolution PNG so
// it can be embedded in the PDF (pdf-lib doesn't support SVG directly).
//
// Usage:  node scripts/rasterize-crest.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const svgPath = path.join(ROOT, "assets", "images", "govbb-creast.svg");
const outPath = path.join(ROOT, "assets", "images", "govbb-creast.png");

const svg = fs.readFileSync(svgPath, "utf-8");
const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 400 } });
const png = resvg.render().asPng();
fs.writeFileSync(outPath, png);

const stat = fs.statSync(outPath);
console.log(`Wrote ${outPath} (${Math.round(stat.size / 1024)} KB).`);
