// Netlify Function wrapper — reuses the Vercel-style handler in api/admin/upload-apply.js unchanged.
import handler from "../../api/admin/upload-apply.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/employees/upload-apply" };
