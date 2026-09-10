// Netlify Function wrapper — reuses the Vercel-style handler in api/admin/template-csv.js unchanged.
import handler from "../../api/admin/template-csv.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/employees/template.csv" };
