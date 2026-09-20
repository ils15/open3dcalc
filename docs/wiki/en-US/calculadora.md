---
title: Calculator
order: 1
---

# Calculator

The **Calculator** is the heart of Open3DCalc: it estimates the cost of a 3D
print from a handful of inputs and breaks the result down into auditable
sections, never hiding how each value is composed.

## Basic and advanced levels

The calculator has two detail levels:

- **Basic**: only the essentials, for a quick estimate.
- **Advanced**: reveals every cost section, from material to sale price.

Switching levels never clears what you have already filled in.

## Advanced cost sections

Every advanced estimate is built from independent sections:

1. `material` — filament consumed, including failures and rework.
2. `hardware` — depreciation of the printer components.
3. `machine` — machine time and power consumption.
4. `fixedCost` — apportioned fixed costs such as rent and maintenance.
5. `labor` — labor for setup and post-processing.
6. `ops` — additional supplies and operation.
7. `sales` — taxes, fees and sales margin.
8. `results` — consolidation and suggested final price.

## Sale price

The `results` section shows total cost and suggested sale price side by side,
so the margin is a conscious choice instead of a hidden rounding.

```
total cost = material + hardware + machine
           + fixedCost + labor + ops
sale price = total cost + sales
```
