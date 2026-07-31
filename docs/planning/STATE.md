# Project state — handoff

> Read this first after a context clear. Current as of the close of the planning session.
> Nothing has been built yet; everything below is decided-and-documented, not implemented.

## Where things stand

**Planning is complete.** `GAMEPLAN.md` plus nine phase files in `phases/`. Two design questions
have been explored visually and resolved; the rest are captured as ready-to-run prompts.

**No code exists.** The repo contains `docs/`, `images/` (source screenshots), and `sources/`
(webloc files). Phase 00 — the monorepo scaffold — has not been started.

## What's decided

| Decision | Where | Confidence |
| --- | --- | --- |
| Tree-first model; geometry derived, never reverse-engineered | `GAMEPLAN.md` §2.1 | High — the source markup has no tree in it |
| Monorepo: pure `core` + four renderer tracks, no forking allowed | `GAMEPLAN.md` §6 | High — user-chosen |
| Desktop wall-chart and mobile cook mode as peers | `phases/PHASE-04` | High — user-chosen |
| Width cannot encode duration; time goes in-cell as a glyph | `findings/Q5-time-axis.md` | High — structural argument, not taste |
| `Effort` bucket (`quick`/`minutes`/`long-unattended`) required; precise `duration` optional | `phases/PHASE-01` | High |
| At-a-glance bar, fully derived from `GridPlan.timing` | `phases/PHASE-03` | High |
| Shorthand marks: `● 2m` / `◷ 30–40m`; label the exception, not the default | `phases/PHASE-03` | **Medium — see EDGE-CASES E1** |

## Resolved artifacts

- **Q5 six-variant comparison** — https://claude.ai/code/artifact/8bedd288-18af-4b9d-a25a-5e2bd0c7b47f
- **Resolved card (current design)** — https://claude.ai/code/artifact/0e465102-73e3-4731-be14-60f22daa7df2

The second is the visual reference Phase 03 builds against. Both are private artifacts owned by
the user; `WebFetch` can read them back if the design details are needed and this doc isn't enough.

## Open questions, in priority order

1. **Q1 — column assignment** (left-packed / right-packed / stretch-to-merge).
   Prompt ready at `prompts/Q1-column-assignment-showcase.md`, **not yet run.**
   **Blocks Phase 02** — it determines the shape of `GridPlan`. Run before writing layout code.
2. **I4 — ingredient/step reuse** (five strategies).
   Prompt ready at `prompts/I4-ingredient-reuse-showcase.md`, **not yet run.**
   Also feeds Phase 02, and decides whether the SVG track has a reason to exist.
3. **E1 — mostly-waiting recipes** (see `EDGE-CASES.md`). Cheap to check, could invalidate the
   mark vocabulary that's about to be baked into tokens.
4. **Q3 — table vs. CSS Grid substrate.** Deferred to Phase 06 by design; needs real screen readers.
5. **Q4 — is raw JSON authoring tolerable?** Answered empirically during Phase 01 transcription.

## Recommended next action

Start **Phase 00** (scaffold) and **Phase 01** (model + corpus) — they're independent of the open
questions above. While transcribing the corpus, add the three recipes named in `EDGE-CASES.md`.

Then run the Q1 and I4 prompts *before* Phase 02, because both change `GridPlan`'s shape.

## Things a future session should not re-derive

- The CFE source markup is decoded in `GAMEPLAN.md` §2.1, including the live DOM sample. The site
  returns **403 to WebFetch and curl**; it was read via the Chrome browser tool. Don't retry curl.
- The Threads critique → requirements mapping (R1–R9) is in `GAMEPLAN.md` §2.2, with each row
  citing the specific screenshot in `images/`. The images don't need re-reading.
- Q5's answer and its reasoning are settled. Don't re-litigate the time axis.

## User preferences observed this session

- No timelines, week numbers, or date anchors in planning docs (global instruction).
- Prefers seeing options rendered visually over described in prose — the two artifacts changed
  decisions that prose had not.
- Wants failure modes shown honestly rather than smoothed over.
