import { listAllowedDomains, addAllowedDomain, removeAllowedDomain } from "../db.js";

const DOMAIN_RX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export async function getDomains() {
  const rows = await listAllowedDomains();
  return { status: 200, body: { domains: rows } };
}

export async function addDomain({ domain, changedBy, isSuperAdmin }) {
  if (!isSuperAdmin) {
    return { status: 403, body: { error: "forbidden", message: "Only super admins can change allowed domains." } };
  }
  const cleaned = String(domain || "").trim().toLowerCase();
  if (!cleaned || !DOMAIN_RX.test(cleaned)) {
    return { status: 400, body: { error: "validation", errors: [{ field: "domain", message: "Enter a valid domain, for example moe.gov.bb" }] } };
  }
  await addAllowedDomain(cleaned, changedBy);
  return { status: 200, body: { ok: true, domain: cleaned } };
}

export async function deleteDomain({ domain, changedBy, isSuperAdmin }) {
  if (!isSuperAdmin) {
    return { status: 403, body: { error: "forbidden", message: "Only super admins can change allowed domains." } };
  }
  const cleaned = String(domain || "").trim().toLowerCase();
  if (!cleaned) {
    return { status: 400, body: { error: "validation", message: "Domain is required." } };
  }
  await removeAllowedDomain(cleaned);
  return { status: 200, body: { ok: true } };
}
