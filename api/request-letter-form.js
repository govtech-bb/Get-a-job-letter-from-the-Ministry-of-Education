// Vercel serverless wrapper for the no-JavaScript form submit.
//
// Separate from api/request-letter.js on purpose: that one speaks JSON to the
// enhanced page, this one speaks HTML to a browser that is navigating. Same
// underlying handler, different response shape.
//
// No CORS headers here. A form POST is a navigation, not a fetch — the browser
// never preflights it and never reads the response with script, so CORS is not
// what protects this. What matters is that the redirect target is checked
// against an allowlist, which resolveBase does.

import { handleFormSubmit, resolveBase } from "../server/lib/handlers/requestLetterForm.js";

export const config = { runtime: "nodejs" };

// The runtime usually parses urlencoded bodies, but not on every path, so
// handle a raw string too rather than depending on it.
function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const ownOrigin = `${proto}://${req.headers.host}`;

  try {
    const base = resolveBase({
      origin: req.headers.origin,
      referer: req.headers.referer,
      fallbackOrigin: ownOrigin,
    });

    const result = await handleFormSubmit({
      body: parseBody(req),
      base,
      action: `${ownOrigin}/api/request-letter-form`,
      publicBaseUrl: base.replace(/\/$/, ""),
    });

    if (result.redirect) {
      // 303 so the browser follows with GET — a refresh of the confirmation
      // page does not resubmit the form.
      res.setHeader("Location", result.redirect);
      return res.status(303).end();
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(result.status).send(result.html);
  } catch (err) {
    console.error("request-letter-form failed:", err);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res
      .status(500)
      .send("<h1>Sorry, there is a problem with the service</h1><p>Try again later.</p>");
  }
}
