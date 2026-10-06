// cc-quota-band: context used, last-turn growth, weekly quota and today's spend, in the band above the prompt.
// Claude Code already delivers the numbers (`session.measure` / `$.session.usage()`): no process, no turn,
// no tokens in the context. The band sends nothing to Claude; only /quota answers with text Claude reads.
import { reading, nextBaseline, localDay, color } from './calc.js'

let last = null      // last measurement ({ context, rateLimits, cost })
let delta            // context growth in the last turn
let baseline         // weekly % at the day's first reading (from $.store, shared by all sessions)

async function keep($, m, changed) {
  if (!m) return
  const before = last && last.context ? last.context.tokens : undefined
  const now = m.context ? m.context.tokens : undefined
  const contextMoved = !Array.isArray(changed) || changed.includes('context')
  if (contextMoved && typeof before === 'number' && typeof now === 'number' && now !== before) delta = now - before
  last = m
  const week = (Array.isArray(m.rateLimits) ? m.rateLimits : []).find((r) => r && r.kind === 'seven_day')
  if (week) {
    const day = localDay(await $.clock.now())
    const saved = await $.store.get('baseline')
    const nb = nextBaseline(saved, day, week.percentUsed)
    if (nb !== saved) await $.store.set('baseline', nb)
    baseline = nb.pct
  }
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await keep($, await $.session.usage())
    await $.command.register({
      name: 'quota',
      description: 'Context, last turn and weekly quota against your daily pace',
      immediate: true,
    })
    return next(e)
  })

  // Pushed by Claude Code after every turn and when the quota moves one point: free.
  on('session.measure', async ($, e, next) => {
    await keep($, e, e.changed)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('command.run', { command: 'quota' }, async ($) => {
    if (!last) return { text: 'cc-quota-band: no measurement yet in this session' }
    const r = reading(last, delta, baseline)
    return { text: r.line + ' · ' + r.level }
  })

  // One line in the band above the prompt; whatever other mods draw there stays below it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // A Claude Code survey wants the band: hand it over.
    if (e.props && e.props.hasSurvey) return next(e)
    const rest = await next(e)
    if (!last) return rest
    const { Box, Text } = $.ui.resolve(e)
    const r = reading(last, delta, baseline)
    const c = color(r.level)
    const props = { wrap: 'truncate-end', children: [r.line] }
    if (c) props.color = c
    const mine = Text(props)
    return rest ? Box({ flexDirection: 'column', children: [mine, rest] }) : mine
  })
}
