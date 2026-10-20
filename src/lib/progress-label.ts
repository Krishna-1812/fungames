/** Preserve the numeric ranking while giving exploratory progress its own meaning. */
export function progressText(slug: string, value: number, text: string): string {
  if (!Number.isFinite(value) || value < 0) return text
  if (slug === 'spend-it') return `Spent $${Math.round(value).toLocaleString('en-US')}`
  if (slug === 'deep-time') return `${(Math.min(10000, value) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}% explored`
  return text
}

export function progressSummary(slug: string, value: number, text: string): string {
  const label = progressText(slug, value, text)
  return slug === 'spend-it' || slug === 'deep-time' ? label : `Best ${label}`
}
