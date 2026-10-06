# cc-quota-band

A Claude Code **mod** that keeps one line in the band above the prompt:

```
ctx 29.2k/200k (15%) · +19.2k last turn · week 36% · today +6% (pace 20) · 5h 12% · $3.10
```

- **ctx**: context tokens used out of the window;
- **last turn**: how much the context grew in the last turn;
- **week**: weekly quota used;
- **today**: how much of the weekly quota you spent today, measured from the first reading of the
  day (shared by all sessions via the mod store);
- **5h**: the 5-hour window;
- **$**: session cost, when Claude Code reports it.

The line is **green** while today's spend stays within the daily pace (20% of the week by
default). It turns **yellow** above the pace and **red** when the week reaches the reserve (85%
by default).

`/quota` prints the same line as text. That is the only part Claude reads. The band itself
costs no tokens, no turns and no extra process, because Claude Code pushes the numbers
(`session.measure`) after every turn.

The mod gives the band back when Claude Code shows a survey there, and keeps whatever other mods
draw in the band below its own line.

## Requirements

Claude Code 2.1.287 or later (mods). Tested on 2.1.292.

## Install

Copy this folder to `.claude/mods/cc-quota-band` in your project, or to `~/.claude/mods/` for all
projects, then restart Claude Code. Check it with:

```sh
claude plugin validate .claude/mods/cc-quota-band
```

## Settings

Edit the two constants at the top of `hooks/calc.js`:

| constant | default | meaning |
|---|---|---|
| `DAILY_PACE` | `20` | percent of the weekly quota per day; above it the band is yellow |
| `RESERVE` | `85` | weekly percent at which the band is red |

## Tests

```sh
claude plugin test .
```

Four tests cover the arithmetic (number format, day baseline, new day, weekly reset, the three
levels), `/quota`, the yellow band that keeps another mod's output, and stepping aside for a
survey. Negative control: raising the yellow threshold in `calc.js` makes 2 of the 4 tests fail.

## License

MIT, see [LICENSE](LICENSE).
