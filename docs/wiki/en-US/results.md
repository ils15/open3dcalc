---
title: Results
order: 19
---

# Results

The **Results** section is where everything comes together: it takes every cost
from the other sections, sums them in the right order, and answers the three
questions that matter — **how much the part cost**, **how much it should sell
for**, and **what is left as profit**.

Unlike the other advanced sections, results show up at **every** level. What
changes is the detail of the line items; the final consolidation is always
there.

## The order of the sum matters

The selling price is not "cost plus a markup". It is a sequence where each step
adds something different:

```
productionCost = material + energy + machine + hardware
               + ppe + labor + software + finishing + extras

baseCost = productionCost + failure + packaging + shipping

grossProfit = baseCost * (margin / 100)

priceBeforeFees = baseCost + grossProfit

sellPrice = priceBeforeFees / (1 - (taxes% + fees%) / 100)
```

Notice two things. First, **failure** and **logistics** (packaging and
shipping) enter the base cost — you also profit on them. Second, taxes and the
marketplace fee are deducted **from the selling price**, so they raise the final
price instead of lowering your profit.

## Key figures in the result

- **Total Cost** — how much the part cost to make, including failure, packaging
  and shipping. It is the **break-even point**: selling below it is a loss, and
  the app warns you.
- **Sell Price** — the one suggested by the formula. Editable; the actual margin
  is recalculated on the spot.
- **Actual Margin** — net profit over the selling price, not over the cost. It
  is always lower than the margin you typed — see the example.
- **Profit per Hour** — net profit ÷ total hours (print + post + setup). It is
  the best metric for deciding whether a job is worth taking.

## Complete numeric example

Let us consolidate the example part used across all articles: a **PLA phone
stand**, 180 g, 5.5 hours of printing, 150 W of power, an R$ 1,800 printer
depreciated over 36 months at 100 h/month, R$ 30/month of maintenance, R$ 550 of
fixed costs at 150 h/month, 30 minutes of labor at R$ 25/h, a R$ 30/month
slicer, an R$ 5 STL, R$ 2 of PPE per part, 10% failure, R$ 3 packaging, R$ 8
shipping, 50% margin, 6% taxes and 10% marketplace fee.

Each line, coming from its section:

```
material    0.18 kg * R$ 90/kg    =  R$ 16.20
energy      0.825 kWh * R$ 0.75   =  R$  0.62
machine     R$ 3.80/h * 5.5 h     =  R$ 20.90
hardware    nozzle + bed + paint  =  R$  3.82
labor       0.5 h * R$ 25         =  R$ 12.50
ops         software + PPE        =  R$  8.65
```

Now the consolidation:

```
productionCost = 16.20 + 0.62 + 20.90 + 3.82 + 12.50 + 8.65 = R$ 62.69

failure (10%)  = 62.69 * 0.10                              =  R$  6.27
packaging                                                         R$  3.00
shipping                                                          R$  8.00
baseCost       = 62.69 + 6.27 + 3.00 + 8.00                 = R$ 79.96

grossProfit    = 79.96 * 0.50                              = R$ 39.98
priceBeforeFees = 79.96 + 39.98                           = R$ 119.94

sellPrice      = 119.94 / (1 - 0.16)                       = R$ 142.79

tax (6%)       = 142.79 * 0.06                             =  R$  8.57
marketplace    = 142.79 * 0.10                             =  R$ 14.28

netProfit      = 142.79 - 79.96 - 8.57 - 14.28            = R$ 39.98
actualMargin   = 39.98 / 142.79                           =   28.0%
```

## The lesson hidden in the example

You asked for a **50% margin** and ended with a **28% actual margin**. Nothing
was miscalculated: the 50% is a margin **over cost** (markup), while the actual
margin is over the **selling price** — which is bigger, because taxes and fees
inflated it.

The good news is in the profit: **R$ 39.98**, exactly 50% of the base cost. Not
a coincidence: the formula passes taxes and fees on to the price, so net profit
is preserved. What changes is the percentage, not the money.

The **profit per hour** here is:

```
totalHours = (330 + 18 + 12) / 60 = 6.0 h
profitPerHour = 39.98 / 6.0 = R$ 6.66/h
```

R$ 6.66 an hour is the number that decides whether this job is worth taking —
far more honest than "50% margin".

## Target margin mode and custom price

You do not always want to derive the price. Sometimes the customer says "I want
to pay R$ 120" and you need to know whether it is worth it. That is what
**target margin mode** is for: you type the desired selling price and the
calculator shows its real margin, deducting taxes and fees from the typed value.

On our part, a price of R$ 120 would give:

```
tax = 7.20    marketplace = 12.00
profit = 120 - 79.96 - 7.20 - 12.00 = R$ 20.84
actualMargin = 20.84 / 120 = 17.4%
```

If the result falls below the break-even point, the calculator warns you on
screen — the sign that it is better to decline the job than to take a loss.

## Monthly projection and batches

The section also shows a **monthly projection**: how many parts you sell per
month and what that means in revenue, cost and profit. On our part, at 30 sales
per month:

```
revenue = 142.79 * 30 = R$ 4,283.70
cost    =  79.96 * 30 = R$ 2,398.80
profit  =  39.98 * 30 = R$ 1,199.40   (annual: R$ 14,392.80)
```

For more than one unit, the **setup** cost is diluted across the parts — see
[labor](#user-content-labor). The per-unit price drops and the difference shows
up here.

## How this section relates to the others

Each line of the result comes from a specific place:

- [material](#user-content-material) — the filament consumed.
- [print parameters](#user-content-print-parameters) — time, energy and the printer used.
- [machine](#user-content-machine-costs) — depreciation, maintenance and the
  [fixed costs](#user-content-fixed-costs) share.
- [hardware](#user-content-hardware-wear) — nozzle, bed, LCD wear and finishing.
- [labor](#user-content-labor) — setup and post-processing.
- [ops](#user-content-operational--software) — software, STL and PPE.
- [failure and sales](#user-content-additional-costs-and-sales) — risk, packaging, shipping, taxes
  and margin.

## Practical pitfalls

1. **Thinking a 50% margin is 50% profit on the price.** As the example shows,
   it is 28%. Always read the **actual margin**, not the margin you typed.
2. **Selling at the break-even point.** Total cost is the survival floor, not
   the fair price. Selling at it means working for free while still paying tax.
3. **Forgetting that failure also earns margin.** Failure enters the base cost
   and gets a margin. That is correct — a part that fails costs more than one
   that does not, and the parts that succeed have to pay for the ones that
   fail.
4. **Ignoring profit per hour.** A job with R$ 200 of profit over 80 machine
   hours yields R$ 2.50/h. The profit in currency looks good; the hourly rate
   reveals you would have been better off doing something else.
