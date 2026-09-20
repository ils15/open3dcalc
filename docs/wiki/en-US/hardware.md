---
title: Hardware Wear
order: 13
---

# Hardware Wear

The **Hardware Wear** section answers a question almost every beginner ignores:
*what did this print consume besides filament?* Filament is only the visible
part of the cost. The part also passes through the **nozzle** (wearing the
bore), the **bed** (wearing the adhesive or the PEI sheet) and, on resin, the
**LCD panel**, the **FEP film** and the **curing lamp**.

This section only shows up at the **advanced** level of the calculator. In
quick or detailed mode it stays hidden — but the cost is still there, just
invisible.

## Why this cost exists even for a single print

There is a classic excuse to skip this section: *"my printer is already paid
for, so the part costs me nothing"*. The problem is that the nozzle is never
paid for forever. Every meter of filament pushed through a 0.4 mm nozzle
enlarges it a tiny bit. A new brass nozzle costs about R$ 35 and lasts roughly
20 kg of PLA. If your part uses 180 g, it consumed 0.9% of that nozzle's life —
that is R$ 0,32 that exists in the single print and nobody paid you back for.

This section turns that silent wear into a number you can add up and charge.
Without it, your price covers filament and donates the machine's wear.

## FDM: nozzle, bed and finishing

On **FDM**, the section gathers three blocks, each with its own toggle.

### Nozzle

- **Nozzle Cost** — what you paid for the nozzle, in currency. Brass is cheap;
  hardened steel costs several times more.
- **Lifespan** — how many **kilograms** of filament this nozzle holds up before
  losing precision. Brass with PLA: close to 20 kg. Steel with carbon-filled
  filament: 10 kg or less.

Leaving **Lifespan** at zero disables the nozzle math (the division by zero is
guarded and becomes zero — the nozzle does not inflate the price, but it is
also not being charged).

### Bed and Adhesion

- **Adhesive Cost per Print** — estimated value of spray, glue, tape or PEI
  sheet wear **per print**. It is a fixed per-part value, not an hourly one.

### Physical Finishing

- **Finishing Supplies** — what you spend on sandpaper, primer, paint, body
  filler or acetone for this part in particular. If the part ships with no
  finishing at all, leave it at zero.

## Resin: LCD, FEP, washing and curing

On the resin tab the same section gains other wear items, because an SLA
printer has parts that wear by the **hour** and by the **part**.

- **LCD Cost** and **LCD Lifespan** — the resin panel loses power with use.
  Its lifespan is counted in exposure **hours**.
- **FEP Film Cost** and **FEP Durability** — the tank's bottom film gets
  scratched on every removed part. Durability is counted in **prints**.
- **Washing (Alcohol)** — cost per liter of isopropyl alcohol and volume used
  per cycle. **Water-washable** resin zeroes this block automatically, since
  the part is rinsed under the tap.
- **UV Curing** — curing time and lamp power, which also wears out.

## The formula

For FDM the math is straightforward: the nozzle is prorated by the part weight,
the bed and the finishing are fixed per part.

```
weightKg = partWeight / 1000

nozzleWear = (weightKg / lifespanKg) * nozzleCost
bedWear    = adhesiveCost
finishing  = finishingSupplies

hardware = nozzleWear + bedWear + finishing
```

On resin, the LCD is prorated by the hour and the FEP by the print:

```
lcdWear = (exposureHours / lcdLifespanHours) * lcdCost
fepWear = (1 / fepDurability) * fepCost
```

## Numeric example, step by step

Picture a **phone stand** in PLA, weighing **180 g**, printed with light
sanding and paint.

Step by step on FDM:

```
weightKg = 180 / 1000 = 0.18 kg

nozzleWear = (0.18 / 20) * 35 = 0.009 * 35 = R$ 0.32
bedWear    = R$ 1.50
finishing  = R$ 2.00

hardware = 0.32 + 1.50 + 2.00 = R$ 3.82
```

The part just became **R$ 3.82** more expensive than "filament only". That is
R$ 0,32 of nozzle nobody remembers to charge — across a hundred identical parts
it is R$ 32 of nozzle alone, enough for a new nozzle and a coffee.

## How this section relates to the others

- The **weight** feeding the nozzle formula comes from the
  [material](#user-content-material) section — fill it first.
- The LCD **exposure time** comes from the print time, in the
  [print parameters](#user-content-print-parameters) section.
- Depreciation of the **whole** printer (the asset, not its parts) lives in the
  [machine](#user-content-machine-costs) section. Hardware is the part that wears;
  machine is the whole that depreciates.
- The **time** you spend sanding and painting is charged separately, under
  [labor](#user-content-labor) — here only the supplies belong.
- Everything here is summed up in [results](#user-content-results).

## Practical pitfalls

1. **Underestimating nozzle lifespan with abrasive filament.** Carbon fiber
   and glitter eat a brass nozzle in a few kilograms. If you print with those,
   either drop the lifespan to 10 kg or switch to a steel nozzle.
2. **Forgetting the finishing.** It is the most common zeroed field — and the
   one that separates a "prototype" part from a "product" part. Sandpaper and
   paint are not free.
3. **Mixing up wear with depreciation.** If you put the printer's price here,
   the cost gets duplicated: the whole printer is already being depreciated in
   the [machine](#user-content-machine-costs) section. Only consumable parts belong
   here.
4. **Measuring nozzle lifespan in parts, not kilograms.** The nozzle wears by
   the amount of material extruded, not by the number of files. An 800 g hollow
   part wears the nozzle eight times more than a 100 g solid rod.
