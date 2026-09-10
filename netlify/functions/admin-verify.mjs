// Netlify Function wrapper — reuses the Vercel-style handler in api/admin/verify.js unchanged.
import handler from "../../api/admin/verify.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/verify" };
