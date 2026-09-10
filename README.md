# Job letters — Ministry of Education

Alpha service that lets a Ministry of Education Transformation employee request
a job letter on demand, and lets a relying party (bank, retailer) verify the
letter is genuine.

Built by GovTech Barbados with the Ministry of Education Transformation,
following the [Barbados Digital Service Standards](https://github.com/govtech-bb/Barbados-Digital-Service-Standards).

> **Alpha — synthetic data only.** No real employee information is used in this
> build. Field structure mirrors the Ministry's service records and SmartStream
> sources; the production pipeline will replace the JSON file in `data/`.

## What's in this repo

```
data/employees-2000.json     Synthetic dataset (mirrors service-record + SmartStream fields)
styles.css                   GENERATED — the design system stylesheet, built from
                             @govtech-bb/frontend by `npm run build:ds`. Do not edit.
assets/                      Fonts and images, the design system's copied in by the
                             same script alongside the service's own artwork
scripts/build-design-system.js  Regenerates both from the installed package
*.html                       The user-facing pages. The chrome between the
                             `govbb:` comment markers is generated — edit
                             scripts/chrome.js and run `npm run build:pages`.
scripts/chrome.js            Page chrome, from the design system's component pages
scripts/build-pages.js       Renders it into each page
server/
  index.js                   Local dev server: static files plus the /api/* routes
  letterStore.js             Issued letters, HMAC-signed verification tokens
  letterTemplates.js         The four letter body templates (teacher / ministry × permanent / temporary)
  pdf.js                     pdf-lib PDF generation with embedded QR code
  lib/handlers/              The handlers api/ wraps, deployed as Netlify functions
```

## Run locally

```sh
npm install
npm run build:ds                # regenerate styles.css from @govtech-bb/frontend
cp .env.example .env.local      # then fill in the values
npm run dev
```

`styles.css` is committed, so `build:ds` is only needed after changing the
`@govtech-bb/frontend` version. `npm run check:ds` fails if the committed copy
has drifted from the installed package — worth running in CI.

A database is optional: without `DATABASE_URL` the server reads
`data/employees-2000.json`, and without `RESEND_API_KEY` it logs mail instead of
sending it. To use Postgres instead, set `DATABASE_URL` and run
`node server/db/migrate.js` first.

Open <http://localhost:3000>. The dev server serves the same static files
Netlify publishes, plus the JSON API at `/api/*` — the same endpoints the
Netlify functions serve in production, so local dev exercises the deployed
shape.

### Demo employees

`data/employees-2000.json` holds 2,000 synthetic records. The request form asks
for a first name, a last name, an employee ID and an email address on an allowed
domain, and the email's local part has to contain part of the name. One active
record per letter type:

| Name | Employee ID | Email | Letter type |
| --- | --- | --- | --- |
| Judith Drakes | `123456-0001` | `judith.drakes@moe.gov.bb` | Appointed teacher |
| Elizabeth Leacock | `123456-0920` | `elizabeth.leacock@moe.gov.bb` | Teacher with special responsibility |
| Priya Jones | `123456-0003` | `priya.jones@moe.gov.bb` | Temporary teacher |
| Ellen Harding | `123456-1865` | `ellen.harding2@moe.gov.bb` | Ministry permanent staff |
| Kenneth Welch | `123456-1869` | `kenneth.welch@moe.gov.bb` | Ministry temporary staff |

This table used to sit on the start page behind a "Try the demo with synthetic
data" section. It is developer-facing, and on the start page it also demonstrated
to any visitor that a name and an ID are all it takes to have someone's salary
letter emailed — so it lives here now. See #26.

## Production deploy (Netlify)

One Netlify site serves the static frontend and the `/api/*` functions from
a single origin. The functions talk to **Neon** (Postgres) for employees and
the issued-letters log, and **Resend** for email.

`netlify.toml` drives the deploy: `netlify/build.sh` assembles the public
pages into `_site/`, and `netlify/functions/*.mjs` wrap the handlers in
`api/` (via `server/lib/netlifyAdapter.js`) as Netlify Functions on the same
`/api/*` paths the dev server uses.

### 1. Neon

Create a Neon project, copy the **pooled connection string**, then run the
migration locally:

```sh
DATABASE_URL='postgresql://…?sslmode=require' node server/db/migrate.js
```

### 2. Resend

Sign up at <https://resend.com>, create an API key, and add yourself as a
verified test recipient. While you wait for domain verification, send from
`onboarding@resend.dev` (Resend only delivers to addresses you've verified).
For real production mail, verify a subdomain of `moe.gov.bb` and set
`RESEND_FROM=noreply@letters.moe.gov.bb` (or similar).

### 3. Netlify

- Connect this repo to a Netlify site (Git continuous deployment), or deploy
  from a checkout with `netlify deploy --build --prod`.
- In **Site configuration → Environment variables** add (for Production *and*
  Deploy Previews):
  - `DATABASE_URL` — Neon pooled URL
  - `RESEND_API_KEY` — from Resend
  - `RESEND_FROM` — e.g. `onboarding@resend.dev`
  - `LETTER_SIGNING_KEY` — a random 32-byte string (used for the verification
    HMAC; must match what's expected by the QR codes already in the wild)
  - `PUBLIC_BASE_URL` — the site's canonical origin, e.g.
    `https://get-a-job-letter.netlify.app` (baked into verify URLs and
    admin-invite emails)
- Deploy. Pages and functions share one origin:
  `https://<site>.netlify.app` and `https://<site>.netlify.app/api/*`.

## How it works

1. Employee opens the service and enters their first name, last name,
   employee ID and work email address.
2. The server looks the employee up by employee ID, checks the name matches
   that record, and checks the email is on an allowed domain and plausibly
   matches the name. Receipt of the resulting email (stubbed in alpha) is the
   proof of identity.
3. On a match, an HMAC-signed letter token is issued and a PDF is generated
   from the current record using the right template.
4. The PDF carries a QR code and a verification URL. A bank or retailer can
   scan or visit it to confirm the Ministry issued the letter and that it has
   not been altered. Verification reports the record as it stood when the
   letter was issued, not a live employment check.
5. Tampering with the reference or the token will fail verification with a
   clear message.

## What is stubbed in alpha

- **Real email send.** The "sent" page shows the user a direct link to their
  letter instead of pushing it through SMTP.
- **Cryptographic PDF signing.** The token shown on the QR code is an HMAC over
  the letter reference, which proves authenticity to this service. A production
  build would add a PKI signature embedded in the PDF itself.
- **The SharePoint / SmartStream data pipeline.** The `data/employees-2000.json`
  file plays the role the production data push will play.

## Service standards we are following

- **Meet users' needs** — the form asks one question per page, in plain English.
- **Inclusive access** — pages are plain HTML and work without JavaScript.
- **Simple language** — copy is short, no jargon, written for a general reader.
- **First-use success** — the start page makes the next step obvious and
  states what the user will need.
- **Right tools and technology** — Node + Express + the govbb design system, no
  proprietary platform lock-in.
- **Open platforms** — uses the shared govbb design system rather than a
  bespoke style.
- **Openness and transparency** — code intended to be published openly so other
  ministries can adopt the same pattern.
- **Trust and safety** — verification is signed; salary is shown only on the
  letter, never on the public verification page.

## Licence

Code published under the Open Government Licence except where otherwise stated.
