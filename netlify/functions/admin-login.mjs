// Netlify Function wrapper — reuses the (req, res) handler in api/admin/login.js unchanged.
import handler from "../../api/admin/login.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/login" };
