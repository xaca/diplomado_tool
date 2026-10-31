// CSV for spreadsheets (M18). Semicolon-separated with a UTF-8 BOM: Excel with Spanish
// (Colombian) regional settings opens it in columns with accents intact; Google Sheets detects it.

const SEPARATOR = ';'

function cell(value: string | number | null | undefined) {
  let text = value == null ? '' : String(value)
  // A cell starting with = + - @ would run as a formula in a spreadsheet (CSV injection)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return `\uFEFF${rows.map((row) => row.map(cell).join(SEPARATOR)).join('\r\n')}\r\n`
}
