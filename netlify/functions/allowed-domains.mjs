// Netlify Function wrapper — reuses the (req, res) handler in api/allowed-domains.js unchanged.
import handler from "../../api/allowed-domains.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/allowed-domains" };
