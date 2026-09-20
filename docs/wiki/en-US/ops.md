---
title: Operational & Software
order: 17
---

# Operational & Software

The **Operational & Software** section answers: *what invisible costs does this
part carry?* This is where software subscriptions, the 3D model you bought, the
gloves and the alcohol live — things that are neither filament nor machine, and
that almost always stay out of the quote.

This section only shows up at the **advanced** level. It has two blocks:
**Software and Files** and **PPE / Consumables**.

## Why "invisible" is the right word

You do not see the slicer in the part. You do not see the glove. You do not see
the paid STL file. But each of them is a real expense that existed for this
part to exist. The classic example is the slicer: a R$ 30 monthly subscription
sounds small, but if you print 100 hours a month, each hour carries R$ 0.30 —
and on a 5.5-hour part that is R$ 1.65 nobody usually charges.

The same logic applies to the model. If you paid R$ 50 for an STL file and sell
10 parts of it, each part carries R$ 5 of file. If you sell 1,000, it carries
R$ 0.05. The cost exists; what changes is the dilution.

## Block: Software and Files

- **Slicer Subscription** — the monthly cost of the slicing software, if you use
  a paid one. Leave it at zero if you use a free slicer; but remember that many
  slicers' "free" tier is not the commercial one.
- **STL File Cost** — what you paid for the 3D file, if you bought it from a
  third party. It is charged **once per part**, not per hour, so a single part
  carries the whole value.

The subscription is prorated by the month's print hours, using the **same hours
field** as the [machine](#user-content-machine-costs) section:

```
softwarePerHour = slicerSubscription / hoursPerMonth

software = (softwarePerHour * printTimeHours) + stlFileCost
```

The file cost is added in full, because every part comes from it. Note: when
the quantity is greater than 1, only **labor** is diluted across the units —
the STL file is still charged in full on each part. See
[labor](#user-content-labor) and [results](#user-content-results).

## Block: PPE / Consumables

- **PPE Cost per Print** — what you spend on gloves, masks, paper towels,
  filters and isopropyl alcohol per print. It is a **fixed per-part** value,
  not an hourly one. On FDM the default is zero (many people use no PPE); on
  resin the default is R$ 2.50, because handling resin without gloves is a real
  hazard.
- **Carbon Intensity** — grams of CO₂ per kWh of your power grid. It is not a
  monetary cost: it lets the calculator show the part's **carbon footprint**.
  It is informational, not part of the price.

The carbon footprint is computed from the energy consumed:

```
energyKwh = (powerW / 1000) * printTimeHours

carbonFootprintGrams = energyKwh * carbonIntensity
```

## Numeric example, step by step

Our example part, the 5.5-hour phone stand. You pay a slicer subscription of
**R$ 30 a month**, print **100 hours a month**, bought the STL for **R$ 5**,
and spend **R$ 2 per part** on gloves and isopropyl alcohol.

```
softwarePerHour = 30 / 100 = R$ 0.30/h

software = (0.30 * 5.5) + 5 = 1.65 + 5 = R$ 6.65

ppe = R$ 2.00

ops = 6.65 + 2.00 = R$ 8.65
```

And the carbon footprint, with the default intensity of 100 g/kWh and a 250 W
printer:

```
energyKwh = (250 / 1000) * 5.5 = 1.375 kWh

carbonFootprintGrams = 1.375 * 100 = 137.5 g of CO2
```

For a decorative part, **R$ 8.65** of "invisibles" is more than half the
[material](#user-content-material) cost — which was R$ 16.20 (0.18 kg of PLA
at R$ 90/kg).

## How this section relates to the others

- The **hours per month** prorating the subscription are the same as
  [machine](#user-content-machine-costs) — use matching numbers, or the share comes
  out wrong.
- The **print time** multiplying the rate comes from
  [print parameters](#user-content-print-parameters).
- The **finishing supplies** (sandpaper, paint) live in
  [hardware wear](#user-content-hardware-wear); here belong the safety and cleaning
  supplies.
- The result is summed into the "Operational & Work" block of
  [results](#user-content-results).

## Practical pitfalls

1. **Free slicer in life, paid slicer in the quote.** If you use a slicer's free
   tier to sell parts, you are technically using a non-commercial license. The
   cost of a proper license is real and should be here — either in the price or
   on your conscience.
2. **Forgetting the paid STL on a single part.** It is the inverse of the
   dilution mistake: on a single part, the whole file goes in. If you sell
   little, the STL is one of the part's biggest costs — and it justifies
   charging more for the first sale.
3. **Zeroing PPE on resin.** Resin is toxic and handled with gloves. The R$ 2.50
   per-part default exists because isopropyl alcohol and gloves run out. If you
   zero this field "out of generosity", you are subsidizing the customer.
4. **Treating the carbon footprint as a cost.** Carbon intensity is information
   only (g of CO₂). It does not raise the price — it lets you answer customers
   who ask, and compare against imported parts.
