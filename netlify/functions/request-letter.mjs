// Netlify Function wrapper — reuses the Vercel handler in api/request-letter.js unchanged.
import handler from "../../api/request-letter.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/request-letter" };
