// Netlify Function wrapper — reuses the (req, res) handler in api/request-letter-form.js unchanged.
import handler from "../../api/request-letter-form.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/request-letter-form" };
