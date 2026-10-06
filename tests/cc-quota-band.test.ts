import { expect, mock, test } from 'claude-code/testing'
import { k, reading, nextBaseline, DAILY_PACE, RESERVE } from '../hooks/calc.js'

// October 1st 2026, 10:00 local time
const DAY1 = new Date(2026, 9, 1, 10, 0, 0).getTime()

const measure = (tokens: number, week: number, five = 12) => ({
  context: { tokens, window: 200000, percent: Math.round((tokens / 200000) * 100) },
  rateLimits: [
    { kind: 'five_hour', percentUsed: five },
    { kind: 'seven_day', percentUsed: week },
  ],
  cost: { usd: 3.1 },
})

const BAND_PROPS = { isWorking: false, maxRows: 4, bodyColumns: 118, scroll: { offset: 0, bodyRows: 4 }, view: {} }

test('arithmetic: k, day baseline and the three levels', async () => {
  expect(k(19234)).toBe('19.2k')
  expect(k(200000)).toBe('200k')
  const b = nextBaseline(undefined, '2026-10-01', 30)
  expect(b).toEqual({ day: '2026-10-01', pct: 30 })
  expect(nextBaseline(b, '2026-10-01', 40)).toBe(b) // same day: baseline stays
  expect(nextBaseline(b, '2026-10-02', 40)).toEqual({ day: '2026-10-02', pct: 40 }) // new day
  expect(nextBaseline(b, '2026-10-01', 2)).toEqual({ day: '2026-10-01', pct: 2 }) // weekly window reset
  expect(reading(measure(19234, 40), 19234, 30).level).toBe('green') // +10 today
  expect(reading(measure(19234, 30 + DAILY_PACE + 1), 0, 30).level).toBe('yellow') // above the pace
  expect(reading(measure(19234, RESERVE), 0, RESERVE).level).toBe('red') // reserve reached
  expect(reading({ context: { tokens: 1, window: 2 }, rateLimits: [] }, undefined, undefined).level).toBe('no-quota')
})

test('/quota adds the last turn and today since the first reading', async ($, on) => {
  mock.clock(on, { now: DAY1 })
  const saved = new Map<string, unknown>()
  on('store.get', ($, e) => ({ value: saved.get(e.key) }))
  on('store.set', ($, e) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('session.usage', () => ({ value: measure(10000, 30) }) as any)
  on('command.register', () => ({ value: undefined }) as any)
  on('session.start', () => ({ cwd: '/work' }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.invalidate', () => ({ value: undefined }))

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.session.measure({ ...measure(29234, 36), changed: ['context', 'rateLimits'] })

  const r = await $.command.run({ command: 'quota', args: '' } as any)
  expect(r.text).toContain('ctx 29.2k/200k (15%)')
  expect(r.text).toContain('+19.2k last turn')
  expect(r.text).toContain('week 36%')
  expect(r.text).toContain('today +6% (pace 20)')
  expect(r.text).toContain('· green')
  expect(saved.get('baseline')).toEqual({ day: '2026-10-01', pct: 30 })
})

test('the band turns yellow above the daily pace and keeps what another mod drew', async ($, on) => {
  mock.clock(on, { now: DAY1 })
  on('store.get', () => ({ value: { day: '2026-10-01', pct: 10 } }))
  on('store.set', () => ({ value: undefined }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['from another mod'] }))

  await $.session.measure({ ...measure(50000, 35), changed: ['rateLimits'] })
  const ui = await $.ui.mount({
    plugin: 'cc-quota-band',
    component: 'AbovePrompt',
    surface: 'terminal',
    viewport: { columns: 120, rows: 40 },
    props: { hasSurvey: false, ...BAND_PROPS },
  })
  const line = await ui.find({ type: 'Text', text: /week 35% · today \+25% \(pace 20\)/ })
  expect(line).toBeDefined()
  expect(line!.props.color).toBe('yellow')
  expect(await ui.find({ type: 'Text', text: 'from another mod' })).toBeDefined()
  await ui.unmount()
})

test('with a Claude Code survey in the band, the mod steps aside', async ($, on) => {
  mock.clock(on, { now: DAY1 })
  on('store.get', () => ({ value: { day: '2026-10-01', pct: 10 } }))
  on('store.set', () => ({ value: undefined }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['survey'] }))
  await $.session.measure({ ...measure(50000, 35), changed: ['rateLimits'] })
  const ui = await $.ui.mount({ plugin: 'cc-quota-band', component: 'AbovePrompt', surface: 'terminal',
    viewport: { columns: 120, rows: 40 }, props: { hasSurvey: true, ...BAND_PROPS } })
  expect(await ui.find({ type: 'Text', text: /week 35%/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'survey' })).toBeDefined()
})
