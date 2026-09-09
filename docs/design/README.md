# Design explorations

Self-contained HTML sources for the design studies referenced from
[`../planning/GAMEPLAN.md`](../planning/GAMEPLAN.md) and [`../findings/`](../findings/).

Each file is a single document with no external stylesheets, scripts, fonts, or images —
**open it directly in a browser**, no build step and no network required.

| File | What it shows |
| --- | --- |
| [`q5-time-axis-variants.html`](q5-time-axis-variants.html) | Six treatments of step duration compared on the espresso brownies chart, with a missing-data matrix and a verdict. Resolved [Q5](../findings/Q5-time-axis.md). |
| [`resolved-card.html`](resolved-card.html) | **The current reference design.** In-cell duration bar plus attended/unattended split, the derived at-a-glance bar, and the shorthand mark vocabulary. Shown on espresso brownies and shepherd's pie. |
| [`q1-column-assignment.html`](q1-column-assignment.html) | Left-packed, right-packed and stretch-to-merge rendered from one layout function, with live-measured widths and a filler-reveal toggle. Resolved [Q1](../findings/Q1-column-assignment.md). |
| [`i4-ingredient-reuse.html`](i4-ingredient-reuse.html) | Five reuse strategies × two cases (node reuse, leaf reuse), judged on kitchen safety first. Resolved [I4](../findings/I4-reuse.md). |

`resolved-card.html` is the visual target for **Phase 03**. Where this file and the phase docs
disagree, the phase docs win — these are explorations, not specifications.

## Conventions worth preserving

Both files already implement decisions the real renderer inherits, so they double as a working
reference for Phase 03:

- **Regions are separated by a 2px grid gap and carry their own borders.** Stray vertical rules
  (requirement R1, the most common complaint about the original format) become structurally
  impossible rather than something to suppress with filler cells.
- **Step text is anchored bottom-right** within its region (R2), so the eye follows a predictable
  diagonal instead of hunting.
- **Theme tokens are defined three times** — `:root`, `@media (prefers-color-scheme: dark)`, and
  `:root[data-theme="…"]` — so a viewer's explicit toggle beats the OS preference in both
  directions.
- **Every colour encoding is redundant** with hatch, weight, or label. Several of these files carry a
  greyscale check for exactly this reason.
- **`<meta charset="utf-8">` on the first line.** Without it these render as mojibake when opened
  from disk, which is the whole point of committing them. Added while building the Q1 study;
  the two earlier files predate it.
- **Never measure in `requestAnimationFrame`.** It does not fire in a background tab, so any figure
  computed there silently stays blank. Read `scrollWidth` synchronously instead — it forces layout
  and the number is real.

## Not committed here

Saved-page copies of the published artifacts (`sources/*.html` plus their `_files/` directories)
are gitignored. They are ~7× larger than these sources and add nothing these don't carry.
