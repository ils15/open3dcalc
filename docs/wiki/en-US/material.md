---
title: Material
order: 10
---

# Material

The **material** section calculates how much filament or resin the part consumes
and converts that into money. It is the calculator's first section and, in most
prints, the heaviest line in the final cost — which also makes it the first
place where a wrong assumption becomes a wrong price.

The core idea is to keep two things apart: **what the part weighs** and **what
you actually paid for the material**. A 50 g part printed from a R$ 125/kg spool
does not cost R$ 6.25 — because the spool is never used whole, purge wastes
plastic, and resin stays in the vat. The material section folds those losses
into the math instead of pretending they do not exist.

## FDM: weight, price and efficiency

For filament printing, the basic fields are:

- **Material type** — PLA, PETG, ABS and others. Sets the density used in volume
  conversions and the suggested price points.
- **Cost per kg** — the average price per kilo. For reference: PLA runs around
  R$ 90, PETG R$ 110 and ABS R$ 100.
- **Weight used** — how many grams the part consumes, per the slicer.

The basic formula is straightforward: weight converted to kilos times the price
per kilo.

```
material cost = (weight used / 1000) * cost per kg
```

A 50 g part in PLA at R$ 125/kg costs `(50/1000) * 125 = R$ 6.25`. That is the
**theoretical** cost, with no losses — and it is rarely the real one.

## The fields everyone forgets

Moving up to the **Detailed** level reveals four fields that close the gap
between theory and the actual print:

- **Purge / loss** — the grams wasted in the purge tower or on color changes. On
  multicolor prints it can be larger than the part itself.
- **Spool efficiency** — nobody uses 100% of a spool: leftover tails and
  changes reduce the yield. The suggested default is 95–98%.
- **Density** — used to convert volume into weight. PLA ≈ 1.24, PETG ≈ 1.27,
  ABS ≈ 1.04 g/cm³.
- **Waste margin** — applied to resin, covers what stays in the vat, in the
  supports and in cleaning. Suggested: 5–10%.

Purge and efficiency affect cost differently. **Purge** is extra weight that
goes in the trash; **efficiency** is a factor that dilutes the price of every
gram you consume. The full formula applies both:

```
total weight      = weight used + purge
effective weight  = total weight * (100 / spool efficiency)
material cost     = (effective weight / 1000) * cost per kg
```

Note the division: at 98% efficiency the factor is `100/98 ≈ 1.02` — you pay
about 2% more for every gram, because part of the spool went in the trash. It is
little per part, and a lot per year.

## A full numeric example

A PLA part weighing 50 g, with an 8 g purge tower, 98% efficiency and R$ 125/kg:

```
total weight      = 50 + 8        = 58 g
factor            = 100 / 98      = 1.0204
effective weight  = 58 * 1.0204   = 59.18 g
material cost     = 0.05918 * 125 = R$ 7.40
```

Without those fields the math would say R$ 6.25. The R$ 1.15 difference per part
is exactly the kind of loss that shows up at a hundred units — R$ 115 of profit
evaporated by forgetting the purge.

## Resin: volume, not weight

Resin printing works differently, because you buy liquid. The fields change:

- **Cost per liter** — the price of the bottle.
- **Volume used** — how many milliliters the part consumes.
- **Waste margin** — the percentage left in the vat and in the supports.
- **Density** — converts volume into weight, for the inventory record.

The formula mirrors the filament one, but in milliliters:

```
volume with waste = volume used * (1 + waste margin / 100)
material cost     = (volume with waste / 1000) * cost per liter
```

A 30 ml part with a 10% waste margin and resin at R$ 150 per liter:

```
volume with waste = 30 * 1.10   = 33 ml
material cost     = 0.033 * 150 = R$ 4.95
```

Density does not feed the price — it only exists so the inventory knows how many
grams the part has, which is used for resin stock tracking.

## How the inventory feeds the section

You do not have to type the cost and density every time. If the filament is
cataloged in the **inventory**, the calculator offers the list of registered
spools, and selecting one fills the section with that roll's data: material
type, cost per kg and density.

The link also runs the other way: when a part uses a selected spool, the system
shows how much of that roll is left — and subtracts the consumed weight on
every print. That way the next part is priced with the real cost of the plastic
on your shelf, not a fixed estimate. See the [inventory](#user-content-inventory)
article for details.

## Common pitfalls

- **Forgetting the purge on color prints.** The purge tower of a three-color
  model can outweigh the part itself. Without the field, the cost is
  understated from the very first print.
- **Using the wrong density.** PLA and ABS have very different densities; if
  the catalog says 1.24 and the roll is 1.04, every volume conversion is wrong.
- **Mixing the spool price with the kilo price.** A R$ 90 spool with 1 kg is
  R$ 90/kg; a R$ 90 spool with 750 g is R$ 120/kg. The inventory stores the
  price per kilo precisely so this trap does not exist.
- **Leaving efficiency at 100%.** It is tempting, but it is a lie: the last
  stretch of a spool is almost always wasted. 98% is an honest value.
