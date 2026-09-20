---
title: Quotes
order: 21
tourId: orcamentos-clientes
---

# Quotes

The **Quotes** tab turns an estimate into a document: with a number, a
customer, a validity date and a status. It is what you send, what you file,
and what you check later to recall what was agreed with each customer.

Every quote is built from estimates that already exist in the app — it does
not recalculate anything, it only organizes what the
[Calculator](#user-content-calculator) already produced.

## From calculation to document

The full flow:

1. estimate the part in the **Calculator** tab and save it to **History**
2. in **Quotes**, open **New Quote** and give it a title
3. add items straight from History and adjust quantities and discounts
4. pick the customer, the validity date and the payment terms
5. save — the quote is born as a **Draft**, with its own sequential number

The number is automatic and continuous: `Quote #001`, `#002`, `#003`. There
is no gap when you delete one — the sequence only moves forward.

## Items come from History

A quote does not let you type a price from memory. You add items directly from
the estimates saved in History, and each item's **unit price** is that
estimate's sale price.

From there everything is editable: the quantity, the unit price and a
percentage discount for that item alone. If the original estimate said
R$ 42.70 but you closed at R$ 45.00, just fix it on the line — the quote
reflects what was agreed, not the estimate.

## What the quote carries

Besides the items, the form stores:

- **Title**, which identifies the quote in the list and in search
- **Customer**, optional — see [Clientes](#user-content-customers)
- **Valid until**, the date the proposal expires
- **Payment terms**, such as "50% upfront, 50% on delivery"
- **Delivery estimate**, in days or as an agreed date
- **Notes**, free text shown in the document footer
- **Global discount**, a percentage applied to the whole subtotal

## Discounts and totals

The footer numbers are computed automatically:

```
subtotal       = sum of (quantity * unit price) for every item
discount       = subtotal * global discount / 100
total          = subtotal - discount
```

Discounts come in two shapes: per item (on the line itself) or global (over
everything). Both stack, and the app always shows the discount in money, not
just as a percentage — so you feel the size of the cut before sending.

## The four statuses

Every quote has a status, shown as a colored badge and editable right in the
document:

- **Draft** — created and not yet sent. This is the initial state.
- **Sent** — you sent it to the customer and are waiting for a reply.
- **Approved** — the customer accepted; that is the signal to produce.
- **Rejected** — the customer declined; it stands as a record for renegotiating.

Status is your commitment to reality, not an automatic notice: the app does
not send email and does not know whether the customer read it. When you
change the status, you are noting what happened.

## The quote is a snapshot

The moment you save, the quote freezes three things: each item's price, the
customer's details (name, company, email and phone) and the terms. That
portrait travels with the document.

That is why recalculating the part in the calculator does **not** rewrite a
quote already saved. If filament prices rise, the new estimate comes out
higher, but the quote the customer received still says what was agreed.

```
quote = estimate + customer + validity + status (frozen at save time)
```

This is on purpose. Without the snapshot, any calculator tweak would rewrite
documents already sent, and what the customer holds would stop matching what
you see in the app.

## Exporting the PDF

Open any quote and use **Export PDF** to generate a print-ready file, already
named `orcamento_001.pdf`. Exporting is blocked during a demo session — the
badge next to the button warns you when that is the case.

## Tracking the list

The tab lists every quote with its status and totals, and search filters by
title or customer name. Deleting asks for confirmation, because that quote's
number will never be handed out again.

## End-to-end example

1. You estimate a **N20 motor mount**: suggested sale price R$ 42.70. Save it
   to History.
2. You also estimate a **Raspberry case**: R$ 68.00. Save it.
3. Open **New Quote**, title "Batch of parts — Centro Modelos".
4. Add the mount, quantity 2: R$ 85.40.
5. Add the case, quantity 1: R$ 68.00.
6. Subtotal: **R$ 153.40**. Apply a 5% global discount: R$ 7.67.
7. Total: **R$ 145.73**, valid for 30 days, paid in two installments.
8. Save. It becomes `Quote #001` as a Draft.
9. Send it to the customer and switch the status to **Sent**.
10. The customer accepts: status **Approved**. Time to produce.

Six months later, quote #001 still reads R$ 145.73 — even if you have
recalculated that part dozens of times since.
