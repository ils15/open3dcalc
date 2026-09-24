---
title: Calculator
order: 1
tourId: calc-basico
---

# Calculator

The **Calculator** is the core of Open3DCalc. It estimates the cost of a 3D print
from a handful of inputs and breaks the result down into **auditable sections**:
you see exactly how much each part contributes to the total, with no black boxes.

The philosophy is simple: **cost is a sum, not a guess**. Every number on the
screen has a traceable origin — a field you filled in and a known formula. If
the final price looks high, the calculator shows you which section is weighing
it down, instead of hiding the problem inside a lump "total".

## What it calculates

The calculator answers two separate questions, always in this order:

1. **How much does this part cost to exist?** It is the sum of everything you
   consume to produce it: material, power, machine wear, labor, failures and
   the workshop's fixed costs.
2. **How much should it sell for?** On top of the production cost you apply the
   markup, taxes and marketplace fees — and the sale price appears next to the
   cost, never on its own.

Keeping these two sums separate is what turns margin into a **conscious
choice**. When cost and sale price sit side by side, you decide whether to earn
more by raising the margin or by cutting a real cost.

## Available layouts

Beta 3 provides three implemented layouts for the same calculator:

- **Classic** — the full calculator, organized into sections, with navigation
  and a detail-level control at the top. This is the path for a complete view
  and for people who already know the workflow.
- **Guided** — a step-by-step sequence of questions for beginners and for mobile
  use. It guides the estimate without showing every section at once.
- **Bento Grid** — five cards arranged in a responsive grid. It is no longer a
  read-only dashboard: it is an editable calculator with the same fields as
  Classic, and its cards feed the real calculation.

The layout selector is in the header, and the app remembers the preference. Farm
is on the roadmap and is not available in this beta; there is no fourth layout
to use.

## Detail level: Quick, Detailed and Complete

The **Quick / Detailed / Complete** selector appears at the top of Classic and
Bento. It is the same component and the same state in both layouts: changing the
level in one immediately carries over to the other.

- **Quick** — shows `material`, `print`, `sales` and `results`, the shortest
  path to an estimate.
- **Detailed** — adds the `failure` section when you want to include losses and
  rework.
- **Complete** — unlocks all ten sections, including `hardware`, `machine`,
  `fixedCost`, `labor` and `ops`.

Visibility is governed by
`isFieldVisibleForLevel(calcLevel, hiddenFields, sectionId, fieldId)`. Classic
and Bento share this contract, and it also respects `hiddenFields`, so choices
about hidden fields are not discarded when you switch layouts.

**Changing levels never clears values.** Fields you have already filled stay
stored; only sections or fields hidden by the current level disappear. Start on
Quick and increase the detail when you need it.


## The map of the ten sections

Each section is an independent block that computes one part of the total. This
is what each one does:

- [**material**](#user-content-material) — how much filament or resin the part
  consumes, and what that costs.
- [**print**](#user-content-print-parameters) — the print time and the power the machine
  draws.
- [**failure**](#user-content-risk-and-failures) — failures and rework turned into cost,
  by percentage or fixed amount.
- [**hardware**](#user-content-hardware-wear) — wear on the nozzle, the build plate
  and the LCD (for resin).
- [**machine**](#user-content-machine-costs) — printer depreciation and maintenance,
  split across hours of use.
- [**fixedCost**](#user-content-fixed-costs) — rent, internet and baseline power,
  distributed over productive hours.
- [**labor**](#user-content-labor) — setup and post-processing time multiplied
  by your hourly rate.
- [**ops**](#user-content-operational--software) — PPE, the slicer license, the model file and
  other operational supplies.
- [**sales**](#user-content-additional-costs-and-sales) — packaging, shipping, taxes, marketplace
  fees and your margin: the section that builds the sale price.
- [**results**](#user-content-results) — consolidates everything and shows cost,
  profit and final price side by side.

All ten sections in this map have their own Wiki articles, with the full formula
and worked examples — just follow the links above. And the
[results](#user-content-results) section displays the sum of all of them side
by side.

## The master formula

Everything the calculator does fits in three lines. Production cost adds up the
consumption sections; total cost adds failures and logistics; and the sale price
applies margin and taxes on top of that base:

```
production cost = material + print + hardware + machine
                + fixedCost + labor + ops

total cost      = production + failure + packaging + shipping

sale price      = total cost + markup
                + taxes and marketplace fees
```

Note that `sales` is the only section that is **not a cost**: packaging and
shipping add to the total, but margin, taxes and fees are applied **on top** of
it. That is why the sale price grows differently from the cost — and why the
`results` section exists, to make that difference visible.

## Rules that prevent misleading numbers

### Real margin vs. markup

`profitMarginPercent` is a **markup on cost**, not the final profit percentage
on the sale price. For example, `110%` markup means the sale price must be
`2.10 ×` the cost: a cost of `$100.00` becomes `$210.00`, leaving `$110.00` of
gross profit.

**Real margin** is derived and read-only:

```
real margin = profit ÷ sale price × 100
```

In this example, `$110.00 ÷ $210.00 = 52.38%` real margin. Taxes and fees can
change the final price and therefore the net profit, so read real margin
together with the result.

The interface shows real margin in five places so the comparison stays visible.
Its tooltip says: **“Markup: profit over cost. Margin: profit over the price the
customer pays.”** See [Sales](#user-content-additional-costs-and-sales) and
[Results](#user-content-results) for the full formulas.

### A missing value is not zero

In beta 3, `$0.00` no longer means that the calculation finished at zero. A
non-finite value is displayed as `—`, never as a made-up amount.

This fixes a real failure: restoring an older calculation could leave
`energyCostPerKwh` absent. `NaN` then flowed through the calculation chain and
the screen showed `$0.00` as if it were a valid cost. The rule is now:

- **Missing data in a legacy snapshot:** the app uses its default for the missing
  field and tries to complete the calculation.
- **Corrupt or invalid data:** `NaN`, a negative value, the wrong type, or
  division by zero produces an explicit error with the exact field path.
- **A non-finite result:** the UI shows `—` and the invalid-calculation notice;
  it does not turn the problem into zero.

Validation runs before the calculation in seven paths: initial load,
`loadHistoryItem`, `undo`, `restoreAutoSnapshot`, `loadSharedCalculation`,
setters, and `setWithCompute`. Opening, undoing, restoring, sharing, or editing
a value therefore cannot silently turn a failure into zero.

If you see `—`, read the field name in the notice and correct that field. If the
problem came from history or a shared calculation, load a valid configuration or
fill in the missing value before using the result. Never replace an unknown
value with `0`: the price is not reliable while the error is present.

### Demonstration presets removed

The three demonstration presets — **Vase**, **GoPro Mount**, and **Statue** —
were removed. They supplied invented weights and print times; those values
belong to the model, not to the calculation workflow, so a preset must not
pretend to know the part.

Use **Demo Mode** when the goal is to see how the calculator works. Use
**History** when you want to load a real configuration.

### Multi-material is temporarily disabled

Multi-material support is disabled in this beta. The toggle remains visible but
unavailable, with text explaining that the complete model will arrive in its
own phase. The reason is concrete: slot costs replaced only `materialCost`;
`subtotal`, `totalCost`, `sellPrice`, and `profit` did not include that value,
which silently underestimated the sale price.

Do not use a partial multi-material value to close a quote. `fdmAmsSlots` is
preserved for that future phase, but it does not represent a complete cost model
today.

## Controls and presentation

Field customization now appears once, in the `FieldCustomizer` component. The
same control used to appear between two and four times in different sections.
`SectionHeader` is presentational only; it does not keep a second copy of the
state. Detail level and `hiddenFields` remain the single source of truth for
Classic and Bento.

The interface uses a self-hosted **Plus Jakarta Sans** WOFF2 file under the OFL
1.1 license. The Google-hosted font was blocked by CSP, so the app does not
depend on it to display the Wiki. `tokens.css` is the single source of visual
tokens, with matching semantic values for the light and dark themes.

The Wiki also preserves accessibility when moving between articles: the target
is scrolled to and focused before the next interaction. The fix uses
`useLayoutEffect` instead of `useEffect`, so focus is applied after the heading
has mounted.

## A complete example

A decorative PLA part, 50 g, 5 hours of printing, 100% markup:

```
material    50 g at R$ 125/kg (98% efficiency)  = R$  6.38
print       5 h at 250 W, R$ 0.80/kWh           = R$  1.00
machine + hardware + labor + ops (example)     = R$  3.00
                              production cost  = R$ 10.38
failure     10% rework                         = R$  1.04
packaging + shipping                           = R$  3.00
                                    total cost = R$ 14.42
margin      100% over total cost               = R$ 14.42
taxes + marketplace (25%)                      = R$  9.61
                              sale price       = R$ 38.45
```

The math behind the taxes is explained in the [sales](#user-content-additional-costs-and-sales)
article; what matters here is that every line traces back to a section. If the
customer finds it expensive, you know exactly where the R$ 14.42 of cost lives
and can act on it — instead of adjusting the price blindly.

## Workflow

The recommended path, from the first number to the final price:

1. **Pick the level** and the tab (FDM or resin). Start on Quick if you are in a
   hurry; the level never locks you out later.
2. **Fill the `material` section** with the type, cost per kg and part weight.
   If the filament is cataloged in the inventory, picking the spool fills the
   values automatically.
3. **Fill the `print` section** with the slicer's time, the printer's power draw
   and your cost per kWh.
4. **Check the `results` section** — it already shows a cost and a sale price
   with the default margin.
5. **Tune the `sales` section** — the markup is your declared profit over cost.
   Move it up or down with the market; the sale price updates instantly.
6. **Level up if needed** — enable `failure` to include losses, or go Complete
   to apportion machine, labor and fixed costs.
7. **Save or export** — the estimate becomes a product in the inventory or a
   quote line item, and the history keeps the numbers for the next part.

## Common pitfalls

Four mistakes surround anyone starting with the calculator, and all of them disguise themselves as haste.

- **Applying the margin without knowing the cost.** The sale price updates instantly when you
  move the percentage, which invites blind adjustments. Without `results` side by side, a 100%
  margin looks like 100% profit — and it is not.
- **Adding the margin and forgetting what goes on top.** Total cost plus margin is R$ 28.84 in
  the example; the sale price is R$ 38.45. The R$ 9.61 difference is taxes and the marketplace
  fee, applied on top of the total, and it is not profit.
- **Starting at the Complete level.** Quick covers the path from filament to sale price with
  four sections, and leveling up later erases nothing. Anyone opening all ten sections at once
  drowns in fields before closing a single price.
- **Treating `sales` as another cost.** Packaging and shipping add to the total; margin, taxes
  and fees are applied on top of it. Mixing up addition with application makes the price grow
  in the wrong proportion.

## Where to start

If you have never used the calculator, do this: open it on the **Quick** level,
fill in only `material` and `print`, and look at `results`. That is already an
honest quote. Most pricing mistakes do not happen because of missing sections —
they happen when the margin is applied without knowing the cost. Start with the
cost; leave the advanced sections for when they start affecting your wallet.
