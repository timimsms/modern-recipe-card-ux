# Q6 — the ladder has to go down as well as up

**Acceptance criterion:** scaling `espresso-brownies` to 2× and 0.5× "produces quantities a cook
would actually write, verified against a hand-computed table."

The verification was the point. Doing it by hand found an error that 21 passing tests had not.

## The table

| ingredient  | as written      | 2×                 | 0.5×                    |
| ----------- | --------------- | ------------------ | ----------------------- |
| butter      | 4 oz / 115 g    | ½ lb / 230 g       | 2 oz / 60 g             |
| sugar       | 1 cup / 200 g   | 2 cup / 400 g      | ½ cup / 100 g           |
| vanilla     | ¼ tsp / 2½ mL   | ½ tsp / 5 mL       | ⅛ tsp / 1.3 mL          |
| espresso    | 4 Tbs / 60 mL   | ½ cup / 120 mL     | 2 Tbs / 30 mL           |
| eggs        | 2 / 100 g       | 4 / 200 g          | 1 / 50 g                |
| flour       | ½ cup / 80 g    | 1 cup / 160 g      | ¼ cup / 40 g            |
| cocoa       | ⅓ cup / 80 g    | ⅔ cup / 160 g      | **2 Tbs + 2 tsp / 40 g** |
| baking soda | ¼ tsp / 1.3 g   | ½ tsp / 3 g        | ⅛ tsp / 0.7 g           |
| salt        | ¼ tsp / 1½ g    | ½ tsp / 3 g        | ⅛ tsp / 0.8 g           |

Every row is now checkable by eye. Two are worth pointing at.

**`4 oz → ½ lb`, `4 Tbs → ½ cup`.** The climb rule earns its keep here: `8 Tbs` is arithmetically
identical to `½ cup` and describes eight scoops instead of one.

**`⅓ cup` halved is `2 Tbs + 2 tsp`.** This is the row that was wrong.

## The bug

The ladder only ever climbed. Halving `⅓ cup` gave `⅙ cup`, which is not a fraction any scoop
measures, so it snapped to the nearest one that is: `⅛ cup`.

That is 25% short. Worse, it contradicted the column beside it — the metric pair scaled correctly
to 40 g, which is ⅙ of a cup, not ⅛. **Two columns disagreeing is worse than either being wrong
alone**, because the reader who notices cannot tell which to trust, and the reader who does not
notice is following whichever their eye landed on.

It also violated the rule the module was written around: a lie in a quantity is worse than an
omission, because it gets measured out.

## The fix

A rung that cannot say the number hands it down one. Two ways a rung fails:

- **the fraction is not measurable at this rung** — ⅙ of a cup;
- **the rung has no fractions at all** — there is no ⅔ tablespoon.

Either way the answer is one rung down: ⅙ cup → 2.67 Tbs → `2 Tbs + 2 tsp`. Both are exact.

`tsp` is marked measurable-in-parts (¼ and ½ teaspoon spoons exist) and `Tbs` is not, which is
what keeps `4½ tsp` rendering as `1 Tbs + 1½ tsp` rather than `1½ Tbs`.

The rule pays off past the corpus too: at an arbitrary 2.75×, flour goes to `1 cup + 6 Tbs`,
exact, where the snap-to-nearest answer was `1⅓ cup`.

## What this says about the tests

There were 21 passing scale tests before the hand check, including three the phase document named
specifically. All of them tested cases someone had thought of. The table tested every ingredient
in one recipe at two factors — undiscriminating, and that is why it found something.

Same shape as [P02](P02-parallel-saving.md) and [Q2](Q2-cook-mode-honesty.md): the corpus keeps
answering questions the unit tests were not asking. Worth preferring, where it is cheap, a check
that sweeps everything over a check that probes what you already suspect.
