# Phase 08 — Bake-off & Showcase

> Turn four implementations into a defensible recommendation.

## Goal

Measure the tracks against each other on axes that matter, publish a gallery where they can be
compared side by side on the same recipe, and write up what was actually learned — including
the parts that didn't work.

## Why here

Everything upstream exists to make this comparison valid: one model, one layout engine, one
corpus, one requirement set. This phase collects the payoff.

## Deliverables

### `packages/harness` — measurement

**Bundle & delivery**
- Total JS, CSS, and font bytes, gzipped and brotli'd.
- Bytes required for a *static, correct chart* versus bytes for the full interactive experience.
  Track 01 should be near zero on the first number, and that's a real result.
- Dependency count and transitive tree depth.

**Runtime performance** — throttled to a mid-tier Android profile, because that's the actual target
- First render of `shepherds-pie` (the widest chart in the corpus).
- INP on check-off — the most-used interaction.
- Update cost on a scale change, which touches every quantity cell at once. The sharpest
  discriminator between reactivity models.
- Cook-mode step transition, including the FLIP animation.
- Memory on the 25-ingredient `wide-shallow` fixture.

**Correctness & fidelity**
- Visual regression against Phase 03 baselines; report per-track pixel divergence with an
  explanation for each intentional difference.
- Corpus coverage: does every track handle every stress fixture, or are there silent gaps?

**Accessibility**
- Automated axe across all presentations.
- Manual screen-reader task scores from Phase 06's matrix — can a user answer the structural
  questions, per track?
- Keyboard task completion.

**Developer experience** — softer, still worth recording
- LOC for the renderer, excluding shared core.
- Store adapter size.
- Time-to-first-render when the track was built (from `NOTES.md`).
- Count and nature of core changes each track requested.
- Type-safety friction and build-time cost.

### Scorecards

One page per track: numbers, the `NOTES.md` narrative, and an honest "reach for this when…"
section. Numbers without context mislead — a track that's 40KB heavier but solves the
non-planar reuse case may be the right choice, and the scorecard should say so.

### Gallery app

- Every corpus recipe × every track, side by side, on one page.
- A live toggle across the Phase 02 column strategies so the **Q1** finding is demonstrable
  rather than merely asserted.
- Responsive ladder demonstrable at every breakpoint.
- Deployed as a static site. Practically: this is what makes the work shareable, and given that
  this format spreads as screenshots, the gallery should make it trivial to grab a good one.

### `docs/findings/`

The actual output of the project. One document per resolved question:

- **Q1** — column assignment: which strategy, with corpus evidence.
- **Q2** — does cook mode preserve parallelism honestly, or quietly relinearize?
- **Q3** — table versus grid substrate, from real screen-reader testing.
- **Q4** — was a DSL needed for authoring?
- **Q5** — does a duration-proportional time axis improve or destroy the format?
- **Reuse (I4)** — which of the three strategies works best, and does the SVG connector justify itself?
- **R8 retrospective** — did the mobile problem actually get solved? Answered against the
  acceptance criterion from Phase 04: cook Shepherd's pie on a phone with zero pinch-zoom.
- **The recommendation** — which stack for which situation, stated plainly.

### Retrospective on the source critique

Return to the table in `GAMEPLAN.md` §2.2 and answer, requirement by requirement, whether R1–R9
were resolved — with a before/after against the specific screenshot that raised each one.
This closes the loop on the audit the Threads commenters ran for free, and it's the most direct
evidence that the project did what it set out to do.

## Technical notes

**Measure on real hardware where possible.** Throttled desktop Chrome is a proxy, not a phone.
At minimum, spot-check the mid-tier Android numbers on an actual device.

**Report variance, not just medians.** A track with a good median and a bad p95 is worse in a
kitchen than the numbers suggest.

**Publish negative results.** If the SVG track's text handling is bad enough to disqualify it,
that's a more useful finding than a hedge. If shadcn's primitives don't help with a 2D grid,
say so directly.

## Acceptance criteria

- [ ] Harness runs in CI and produces a reproducible scorecard per track.
- [ ] Every axis above measured for all four tracks.
- [ ] Gallery deployed, all recipes × all tracks, with the column-strategy toggle live.
- [ ] Every question Q1–Q5 answered in `docs/findings/` with evidence, not opinion.
- [ ] R1–R9 retrospective complete with before/after against the source screenshots.
- [ ] A stated, defended recommendation.
- [ ] At least one negative result published.

## Out of scope

Productionizing a winner. This is a lab; the deliverable is knowledge and a gallery, not a
shipping recipe app.

## Open questions

- Should the gallery include the original CFE rendering as a control, so the comparison is
  against the real baseline rather than only between our variants? Strongly leaning yes —
  the whole project is a response to it. Reimplement it faithfully from the captured markup
  rather than iframing the live site.
- Is there value in putting the cook mode in front of actual people cooking actual food? Five
  users would produce more signal than every number in the harness. The wet-hands, hot-pan
  failure modes are not discoverable at a desk.
