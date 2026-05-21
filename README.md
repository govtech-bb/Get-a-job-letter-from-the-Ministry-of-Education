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
data/employees.json          Synthetic dataset (mirrors service-record + SmartStream fields)
dist/                        govbb design system bundle (CSS, fonts, images, logo, crest)
server/
  index.js                   Express app and routes
  letterStore.js             Issued letters, HMAC-signed verification tokens
  letterTemplates.js         The four letter body templates (teacher / ministry × permanent / temporary)
  pdf.js                     pdf-lib PDF generation with embedded QR code
  views/
    layout.js                Shared page chrome (header, footer, official banner, alpha banner)
    pages.js                 Start, request, sent, not-found, letter-ready, verify pages
job-letter-request.html      Earlier single-file staff-input prototype (kept for reference)
```

## Run locally

```sh
npm install
npm run dev
```

Open <http://localhost:3000>.

Try the flow with any of the synthetic employees:

| Email | Letter type |
| --- | --- |
| `marcus.bynoe@moe.gov.bb` | Teacher with special responsibility (with allowance) |
| `alexcia.taitt-hope@moe.gov.bb` | Appointed teacher (permanent) |
| `priya.holder@moe.gov.bb` | Appointed teacher (permanent) |
| `denise.greaves@moe.gov.bb` | Ministry permanent staff |
| `andre.skinner@moe.gov.bb` | Ministry permanent staff |
| `jovan.clarke@moe.gov.bb` | Ministry temporary staff |

## How it works

1. Employee opens the service and enters their work email address.
2. The server matches the address against the synthetic record set. Receipt of
   the resulting email (stubbed in alpha) is the proof of identity.
3. On a match, an HMAC-signed letter token is issued and a PDF is generated
   from the current record using the right template.
4. The PDF carries a QR code and a verification URL. A bank or retailer can
   scan or visit it to confirm the letter is genuine and current.
5. Tampering with the reference or the token will fail verification with a
   clear message.

## What is stubbed in alpha

- **Real email send.** The "sent" page shows the user a direct link to their
  letter instead of pushing it through SMTP.
- **Cryptographic PDF signing.** The token shown on the QR code is an HMAC over
  the letter reference, which proves authenticity to this service. A production
  build would add a PKI signature embedded in the PDF itself.
- **The SharePoint / SmartStream data pipeline.** The `data/employees.json`
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
