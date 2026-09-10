// Netlify Function wrapper — reuses the Vercel-style handler in api/admin/letter.js unchanged.
import handler from "../../api/admin/letter.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/letter" };
