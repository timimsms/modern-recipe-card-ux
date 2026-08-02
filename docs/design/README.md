# Design explorations

Self-contained HTML sources for the design studies referenced from
[`../planning/GAMEPLAN.md`](../planning/GAMEPLAN.md) and [`../findings/`](../findings/).

Each file is a single document with no external stylesheets, scripts, fonts, or images —
**open it directly in a browser**, no build step and no network required. They are also the exact
sources published as artifacts, so the published pages can be regenerated from these at any time.

| File | What it shows | Published |
| --- | --- | --- |
| [`q5-time-axis-variants.html`](q5-time-axis-variants.html) | Six treatments of step duration compared on the espresso brownies chart, with a missing-data matrix and a verdict. Resolved [Q5](../findings/Q5-time-axis.md). | [artifact](https://claude.ai/code/artifact/8bedd288-18af-4b9d-a25a-5e2bd0c7b47f) |
| [`resolved-card.html`](resolved-card.html) | **The current reference design.** In-cell duration bar plus attended/unattended split, the derived at-a-glance bar, and the shorthand mark vocabulary. Shown on espresso brownies and shepherd's pie. | [artifact](https://claude.ai/code/artifact/0e465102-73e3-4731-be14-60f22daa7df2) |

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
- **Every colour encoding is redundant** with hatch, weight, or label. Both files include a
  greyscale check for exactly this reason.

## Not committed here

Saved-page copies of the published artifacts (`sources/*.html` plus their `_files/` directories)
are gitignored. They are ~7× larger than these sources and add nothing these don't carry.
