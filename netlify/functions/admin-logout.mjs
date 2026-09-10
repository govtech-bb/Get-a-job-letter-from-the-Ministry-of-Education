// Netlify Function wrapper — reuses the Vercel-style handler in api/admin/logout.js unchanged.
import handler from "../../api/admin/logout.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/logout" };
