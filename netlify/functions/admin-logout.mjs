// Netlify Function wrapper — reuses the (req, res) handler in api/admin/logout.js unchanged.
import handler from "../../api/admin/logout.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/logout" };
