// Netlify Function wrapper — reuses the (req, res) handler in api/admin/dashboard.js unchanged.
import handler from "../../api/admin/dashboard.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/dashboard" };
