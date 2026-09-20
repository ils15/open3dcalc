---
title: Machine Costs
order: 14
---

# Machine Costs

The **Machine Costs** section answers: *how much of this part is the printer's
wear?* It is the equipment depreciation: the price you paid for the printer,
divided by its useful life, charged per working hour. It is the section that
makes a part's price include, slice by slice, the money you spent buying the
machine.

This section only shows up at the **advanced** level. In quick or detailed mode
it is omitted — the depreciation is still computed, just not shown.

## Machine, energy and hardware: three different things

These three sections are easy to confuse. Here is the split:

- **Print parameters** measures **energy** — how many kWh the printer consumed
  for this part. It is the power bill.
- **Machine** measures the **depreciation of the whole printer** — the asset
  paying for itself over its lifetime.
- **Hardware wear** measures the **consumable parts** — nozzle, bed, LCD, FEP.
  See [hardware](#user-content-hardware-wear).

If you put the printer's price in two of those three places, the customer pays
for the machine twice.

## Section fields

Every field here is a piece of the hourly rate. The toggle at the top of the
section turns the whole depreciation on or off.

- **Printer Cost** — what you paid for the machine, in currency. Include
  shipping and taxes if possible, since that is what left your pocket. Leaving
  it at zero disables the depreciation (a "free" machine, which is rarely
  true).
- **Depreciation** — **how many months** the printer takes to pay for itself.
  The market standard is 36 months for equipment. A short term (12 months)
  produces a high hourly rate; a long one (60 months) cheapens every part, but
  the machine will likely die before finishing.
- **Monthly Usage** — **how many hours per month** the printer is actually
  printing. It is the most dangerous field in the section, and has a pitfall
  below.
- **Maintenance** (toggle) — enables the maintenance block.
- **Monthly Maintenance Cost** — what you spend per month on replacement
  nozzles, belts, bearings, lubrication and spare parts.

## The formula

The total useful life is months times monthly hours. The hourly rate is the
price divided by that life.

```
usefulLifeHours = depreciationMonths * hoursPerMonth

depreciationPerHour = printerCost / usefulLifeHours
maintenancePerHour  = maintenanceCost / hoursPerMonth

hourlyRate = depreciationPerHour + maintenancePerHour + fixedShare

machine = hourlyRate * printTimeHours
```

The `fixedShare` comes from the [fixed costs](#user-content-fixed-costs) section
and is added here, inside the machine's hourly rate, because productive hours
happen on the machine. If fixed costs are disabled, that share is zero.

The math is guarded against division by zero: a `usefulLifeHours` or
`hoursPerMonth` of zero zeroes the corresponding share instead of blowing up.

## Numeric example, step by step

An **Ender 3** cost **R$ 1,800**. You have used it for 3 years, print about
**100 hours a month**, and spend **R$ 30 a month** on maintenance. Let us build
the example part: a phone stand taking **5.5 hours** to print.

```
usefulLifeHours = 36 * 100 = 3,600 h

depreciationPerHour = 1,800 / 3,600 = R$ 0.50/h
maintenancePerHour  = 30 / 100      = R$ 0.30/h
fixedShare           = R$ 3.00/h    (from fixed costs)

hourlyRate = 0.50 + 0.30 + 3.00 = R$ 3.80/h

machine = 3.80 * 5.5 = R$ 20.90
```

The part carries **R$ 20.90** of machine. Of that, R$ 2.75 is pure depreciation
(0.50 × 5.5), R$ 1.65 is maintenance and R$ 16.50 is the fixed-cost share.
Notice who dominates: the fixed share. That is why the
[fixed costs](#user-content-fixed-costs) section is what most separates a hobby
from a business.

A note on the numbers. This example uses **100 hours a month**, the actual usage
of **this printer**. That is the basis for depreciation and maintenance. The
[fixed costs](#user-content-fixed-costs) section works with **150 hours a month**,
the productive hours of the whole workshop. These are independent fields in the
app, and the different values are correct: one measures the wear on a single
machine, the other prorates the cost of the space.

## Sensitivity: what moves the rate

The hourly rate is a fraction with two denominators. Small changes in these
fields have a big effect on the final price:

```
Monthly usage of 200 h instead of 100 h:
  depreciationPerHour = 1,800 / 7,200 = R$ 0.25/h   (half!)

Depreciation of 12 months instead of 36:
  depreciationPerHour = 1,800 / 1,200 = R$ 1.50/h   (triple!)
```

If you print little, depreciation per part is high — and that is correct, not a
calculator error. The fix is not to lie about the hours; it is to print more, or
accept that one-off parts on an idle machine are genuinely expensive.

## How this section relates to the others

- The **time** multiplying the hourly rate is the print time from the
  [print parameters](#user-content-print-parameters) section, not the labor time.
- The **share** entering the rate comes from
  [fixed costs](#user-content-fixed-costs).
- The worn **parts** (nozzle, bed) live in [hardware](#user-content-hardware-wear)
  and are summed separately.
- Depreciation lands in the "Equipment & Wear" block of the
  [result](#user-content-results).

## Practical pitfalls

1. **Overestimating monthly usage.** The number-one trap. If you enter 200
   h/month but the printer only runs 40 h, depreciation comes out five times
   lower than reality and every part is underpriced. Use an honest average of
   the last three months.
2. **Forgetting maintenance.** A 3D printer is a device with moving parts that
   wear out. If you leave maintenance off, the real bill for belts and nozzles
   arrives in eight months and no part paid for it.
3. **Depreciation stretched too long.** 60 months makes the hourly rate look
   irresistible, but an Ender 3 rarely survives 3,600 productive hours without
   losing precision. 24 to 36 months is the realistic window.
4. **Counting powered-on hours as printing hours.** Preheating, leveling and
   filament swaps print nothing. The field is "hours per month printing" — time
   the build plate is actually moving.
