// Netlify Function wrapper — reuses the Vercel-style handler in api/admin/admins.js unchanged.
import handler from "../../api/admin/admins.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/admins" };
