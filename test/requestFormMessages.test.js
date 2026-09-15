import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LABELS, HINTS, MESSAGES, emailDomainMessage } from "../server/lib/validationMessages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestHtml = fs.readFileSync(path.join(ROOT, "request.html"), "utf8");
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// request.html validates in an inline script and is served as a static file, so
// it cannot import validationMessages.js. These assertions are what stops the
// two copies drifting: the same failure used to read differently depending on
// whether the browser ran the script.
describe("request.html matches the shared validation messages", () => {
  for (const [key, message] of Object.entries(MESSAGES)) {
    // Only the client-side failures appear in the page; the lookup failures are
    // returned by the API and rendered from its response.
    if (key === "recordNotFound" || key === "nameDoesNotMatch") continue;

    it(`carries ${key}`, () => {
      assert.ok(requestHtml.includes(message), `request.html is missing: ${message}`);
    });
  }

  it("builds the allowed-domain message the same way", () => {
    const prefix = emailDomainMessage(["x"]).replace(" (x)", " (");
    assert.ok(requestHtml.includes(prefix), `request.html is missing: ${prefix}`);
  });

  for (const [field, label] of Object.entries(LABELS)) {
    it(`labels ${field} as "${label}"`, () => {
      assert.match(requestHtml, new RegExp(`for="${field}"[^>]*>${escapeRegExp(label)}<`));
    });
  }

  for (const [field, hint] of Object.entries(HINTS)) {
    it(`gives ${field} the hint "${hint}"`, () => {
      assert.match(requestHtml, new RegExp(`id="${field}-hint">${escapeRegExp(hint)}<`));
    });
  }
});

describe("terminology is consistent across the journey", () => {
  const pages = ["index.html", "request.html", "not-found.html"].map(p =>
    fs.readFileSync(path.join(ROOT, p), "utf8")
  );

  for (const [stale, instead] of [
    ["approved domain", "allowed domain"],
    ["Government email address", "Work email address"],
    ["government email address", "work email address"],
    ["employee ID", "National Identification (ID) number"],
    ["Employee ID", "National Identification (ID) number"],
  ]) {
    it(`does not say "${stale}", says "${instead}"`, () => {
      for (const page of pages) {
        assert.equal(page.includes(stale), false, `still says "${stale}"`);
      }
    });
  }
});
