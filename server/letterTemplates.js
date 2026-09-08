// Letter body templates. Mirror the four formats from the sample letters
// provided by the Ministry. Output is an array of paragraph strings — the
// PDF generator wraps these into the formal letter layout.

const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n) {
  let s = "";
  if (n >= 100) { s += ones[Math.floor(n / 100)] + " hundred"; n %= 100; if (n) s += " and "; }
  if (n >= 20) { s += tens[Math.floor(n / 10)]; n %= 10; if (n) s += "-" + ones[n]; }
  else if (n > 0) { s += ones[n]; }
  return s;
}
function intToWords(n) {
  if (n === 0) return "zero";
  const parts = []; const scales = ["", "thousand", "million", "billion"]; let i = 0;
  while (n > 0) {
    const c = n % 1000;
    if (c) parts.unshift(under1000(c) + (scales[i] ? " " + scales[i] : ""));
    n = Math.floor(n / 1000); i++;
  }
  return parts.join(", ");
}
export function moneyToWords(value) {
  if (value == null || isNaN(value)) return "";
  const v = Math.round(Number(value) * 100);
  const dollars = Math.floor(v / 100), cents = v % 100;
  let s = intToWords(dollars) + " Barbados dollar" + (dollars === 1 ? "" : "s");
  if (cents > 0) s += " and " + intToWords(cents) + " cent" + (cents === 1 ? "" : "s");
  return s;
}
export function moneyFormatted(value) {
  const v = Number(value || 0);
  return "BDS $" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatLongDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function buildLetterBody(employee) {
  const fullName = [employee.title, employee.firstName, employee.lastName].filter(Boolean).join(" ");
  const titleLast = [employee.title, employee.lastName].filter(Boolean).join(" ");
  const nameAndAddress = employee.address ? `${fullName} of ${employee.address}` : fullName;
  const salaryWords = moneyToWords(employee.monthlySalary);
  const salaryFig = moneyFormatted(employee.monthlySalary);
  const startDate = formatLongDate(employee.appointmentDate);

  switch (employee.letterType) {
    case "teacher_appointed": {
      return [
        `This is to certify that ${fullName}, ${employee.post}, ${employee.school}, has been employed with the Ministry of Education Transformation with effect from ${startDate} to the present date and holds a permanent and pensionable post.`,
        `${titleLast} is currently receiving a monthly salary of ${salaryWords} (${salaryFig}).`,
        `Grateful if the usual courtesies are extended to ${titleLast}.`,
      ];
    }
    case "teacher_special": {
      const allowWords = moneyToWords(employee.monthlyAllowance);
      const allowFig = moneyFormatted(employee.monthlyAllowance);
      return [
        `This is to certify that ${fullName}, ${employee.post}, ${employee.school}, has been employed with the Ministry of Education Transformation with effect from ${startDate} to the present date and holds a permanent and pensionable post.`,
        `${titleLast} is currently receiving a monthly salary of ${salaryWords} (${salaryFig}) and a monthly allowance of ${allowWords} (${allowFig}).`,
        `Grateful if the usual courtesies are extended to ${titleLast}.`,
      ];
    }
    case "ministry_permanent": {
      return [
        `This is to certify that ${nameAndAddress} has been continuously employed in the Public Service with effect from ${startDate}.`,
        `${fullName} holds the permanent and pensionable post of ${employee.post}, Ministry of Education Transformation.`,
        `${titleLast} receives a monthly salary at the rate of ${salaryWords} (${salaryFig}).`,
        `Any courtesies extended to ${fullName} would be appreciated.`,
      ];
    }
    case "teacher_temporary": {
      return [
        `This is to certify that ${nameAndAddress} has been continuously employed in the Public Service with effect from ${startDate}.`,
        `${fullName} is temporarily employed in the post of ${employee.post}, Ministry of Education Transformation.`,
        `${titleLast} receives a monthly salary at the rate of ${salaryWords} (${salaryFig}).`,
        `Any courtesies extended to ${fullName} would be appreciated.`,
      ];
    }
    case "ministry_temporary": {
      return [
        `This is to certify that ${nameAndAddress} has been continuously employed in the Public Service with effect from ${startDate}.`,
        `${fullName} is temporarily employed in the post of ${employee.post}, Ministry of Education Transformation.`,
        `${titleLast} receives a monthly salary at the rate of ${salaryWords} (${salaryFig}).`,
        `Any courtesies extended to ${fullName} would be appreciated.`,
      ];
    }
    default:
      throw new Error("Unknown letter type: " + employee.letterType);
  }
}

// HTML preview of the letter body (used on the letter-ready page).
function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
