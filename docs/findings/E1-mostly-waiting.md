# Finding — E1: what the mark vocabulary does when waiting is the rule, not the exception

**Status:** resolved by rendering both candidates in the reference renderer.
**Gate:** this was the item blocking Phase 03's token freeze. It is now closed.
**Test recipe:** `no-knead-bread` — 9 steps, 5 unattended, 1 hr 12 min hands-on against 18 hr of
walking away and 22 hr 32 min start to finish.
**Reproduce:** serve the repo, open `experiments/01-css-grid/`, pick `no-knead-bread`, and flip
the **marks** control.

## The problem, restated

Q5's mark vocabulary rests on "label the exception, not the default", and assumed the exception is
*unattended*. That holds for the brownies. It inverts for bread, braises, cold brew, yogurt and
most doughs — roughly 95% of a sourdough is waiting, so every step earns a clock and the accent
becomes the field.

EDGE-CASES E1 proposed making the rule **relative**: mark whichever class is in the minority, and
let the at-a-glance bar state the polarity. Both rules are now implemented and both were rendered.

## Answer

**Keep the vocabulary fixed. `◷` always means unattended.** The relative rule is rejected.

Carry the polarity in the legend and the summary bar instead — never in the glyph.

## Why — what the two renderings actually show

Under the **relative** rule the bread's marks come out as:

```
30m   ●1m ×3   12–18h   ●5m   60–120m   30m   15–20m
```

The 12–18 hour bulk ferment — the single most consequential fact in the recipe, the thing that
decides whether you can make this bread today — renders as plain quiet text, identical in weight
to the 1-minute folds beside it. The rule marked it as "the default", and the default gets no
emphasis. **It is styled as an aside.**

Under the **fixed** rule the same recipe gives:

```
◷30m   1m   ◷12–18h   5m   ◷60–120m   ◷30m   ◷15–20m
```

The ferment carries the glyph and the accent colour, and reads as the event it is.

The worry that motivated the relative rule — that the accent stops being an accent when it is the
majority — is real and visible: five of nine cells carry clay. But that is **true of the recipe**.
A bread chart in which most steps say "walk away" is an accurate bread chart. Muting them to
preserve the accent's scarcity would be optimising the palette at the expense of the content.

## The decisive argument is not aesthetic

A glyph whose meaning changes between recipes is a legend the reader must re-learn on every card,
and there is no moment at which they are told it flipped. EDGE-CASES anticipated exactly this
("needs verification that a flipped legend doesn't confuse someone moving between two recipes")
and the rendering makes it concrete: `●` means "needs you" on bread and would mean nothing at all
on the brownies, where the same steps carry `◷`.

That is a worse failure than a chart with a lot of clay on it. Frequency is a rendering problem;
ambiguous semantics is a comprehension problem.

## What ships instead

1. **`◷` = unattended, always.** Fixed across every recipe in the corpus.
2. **A legend line under the at-a-glance bar**, stating the count:
   *"◷ marks a step you can walk away from — 5 of 9 here."* This delivers what the relative rule
   was reaching for — the reader learns the polarity — without moving it into the glyph.
3. **An unmarked step still prints an authored duration**, just without the glyph. The number is
   information whether or not the step is the exception; the glyph is what marks the exception.
4. **A bare glyph with no number is suppressed for attended steps.** `●` on a 2-minute whisk that
   nobody timed says nothing a cook can act on. Unattended steps keep their glyph even without a
   duration, because "you can leave" is itself the information.

## Consequences

- **Q5's mark vocabulary is confirmed, not amended.** Its "label the exception" framing was right
  about the mechanism and wrong about which class is the exception — the exception is *unattended*
  by definition, not by frequency.
- **`EDGE-CASES.md` E1's proposed resolution is superseded.** The relative rule is implemented and
  kept behind a control so the comparison stays reproducible, but it is not the default and should
  not become one.
- **Phase 03's tokens are unblocked.** This was the only item gating them.

## Open

- Still not tested with anyone cooking. The claim that a fixed legend beats a flipped one is well
  grounded in the rendering but unvalidated with a reader — Phase 08.
- `passive` (EDGE-CASES E2) currently renders with the same `◷` as `long-unattended`. The bread's
  12–18 h ferment and its 30 min covered bake are both clocks, which understates the difference
  between "wait through the night" and "wait through a podcast". A distinct passive mark is
  proposed but not designed.
- The depth fill ramp is doing almost nothing on this chart: bread is a nine-deep chain, the ramp
  has five steps, and everything past depth 4 clamps to the flattest fill. R5's shading is built
  for wide, shallow convergence and degrades to nothing on a long chain. Worth revisiting before
  Phase 03 closes.
