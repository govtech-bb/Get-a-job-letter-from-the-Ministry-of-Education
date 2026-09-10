// Netlify Function wrapper — reuses the Vercel-style handler in api/admin/settings-domains.js unchanged.
import handler from "../../api/admin/settings-domains.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/settings/domains" };
