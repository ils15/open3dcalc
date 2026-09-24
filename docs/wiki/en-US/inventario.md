---
title: Inventory
order: 20
tourId: inventario-bobinas
---

# Inventory

The **Inventory** is the catalog that feeds the calculator. Instead of
estimating cost from generic values, you enter once what you bought and what
you use — and every estimate starts from real numbers.

The **Filament Shelf** is a single tab, identified internally as `inventory`.
The old `spools` tab has been removed, so there is no second list to keep in
sync. **Cadastros**, which stores printers, materials and marketplaces, remains
a separate tab used to fill other calculator fields.

Every shelf value is read by a specific calculator section. Get one wrong and
every quote that uses it comes out wrong — which is why this catalog is the
cheapest place to gain accuracy.

## The Filament Shelf

Each entry is a physical **spool**. The shelf keeps the data you need to decide
whether it can cover the current part:

- **Brand** and **material** (PLA, PETG, ABS, TPU, ASA, SILK...).
- **Color** and its hexadecimal value, so similar spools are easy to tell apart.
- **Gross weight** and **net weight**, in grams. Net weight is the filament left
  after the tare.
- **Spool tare**, the weight of the empty bobbin.
- **Remaining meters**, when diameter and density make the conversion possible.
- **Price per kg**, meaning what you actually paid per kilogram.
- **Diameter**, in millimeters — the default is `1.75`.
- **Status**: `In stock`, `On the way` or `Empty`.
- **Where bought** and **notes**, free-form.

The list filters by material and status. Each card shows a circular swatch in the
registered color, the remaining percentage, the coverage required for the active
part, and a low-stock warning when `isLowStockSpool` is true.

The shelf also participates in the calculator flow: the action to **add to the
shelf** can receive the current material and configuration, so you do not have
to register the same spool again. Selecting a spool in the calculator feeds its
data into the estimate.

## The Cadastros tab

Three preset catalogs:

- **Printers**: name, brand, **power** (W), **value** (R$), **useful life**
  in hours, **maintenance per hour** (R$/h) and free-form organizing tags.
- **Materials**: name, **type** (`fdm` or `resin`), **density** (g/cm³) and
  **average price** (R$/kg).
- **Marketplaces**: name, **percent fee**, **fixed fee**, **free shipping**
  and the **shipping percentage**.

The app ships a ready-made list of materials (PLA, PETG, ABS, ASA, TPU,
Nylon, PC and the carbon-fiber blends) and of known printers. You can edit any
preset or create a custom one.

## How each field reaches the estimate

The calculator splits cost into independent sections, and the inventory feeds
four of them:

- price per kg, remaining weight and spool diameter → [Material](#user-content-material) section
- printer value, useful life and monthly maintenance → [Machine](#user-content-machine-costs) section
- printer power and energy rate → [Print](#user-content-print-parameters) section
- marketplace fees and shipping → [Sales](#user-content-additional-costs-and-sales) section

```
material = (part weight + failure weight) * price per kg / 1000
machine  = ((printer value / useful life) + (monthly maintenance / hours per month) + fixed share) * hours
print    = (power / 1000) * hours * energy rate
```

Diameter comes first: it converts the model volume into weight. That is why
the default is `1.75` — a `0.05` mm deviation already shifts volume by about
`5.7%`, and weight along with it.

## Generic estimate vs. real catalog

Picture a **180 g** part. With the generic PLA preset at R$ 90/kg:

```
material = 0.180 kg * R$ 90 = R$ 16.20
```

You paid R$ 112/kg for a specific PLA Silk. With the catalog updated:

```
material = 0.180 kg * R$ 112 = R$ 20.16
```

That is **R$ 3.96 more** per part — 24% above what the generic estimate
showed. Over a 50-part month, R$ 198 of margin would quietly vanish. The
catalog does not change what you paid; it just shows the truth.

The same applies to the machine. An R$ 1,800 printer with a 2,000-hour useful
life costs **R$ 0.90 per hour** of use, so a 6-hour print carries R$ 5.40 of
depreciation — that amount lands in the Machine section. The registered power
feeds a different section, Print: 350 W over 6 hours at R$ 0.75 per kWh adds
another R$ 1.58 of energy. Without those fields filled in, the calculator has
no way to guess either number.

## Partial spools, tare and coverage

**Net weight** is what makes the inventory useful day to day. It tracks the
calculator: the active part and the current quantity define how much plastic the
run needs, and each spool answers whether it can cover it:

```
needed    = part unit weight * quantity
coverage  = spool remaining weight - needed
```

When it falls short, the app shows **"Does not cover the part"** along with
how many grams are missing. That way you swap the spool before printing,
not mid-print.

To weigh a partial spool on a scale, fill in the **tare**. Without it, the
reading includes the empty bobbin. The app knows the tares by brand (Bambu Lab
210 g, Prusament 194 g, Polymaker 140 g, Anycubic 127 g) and applies that
table automatically — but a tare measured on the actual spool always beats
the table, because lot variation is real.

Example: the scale reads 400 g on a Bambu Lab spool. Discounting the 210 g
tare leaves **190 g** of actual filament. Skipping the tare would make the
calculator overstate the material by more than 100%.

Alongside grams, the shelf calculates **remaining meters** when the material's
diameter and density are filled in. Use that information to plan a larger batch:
compare available meters with estimated demand instead of replacing net weight
with a catalog number.

## Pitfalls that cost money

Four silent catalog mistakes, each one enough to strip the accuracy out of every estimate.

- **Wrong density**: ABS is 1.04 g/cm³, PLA is 1.24. A 100 cm³ part is 104 g
  of ABS or 124 g of PLA — a 20 g difference. Estimate by volume with the
  wrong material's density and both the weight and the cost come out wrong.
- **Price per spool, not per kg**: a 1 kg spool at R$ 90 is R$ 90/kg; a
  500 g "economy" spool at R$ 65 is R$ 130/kg — 44% more per gram.
- **Partial spool ignored**: quoting with the original weight of a half-empty
  spool breaks coverage right when you go to print.
- **Stale status**: a spool still marked `In stock` but empty fools the filter
  when you pick the filament.

## Why it pays off

Filling this in is a one-time job. Every field you enter makes every later
estimate more precise, with no purchases and no process change. No other
lever in the app buys this much accuracy for this little effort — start with
the printer and the material you use most, and the rest gets easier.
