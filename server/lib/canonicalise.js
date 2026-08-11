// Builds a canonical string from an employee snapshot for HMAC fingerprinting.
// The canonical form is deterministic: same employee data always produces the
// same string. This is critical — changing the order, normalisation rules, or
// field set after letters are in circulation invalidates every issued code.

const FIELDS = [
  { key: "title",            type: "text" },
  { key: "firstName",        type: "text" },
  { key: "lastName",         type: "text" },
  { key: "pronoun",          type: "text" },
  { key: "address",          type: "text" },
  { key: "letterType",       type: "text" },
  { key: "post",             type: "text" },
  { key: "school",           type: "text" },
  { key: "employer",         type: "text" },
  { key: "appointmentDate",  type: "date" },
  { key: "monthlySalary",    type: "money" },
  { key: "monthlyAllowance", type: "money" },
  { key: "payFrequency",     type: "text" },
];

function normaliseText(value) {
  if (value == null || value === "") return "";
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseDate(value) {
  if (value == null || value === "") return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return normaliseText(value);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normaliseMoney(value) {
  if (value == null || value === "") return "0";
  return String(Math.round(Number(value) * 100));
}

function normaliseField(value, type) {
  switch (type) {
    case "date":  return normaliseDate(value);
    case "money": return normaliseMoney(value);
    default:      return normaliseText(value);
  }
}

export function canonicalise(employee) {
  return FIELDS.map(f => normaliseField(employee[f.key], f.type)).join("|");
}

export { FIELDS };
