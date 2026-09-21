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
   margin, taxes and marketplace fees — and the sale price appears next to the
   cost, never on its own.

Keeping these two sums separate is what turns margin into a **conscious
choice**. When cost and sale price sit side by side, you decide whether to earn
more by raising the margin or by cutting a real cost.

## Three detail levels

Not every quote needs every section. That is why the calculator has three
levels, and each one reveals more sections:

- **Quick** — four sections: `material`, `print`, `sales` and `results`. Enough
  for a 30-second estimate.
- **Detailed** — adds the `failure` section, for anyone with a history of
  spoiled prints who wants to price it in.
- **Complete** — reveals all ten sections, including `hardware`, `machine`,
  `fixedCost`, `labor` and `ops`. Full control over every parameter.

The logic is gradual: the **Quick** level covers the path from filament to sale
price; **Detailed** turns on failure accounting; **Complete** opens the whole
spreadsheet.

**Switching levels never clears anything.** The fields you already filled in
stay right where they are — you only stop seeing the sections the current level
hides. Start on Quick to close a fast price, then level up when you need
precision.

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

sale price      = total cost + margin
                + taxes and marketplace fees
```

Note that `sales` is the only section that is **not a cost**: packaging and
shipping add to the total, but margin, taxes and fees are applied **on top** of
it. That is why the sale price grows differently from the cost — and why the
`results` section exists, to make that difference visible.

## A complete example

A decorative PLA part, 50 g, 5 hours of printing, 100% margin:

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
5. **Tune the `sales` section** — the margin is your declared profit. Move it up
   or down with the market; the sale price updates instantly.
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
