# I5 — recipe state cannot be keyed by bare ids

**Found by:** wiring the store into track 01, then checking a two-component recipe rather than
assuming the one-component case generalised.

## The bug

Step and ingredient ids are unique *within a component*. Nothing in the model ever promised more,
and the corpus exercises the gap:

```
shepherds-pie.json  steps        COLLIDES: season → mashed-potatoes, shepherds-pie
shepherds-pie.json  ingredients  COLLIDES: salt   → mashed-potatoes, shepherds-pie
```

Cook state was a flat `Set` of ids — first as `{ ingredients, steps }` in the track, then, when it
moved to core, as `CookState.completedSteps`. So:

- salting the mashed potatoes ticked the pie's salt off the shopping list too;
- marking one `season` done marked the other, and the card reported the cook two steps further
  along than they were;
- the progress bar and mini-map inherited the error, since both count completed steps.

It also reached the **zero-JavaScript path**. The `:has()` rules that propagate check-off are
generated per ingredient id:

```css
.card:has(.tick[data-ing="salt"]:checked) [data-row="salt"]{opacity:.5}
```

which dims both salt rows in different components — a wrong answer with no script running at all.

## Why it survived so long

Eight of nine corpus recipes have exactly one component, and every unit test to that point had
built a single-component fixture. The one recipe that could show the bug was the one nobody had
checked state against. This is the same shape as the `duplicate-leaf` bug in Phase 03: an
acceptance criterion that looked met because only the easy case had been exercised.

## The fix

`CookState` holds qualified keys — `stepKey(component, id)` → `mashed-potatoes/season` — and the
bare id never appears in it. `cook.ts` keeps speaking in bare ids, because it only ever sees one
component and is right to; `completedIn(component, state)` and `checkedIn(component, state)` are
the translation at the boundary, so no track hand-rolls it. `data-ing`, `data-row` and
`data-fed-by` carry the qualified key too, which fixes the CSS path.

The rejected alternative was requiring globally unique ids in the corpus files. That pushes a
storage detail onto the authoring format — [Q4](Q4-authoring-ergonomics.md) is about keeping that
format writable — and it would break again silently the first time an author wrote two components
that both `reduce`.

## Consequence for the bake-off

This is now structural rather than conventional: a track *cannot* key state by a bare id, because
the store's API does not accept one. Tracks 02–04 inherit the fix by inheriting the store.
