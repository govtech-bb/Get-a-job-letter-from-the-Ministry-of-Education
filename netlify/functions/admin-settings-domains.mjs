// Netlify Function wrapper — reuses the (req, res) handler in api/admin/settings-domains.js unchanged.
import handler from "../../api/admin/settings-domains.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/settings/domains" };
