/**
 * CSV, written so a spreadsheet reads it back as it was: every field quoted
 * when it needs to be, dates as ISO, and a cell that starts like a formula
 * (= + - @) defused with a leading apostrophe, since visitors' search words
 * and referrers end up in these files and a spreadsheet would run them.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Record<string, unknown>[], cols = rows[0] ? Object.keys(rows[0]) : []): string {
  return '﻿' + [cols.map(csvCell).join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n'
}
