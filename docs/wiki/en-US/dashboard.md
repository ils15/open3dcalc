---
title: Dashboard
order: 23
tourId: dashboard-kpis
---

# Dashboard

The **Dashboard** is where the app gathers your estimates and shows whether the
work is paying off. Cost, profit, margin and trend on a single screen.

One rule matters more than any chart: **the dashboard invents no number**.
Everything on it comes from the estimates you saved to **History**, plus the
estimate currently open in the
[Calculator](#user-content-calculator). It reads no quotes, reads no revenue
and queries no external system.

That is why a first visit usually shows empty charts and the message **"No
history data"**. It is not a bug and not a missing setting — it is the normal
state for someone who just installed the app. Save three estimates to History,
come back here, and the same screen is filled in.

## KPIs of the active estimate

The first group of numbers follows the part open in the calculator. Each one
answers a different question:

- **Total Cost** — how much the part costs to produce
- **Selling Price** — the price the calculator suggests
- **Net Profit** — revenue minus cost, in money
- **ROI** — the return on the money invested
- **Break-Even Point** — how many parts cover the monthly fixed cost
- **Break-Even Revenue** — the revenue at that point
- **Monthly Projection** — the profit if you keep your production pace

ROI is the percentage the invested money yields:

```
ROI = (net profit / total cost) * 100
```

A part that costs **R$ 20.00** and sells for **R$ 30.00** leaves R$ 10.00 of
profit. The ROI is `(10 / 20) * 100 = 50%`: every real invested returns fifty
cents clean.

The break-even point shows when the operation stops losing money:

```
break-even point = ceil(monthly fixed cost / margin per unit)
```

With **R$ 600.00** of monthly fixed cost and **R$ 10.00** of margin per part,
that is `ceil(600 / 10) = 60 parts`. The revenue at this point is
`60 * R$ 30.00`, or **R$ 1,800.00** of revenue just to break even.

When the margin per unit goes negative, the app does not compute it and warns
instead: a part sold below cost has no break-even point, and the goal becomes a
warning rather than a goal.

The monthly projection takes the part's profit up to the quantity you plan to
produce. Holding 100 units in the example, that is
`100 * R$ 10.00 = R$ 1,000.00` of projected profit for the month.

## KPIs of the history

The second group looks backwards and counts only the filtered period. Four
numbers summarize what has already passed through the calculator:

- **Total Profit** — the sum of each estimate's profit in the period
- **Average Cost per Print** — the mean of the individual costs
- **Average Margin** — the mean of each estimate's margin
- **Total Prints** — how many estimates are counted

The average margin is not total profit divided by revenue. Each estimate
computes its own first, and the mean comes after:

```
average margin = mean of (profit / selling price * 100) for each estimate
```

It is the same calculation as for a single part, repeated per item. That is why
a cheap part with a high margin moves the number as much as an expensive one.

Picture three estimates saved in the month:

- **N20 motor mount** — cost R$ 18.00, sale R$ 42.70, profit **R$ 24.70**
- **Raspberry case** — cost R$ 41.00, sale R$ 68.00, profit **R$ 27.00**
- **Identification tag** — cost R$ 1.20, sale R$ 8.00, profit **R$ 6.80**

Total profit is **R$ 58.50** and total prints are **3**. The average cost per
print is `(18.00 + 41.00 + 1.20) / 3 = R$ 20.07`. The individual margins are
57.8%, 39.7% and 85.0%, which gives an **average margin of 60.8%**.

### Period filters

The start and end date filters choose what gets counted. Narrow the period to a
quarter and you see only that; clear the filters and the view returns to the
whole history. Everything in the second KPI group and in the charts follows the
same window.

## Charts

Four charts turn the history into pictures. Each one answers a question:

- **Profit Trend** — is profit going up or down?
- **Most Profitable Printers** — which machine pays the bill?
- **Most Used Materials** — where is your filament going?
- **Period Comparison** — is this month better than the last?

The **Profit Trend** is an area chart of profit over time. The most useful read
is not the highest point but the direction: a curve that climbs slowly is
already a sign that pricing deserves attention.

**Most Profitable Printers** and **Most Used Materials** show the top 5 of
each. When a machine sits at the top, it is the one that should take the next
part; when a material dominates, that is what is worth buying in larger
quantities.

The **Period Comparison** is a pie chart with the current month next to the
previous one. If this month totals R$ 850.00 and the last one R$ 620.00, the
slices are 58% and 42% — the current month's share already tells you the period
is better.

## Goals and alerts

You set a **monthly profit goal** and the app stores it on your machine, under
the key `open3dcalc_dashboard_goal`. From that, the required part count is
calculated:

```
required parts = profit goal / profit per part
```

With a goal of **R$ 2,000.00** and **R$ 10.00** of profit per part, that is 200
parts in the month. If the margin per unit is negative, no quantity fixes it —
so the app warns instead of showing a meaningless number.

The **low margin alerts** flag estimates whose margin is below 20%. A part sold
for **R$ 25.00** at a cost of **R$ 21.00** has a 16% margin and lands on the
list. It is not a prohibition: it is where money is slipping away unnoticed.

## Exporting the report

The **Executive Report** exports as PDF. The export uses `html2canvas` to
capture the trend chart and builds the document with the period KPIs, the top
printers, the top materials and the comparison between the two months.

It is the file you send to a partner or keep as a record of the period, without
anyone needing to install anything to read it.

## Common pitfalls

Four misreadings of this screen, and all of them lead to a decision made with the wrong number.

- **Expecting the dashboard to show revenue.** It reads no quotes and queries no external
  system: it only sums the estimates from History plus the open one. An approved quote does
  not show up here until it becomes a saved estimate.
- **Reading the average margin as profit over revenue.** Each estimate computes its own first;
  the mean of 57.8%, 39.7% and 85.0% is 60.8%, but it is not total profit divided by revenue.
  A cheap part with a high margin moves the number as much as an expensive one.
- **Assuming the empty screen is a bug.** "No history data" is the normal state for someone
  who just installed the app — save three estimates and the screen fills in. No setting is
  missing.
- **Ignoring the low margin alert.** A part sold for R$ 25.00 at a R$ 21.00 cost has a 16%
  margin and lands on the list. It is not a prohibition: it is where money slips away
  unnoticed.

## Starting from scratch

If the dashboard is empty, the path is short:

1. calculate a part in the [Calculator](#user-content-calculator) tab
2. save the estimate to **History**
3. repeat with two more parts, preferably in different materials
4. return to the dashboard — KPIs and charts now have something to show

The dashboard is a mirror of your saved estimates. There is no shortcut to fill
it, but no secret either: every estimate saved is one more data point on the
screen.
