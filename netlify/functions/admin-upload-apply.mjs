// Netlify Function wrapper — reuses the (req, res) handler in api/admin/upload-apply.js unchanged.
import handler from "../../api/admin/upload-apply.js";
import { toNetlify } from "../../server/lib/netlifyAdapter.js";

export default toNetlify(handler);

export const config = { path: "/api/admin/employees/upload-apply" };
