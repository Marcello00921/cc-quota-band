// cc-quota-band: the arithmetic, with nothing from Claude Code. Callers pass the numbers in.
// Kept out of register.js because an imported file cannot receive `$` (mod validation rule).

// Daily pace: share of the weekly quota you are fine spending per day. Above it, the band turns yellow.
export const DAILY_PACE = 20
// Reserve: weekly usage at or above this percentage turns the band red.
export const RESERVE = 85

// 19234 -> "19.2k"; 200000 -> "200k"
export function k(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '?'
  const a = Math.abs(n)
  if (a < 1000) return String(Math.round(n))
  const v = n / 1000
  return (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)) + 'k'
}

// Local date "YYYY-MM-DD" for a time in ms: the quota "day" is your day, not UTC.
export function localDay(ms) {
  const d = new Date(ms)
  const p = (x) => String(x).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// Day baseline = weekly % at the first reading of the day. It changes when the day changes or when the
// weekly window reset (the % dropped below the baseline). Returns the SAME object when nothing changes,
// so the caller knows it does not need to save.
export function nextBaseline(saved, day, pctNow) {
  if (!saved || typeof saved !== 'object' || saved.day !== day || typeof saved.pct !== 'number' || pctNow < saved.pct) {
    return { day, pct: pctNow }
  }
  return saved
}

// m: what session.measure / $.session.usage() deliver ({ context, rateLimits, cost }).
// delta: context growth in the last turn (or undefined). baseline: weekly % at the day's first reading.
export function reading(m, delta, baseline) {
  const ctx = (m && m.context) || {}
  const limits = (m && Array.isArray(m.rateLimits)) ? m.rateLimits : []
  const week = limits.find((r) => r && r.kind === 'seven_day')
  const five = limits.find((r) => r && r.kind === 'five_hour')
  const parts = []

  const pctCtx = typeof ctx.percent === 'number' ? ' (' + ctx.percent + '%)' : ''
  parts.push('ctx ' + k(ctx.tokens) + '/' + k(ctx.window) + pctCtx)
  if (typeof delta === 'number') parts.push((delta >= 0 ? '+' : '') + k(delta) + ' last turn')

  let today
  let level = 'no-quota'
  if (week) {
    parts.push('week ' + week.percentUsed + '%')
    if (typeof baseline === 'number') {
      today = Math.max(0, Math.round((week.percentUsed - baseline) * 10) / 10)
      parts.push('today +' + today + '% (pace ' + DAILY_PACE + ')')
    }
    level = week.percentUsed >= RESERVE ? 'red' : (typeof today === 'number' && today > DAILY_PACE ? 'yellow' : 'green')
  }
  if (five) parts.push('5h ' + five.percentUsed + '%')
  if (m && m.cost && typeof m.cost.usd === 'number') parts.push('$' + m.cost.usd.toFixed(2))

  return { line: parts.join(' · '), level, today, week: week ? week.percentUsed : undefined }
}

export function color(level) {
  return level === 'red' || level === 'yellow' || level === 'green' ? level : undefined
}
