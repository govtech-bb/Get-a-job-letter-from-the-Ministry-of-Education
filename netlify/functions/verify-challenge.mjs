// Netlify Function wrapper — reuses the (req, res) handler in api/verify-challenge.js unchanged.
import handler from "../../api/verify-challenge.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/verify-challenge" };
