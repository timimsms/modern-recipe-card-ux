# M1 — the visual baselines were measuring the harness, twice

Phase 08 scores tracks 02–04 on how closely they reproduce track 01, so these 25 baselines are
what "reproduce it" means. Twice now they have moved for reasons that had nothing to do with the
design, and the second time is more interesting than the first.

## First time: the bar was painted into the image

The control bar is `position: sticky`, and a card is usually taller than the viewport. When
Playwright scrolls to stitch a tall element it takes the sticky bar along, so the harness was
painted over the card. Adding one `<select>` churned every image by ~1% of its pixels.

Fixed by unsticking the bar for the duration of the screenshot. The visible symptom went away.

## Second time: one pixel, and nothing had changed

Adding a `servings` control, a `units` control and two buttons churned **12 of 25 baselines by
exactly one pixel of height** — and only 12, which is what made it worth chasing rather than
re-recording.

The card markup was byte-identical. Rendering the same fixture through the old and new renderer
in Node and diffing tag by tag produced only the deliberate `data-ing` rename. Deleting every new
CSS rule from the live stylesheet changed the card's measured height not at all. Bisecting the
stylesheet then gave an answer that made no sense on its face: adding `.controls button {…}` — a
rule that matches nothing inside the card — moved the baselines.

The mechanism:

- the degenerate card is **269.953125px** tall;
- where a fractional box lands on the pixel grid depends on its **top offset**;
- styling the buttons made the control bar a fraction taller, moving the card down;
- 269.95px starting at an integer offset rasterises to 270px, and starting at a half-pixel offset
  rasterises to 271px.

Twelve cards happened to sit near a rounding boundary. Thirteen did not. Nothing about the design
changed in either group.

## The fix, and why it is not "re-record and move on"

The bar is now `display: none` for every screenshot, not merely unstuck — so the card sits at a
fixed offset and the baselines cannot notice a control being added. All 25 were regenerated once.

The distinction worth keeping: a baseline that moves when the harness changes is not a strict
test, it is a **noisy** one, and a noisy test gets its diffs approved without being read. That is
the failure mode that matters here, because in Phase 08 these images are the scoring rubric. The
first fix removed the symptom and left the coupling; this one removes the coupling.

## The general rule

An instrument that shares layout with the thing it measures will eventually measure itself. Three
of this project's wrong answers now have that shape:

- the print check compared the chart against the *card* inside a 1400px window and passed 6/6 on
  output whose first page was blank;
- the greyscale contrast probe parsed `color(srgb …)` with a digit regex and reported a ratio of
  ten million;
- these baselines rounded the harness's height into the design's.

In each case the measurement was wrong in a way that looked like a pass. Worth the reflex: when a
check reports success, ask what it would have looked like had it failed.
