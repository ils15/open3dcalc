---
title: Fixed Costs
order: 15
---

# Fixed Costs

The **Fixed Costs** section answers an uncomfortable question: *how much of the
rent does this part pay?* Everything you spend per month even if the printer
stays off — workshop rent, internet, baseline power, building fees, mandatory
software. No single part uses these things alone, but every part needs them to
exist.

This section only shows up at the **advanced** level. It is by far the most
underestimated section of the calculator, and the one that most separates a
hobby from a real business.

## Why prorate instead of ignoring

The argument against this section is: *"I pay rent anyway"*. That is true, and
exactly why it must be in the price. If no part pays the rent, then it is your
salary — or your savings — covering the rent of the business. The customer
walks away with a cheap part and you walk away paying for the space it was made
in.

Proration solves this with a simple idea: the monthly cost is divided by the
month's productive hours, and each part pays for the hours it consumed. A part
that uses more hours pays more rent. Fair.

## Section fields

The section is intentionally lean — two fields and one toggle.

- **Monthly Fixed Cost** — the sum of everything you pay per month regardless of
  production. Rent, internet, baseline power, building maintenance, software
  with a mandatory subscription. See the pitfall below on what not to put here.
- **Hours per Month** — the estimated **productive hours** of the printer per
  month, the same idea as the [monthly usage](#user-content-machine-costs) field. If
  this field is left at zero, the division is guarded and the share becomes
  zero — which means no part is paying the rent.

## The formula

This is the simplest calculation in the calculator, and maybe that is why it is
the most ignored:

```
sharePerHour = monthlyFixedCost / monthlyProductiveHours

fixedCost = sharePerHour * printTimeHours
```

The result is not added as a separate line: it is injected into the
**machine's hourly rate**, in the [machine](#user-content-machine-costs) section. That
way the share follows each part's print hours — a longer part pays more rent.

## Numeric example, step by step

A small workshop in a bedroom turned into a studio:

```
rent + building fees   = R$ 450
internet                = R$ 60
baseline power (standby)= R$ 40
-------------------------
monthlyFixedCost        = R$ 550

monthlyProductiveHours  = 150 h

sharePerHour = 550 / 150 = R$ 3.67/h
```

Our example part, the phone stand with **5.5 hours** of printing:

```
fixedCost = 3.67 * 5.5 = R$ 20.18
```

The part carries **R$ 20.18** of rent, internet and baseline power. Compare it
to the R$ 16.20 of [material](#user-content-material): the part pays more rent
than filament. That is the moment many people discover their selling price was
only covering plastic.

## The sensitivity that stings

The share is a division — and divisions blow up when the denominator is small.
Here is the same workshop at different productive hours:

```
150 h/month → 550 / 150 = R$ 3.67/h
100 h/month → 550 / 100 = R$ 5.50/h
 50 h/month → 550 /  50 = R$ 11.00/h
```

If the printer sits idle all week, every part has to carry double or quadruple
the rent. That is not a calculation flaw; it is the reality of an
underused operation. The way out is either to keep the machine busy or to
accept that weekend one-off parts have a higher fair price.

## How this section relates to the others

- The share is applied inside the [machine](#user-content-machine-costs) hourly rate,
  alongside depreciation and maintenance.
- The hours you use here must be **the same** as the machine's monthly usage.
  Using 150 h here and 300 h there is self-deception: the share comes out halved.
- The **printing energy** (unlike baseline power) is counted in the
  [print parameters](#user-content-print-parameters) section; do not duplicate it here.
- **Equipment maintenance** belongs to [machine](#user-content-machine-costs); here
  belongs the maintenance of the **space**.

## Practical pitfalls

1. **Putting variable costs here.** Filament, nozzles, isopropyl alcohol and
   shipping are proportional to production — they already have their own
   section. Only what is fixed belongs here: if production doubled or stopped,
   the value would not change.
2. **Optimistic productive hours.** If the machine is powered on 12 hours a day
   but only prints 4, the productive hours are 4. Overestimating this field is
   the most common way to artificially cheapen your own price.
3. **Forgetting invisible costs.** Internet, subscription software, card
   reader fees, parking. Nobody remembers to charge R$ 60 of internet — across
   a hundred parts a month that is R$ 0.60 per part nobody paid.
4. **Not prorating when printing little.** Those making two parts a month tend
   to zero this section because charging R$ 40 of rent on one part feels unfair.
   But the rent is real: either it is in the price, or it is in your pocket.
