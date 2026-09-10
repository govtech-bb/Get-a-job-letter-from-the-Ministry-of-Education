// Adapter: run the existing Vercel-style (req, res) handlers in api/* as
// Netlify Functions v2, which are Web-standard (Request) -> Response.
//
// Two details this has to get right:
//
//  1. Finalisation. requireAdmin() in adminAuth.js calls next() WITHOUT
//     awaiting it, so `await handler(req, res)` can resolve before the route
//     callback has written the response. On Vercel that is harmless because
//     res is a live ServerResponse. Here we must wait for an explicit
//     json()/send()/end() instead of for the handler promise.
//
//  2. Set-Cookie. api/admin/verify.js and logout.js call res.setHeader with a
//     single cookie string, but Headers needs append semantics so multiple
//     cookies survive.

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
const NO_BODY_STATUSES = new Set([204, 205, 304]);
const DEFAULT_TIMEOUT_MS = 25_000;

function parseCookieHeader(header) {
  if (!header) return {};
  return Object.fromEntries(
    header.split(/;\s*/).filter(Boolean).map((part) => {
      const i = part.indexOf("=");
      if (i < 0) return [part, ""];
      return [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
    })
  );
}

function parseBody(raw, contentType) {
  if (!raw) return undefined;
  const ct = contentType || "";
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return raw;
}

export function toNetlify(vercelHandler, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return async function netlifyHandler(request) {
    const url = new URL(request.url);

    const headers = {};
    for (const [key, value] of request.headers) headers[key.toLowerCase()] = value;

    const query = {};
    for (const [key, value] of url.searchParams) query[key] = value;

    let body;
    if (!BODYLESS_METHODS.has(request.method)) {
      body = parseBody(await request.text(), headers["content-type"]);
    }

    const req = {
      method: request.method,
      url: url.pathname + url.search,
      headers,
      query,
      body,
      cookies: parseCookieHeader(headers.cookie),
    };

    const outHeaders = new Headers();
    let statusCode = 200;
    let payload = null;
    let wrote = false;
    let resolveDone;
    const done = new Promise((resolve) => { resolveDone = resolve; });

    function finish(value) {
      if (wrote) return res;
      wrote = true;
      payload = value === undefined ? null : value;
      resolveDone();
      return res;
    }

    const res = {
      status(code) { statusCode = code; return res; },
      setHeader(name, value) {
        outHeaders.delete(name);
        for (const v of Array.isArray(value) ? value : [value]) {
          outHeaders.append(name, String(v));
        }
        return res;
      },
      appendHeader(name, value) { outHeaders.append(name, String(value)); return res; },
      getHeader(name) { return outHeaders.get(name); },
      removeHeader(name) { outHeaders.delete(name); return res; },
      json(obj) {
        if (!outHeaders.has("content-type")) {
          outHeaders.set("content-type", "application/json; charset=utf-8");
        }
        return finish(JSON.stringify(obj));
      },
      send(data) {
        if (data == null) return finish(null);
        if (typeof data === "string" || data instanceof Uint8Array) return finish(data);
        return res.json(data);
      },
      end(data) { return finish(data); },
      get statusCode() { return statusCode; },
      set statusCode(code) { statusCode = code; },
      get writableEnded() { return wrote; },
      headersSent: false,
    };

    let failure = null;
    Promise.resolve()
      .then(() => vercelHandler(req, res))
      .catch((err) => { failure = err; finish(undefined); });

    let timer;
    const timedOut = await Promise.race([
      done.then(() => false),
      new Promise((resolve) => { timer = setTimeout(() => resolve(true), timeoutMs); }),
    ]);
    clearTimeout(timer);

    if (timedOut && !wrote) {
      console.error("netlifyAdapter: handler did not respond within", timeoutMs, "ms");
      return Response.json({ error: "gateway_timeout" }, { status: 504 });
    }

    if (failure && !payload) {
      console.error("netlifyAdapter: handler threw:", failure);
      return Response.json(
        { error: "internal_error", message: failure.message },
        { status: 500 }
      );
    }

    const sendNoBody = NO_BODY_STATUSES.has(statusCode) || payload == null;
    return new Response(sendNoBody ? null : payload, {
      status: statusCode,
      headers: outHeaders,
    });
  };
}
