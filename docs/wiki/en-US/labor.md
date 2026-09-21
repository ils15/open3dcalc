---
title: Labor
order: 16
---

# Labor

The **Labor** section answers: *how much is my time worth on this part?* It is
the minutes when a human being is actually working: preparing the file,
slicing, setting up the printer, removing the part, breaking away supports,
sanding.

This section only shows up at the **advanced** level. It is the section that
separates those who cost their own time from those who treat their own hours as
free.

## What does NOT belong here: print time

This is the most important point of the section, and the source of the most
common mistake: **the time the printer spends printing is not labor.** During
those hours the machine works alone and you can be doing something else — or
another paid job. Print time is charged by the [machine](#user-content-machine-costs)
(depreciation, energy, share), not here.

If you add the 5.5 hours of printing to labor, the customer pays twice: once as
machine, once as person. Labor counts only the minutes where **you** are
needed.

## Section fields

The section is three fields: two clock your work and one says what it is worth.

- **Setup (Slicing)** — minutes spent preparing the file: adjusting the model,
  positioning the plate, configuring the slicer, exporting the gcode, leveling
  the bed and loading filament. A simple part takes 5 minutes; a client file
  with several revisions can take 40.
- **Post-Processing** — minutes removing the part from the bed, breaking off
  supports, sanding, gluing, painting. This time is proportional to each part.
- **Hourly Rate** — how much you want to earn per **hour** of work, in
  currency. It is the field most often left at zero. If it is zero, this whole
  section sums to zero — and you donate your own time.

## The formula

Minutes become hours and multiply by the hourly rate:

```
totalMinutes = setupMinutes + postProcessingMinutes

labor = (totalMinutes / 60) * hourlyRate
```

When you produce more than one identical unit, the app dilutes the labor across
the units — the setup is shared by the whole batch:

```
laborPerUnit = labor / quantity
```

See the pitfall below about post-processing in that dilution.

## Numeric example, step by step

Our example part, the phone stand. You spent 12 minutes configuring the slicer
and 18 minutes removing and sanding the part, and you want to earn **R$ 25 an
hour**.

```
totalMinutes = 12 + 18 = 30 min

labor = (30 / 60) * 25 = 0.5 * 25 = R$ 12.50
```

Behind the number: **R$ 5.00** of setup (0.2 h × 25) and **R$ 7.50** of
post-processing (0.3 h × 25). Now the same scenario with a batch of 10 units:

```
labor = 12.50 / 10 = R$ 1.25 per unit
```

In practice the 12-minute setup was paid once and prorated. The 18 minutes of
sanding, though, happen again for every part — which is why batches deserve
attention.

## How much to charge as an hourly rate

There is no single answer, but there is a floor: your hourly rate needs to cover
what an hour costs you, not just what it is "worth in the market". Add what you
spend per month (including what is in the
[fixed costs](#user-content-fixed-costs) and [machine](#user-content-machine-costs)
sections) and divide by the hours you actually work in the business. Anything
below that is unpaid work.

```
rateFloor = totalMonthlyCost / monthlyWorkedHours
```

R$ 25/h is an honest starting point for a one-person operation; R$ 8/h is
underpaid labor subsidized by another source of income.

## How this section relates to the others

The boundaries matter, because the time and the material of finishing live in different sections.

- The **print time** (which is NOT here) comes from
  [print parameters](#user-content-print-parameters) and feeds
  [machine](#user-content-machine-costs).
- The **supplies** for post-processing — sandpaper, paint, acetone — live in
  [hardware wear](#user-content-hardware-wear), in the finishing block. Only the
  time belongs here; the material belongs there.
- The **share and depreciation** are in [machine](#user-content-machine-costs) and
  [fixed costs](#user-content-fixed-costs), and are multiplied by print hours,
  not by your hours.
- The profit-per-hour shown in [results](#user-content-results) uses exactly
  this combination: print hours + post + diluted setup.

## Practical pitfalls

Four mistakes surround this section, and each one gives away a piece of your time.

1. **Leaving the hourly rate at zero.** The most frequent mistake. The
   calculator accepts it and simply shows a lower price — nice on screen, loss
   in real life. If you do not know the number, start at R$ 25 and adjust
   upward.
2. **Adding print time to labor.** Pure duplication. The machine is already
   being charged for those hours; you were not there the whole time.
3. **Not counting the setup.** "Oh, it was only 10 minutes." Those are 10
   minutes each time that you never billed. Across a hundred quotes, that is
   more than 16 donated hours.
4. **Diluting post-processing in batches.** The app dilutes the entire labor
   per unit when the quantity is greater than 1, which is fair for setup. But
   if every part is sanded individually, post is a per-unit cost, not a batch
   cost — check that the per-unit price in [results](#user-content-results)
   still covers the individual finishing.
