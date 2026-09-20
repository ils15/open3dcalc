---
title: Inventory
order: 2
---

# Inventory

The **Inventory** tab catalogs filaments and machines so the calculator can use
real values instead of generic defaults. A well-kept catalog is what separates
a guess from a reliable cost.

## Filaments

Each filament stores the data that feeds the `material` section:

- material diameter and density
- price paid and spool quantity
- recommended extrusion temperature

## Machines

Each machine describes the hardware that will be depreciated in the `hardware`
section:

- printer acquisition cost
- estimated lifetime hours
- power draw in Watts

## How inventory reaches the estimate

Selecting a cataloged filament and machine makes the calculator replace its
defaults with yours:

```
material cost = (part weight + failure weight) * price per gram
hardware cost = (hours used / lifetime) * machine price
```

Keeping the inventory current is the cheapest way to gain accuracy.
