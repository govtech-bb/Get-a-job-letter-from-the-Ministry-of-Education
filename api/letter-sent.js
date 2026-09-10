// Vercel serverless wrapper for the no-JavaScript confirmation page.
//
// Reached by the 303 from api/request-letter-form.js. vercel.json rewrites
// /letter-sent here so the URL a user sees is not an /api/ path.

import { renderLetterSent } from "../server/lib/handlers/letterSent.js";
import { resolveBase } from "../server/lib/handlers/requestLetterForm.js";
import { findIssuedLetter } from "../server/lib/db.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  try {
    const url = new URL(req.url, "http://localhost");
    const result = await renderLetterSent({
      id: url.searchParams.get("id") || "",
      token: url.searchParams.get("t") || "",
      base: resolveBase({ origin: req.headers.origin, referer: req.headers.referer }),
      lookup: findIssuedLetter,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // The page names an email address, so it must not be cached by anything
    // between the service and the person who asked for it.
    res.setHeader("Cache-Control", "no-store");
    return res.status(result.status).send(result.html);
  } catch (err) {
    console.error("letter-sent failed:", err);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(500).send("<h1>Sorry, there is a problem with the service</h1>");
  }
}
