---
title: Print Parameters
order: 11
---

# Print Parameters

The **print** section measures what the printer consumes while making the part:
machine time and electricity. It is the most straightforward section in the
calculator — few fields, no subjective adjustments — but it is also where people
conflate two different sums.

The rule of thumb: **print measures consumption, machine measures investment**.
The `print` section answers "how long and how much power did this part take?";
the [machine](#user-content-machine) section answers "how much of the printer's
price is this hour worth?". Neither replaces the other: power is an electric
bill, depreciation is an equipment bill. Both belong in the cost, kept separate.

## The three basic fields

- **Print time** — the total the machine takes, per the slicer. It does not
  include post-processing time (that lives in the `labor` section).
- **Printer power** — the average draw in watts. Most FDM printers sit between
  100 W and 350 W; resin printers usually draw less, but curing is an extra step.
- **Energy cost** — the per-kWh price on your electric bill.

The math is a simple multiplication: watts become kilowatts, times the hours,
times the price per kWh.

```
energy (kWh)    = (power / 1000) * hours
energy cost     = energy (kWh) * cost per kWh
```

## Numeric example

A part that takes 5 hours on a 250 W printer, with energy at R$ 0.80 per kWh:

```
energy      = (250 / 1000) * 5 = 1.25 kWh
cost        = 1.25 * 0.80      = R$ 1.00
```

Five hours of machine time for R$ 1.00. That is why power is rarely the problem
in a quote — and also why it is the first thing people forget. At a hundred
parts, that is R$ 100 nobody put in the price.

If the power or the time changes, the cost moves in the same proportion: a
10-hour part on the same machine costs R$ 2.00 in energy; a 500 W machine would
make the same 5-hour part cost R$ 2.00 as well.

## Printer selection

At the **Detailed** level (and only on the FDM tab), the section gains a printer
picker. It lists the printers registered in the catalog — each with brand, power
and value — and choosing one **fills the power field automatically** with that
machine's data.

The point is not saving typing: it is **consistency**. If you know the workshop's
Ender 3 draws an average of 250 W, catalog it once and every estimate uses that
number, instead of whatever you remembered at the moment. With the right printer
selected, the power field reflects reality — and quotes become comparable to
each other.

## The warm-up adjustment

At the **Complete** level two fields refine the energy math: the warm-up time
and the extra power percentage during it. The machine draws more while heating
up than during the rest of the print, and these fields add that excess to the
bill.

For most quotes the difference is a few cents — a handful of minutes at peak
power on a 250 W printer. It exists for anyone who wants the energy bill exact,
but it does not change the structure of the math: it is still kWh times the
price per kWh.

## The boundary with the machine section

The split between `print` and `machine` is intentional and worth understanding:

- **`print`** is **variable per part** — it depends on the time and power this
  specific part demanded. Bigger part, more hours, more energy.
- **`machine`** is **fixed per hour** — it takes the printer's price, divides it
  by its total lifetime hours and yields a cost per hour. The hours the part
  uses multiply that value.

That is why a 5-hour part always has the same energy cost (given the same
power), but a machine cost that **depends on how many hours the printer has
already worked that month**. Once you enable the machine section, the hour is no
longer free — and long parts start costing proportionally more than just double
the machine time.

## Common pitfalls

- **Using peak power.** A printer with a 350 W peak may run at 150 W most of the
  time. The field asks for the average; using the peak inflates all the energy.
- **Confusing machine time with total time.** The slicer gives the print time;
  removing from the plate, washing, curing and finishing belong in `labor`.
- **Forgetting to update the electric bill.** The kWh price rises; if the field
  keeps the old value, every estimate lands slightly below reality.
