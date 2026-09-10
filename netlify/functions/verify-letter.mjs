// Netlify Function wrapper — reuses the Vercel-style handler in api/verify-letter.js unchanged.
import handler from "../../api/verify-letter.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/verify-letter" };
