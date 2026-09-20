---
title: Customers
order: 22
---

# Customers

The **Customers** tab is the record of who receives your proposals. Name,
contact details and notes — little more than that, but in the right place.

Without it, your quote history turns into a pile of numbers with no owner.
With it, you know how many proposals each customer received, what each was
worth, and what the answer was.

## The record

Each customer has:

- **Name** — required, it is what shows in the list and on the quote
- **Company** — optional, useful when someone buys for a business
- **Email** — optional, but validated: `joao@empresa` is rejected, it needs a
  full domain such as `joao@empresa.com`
- **Phone**
- **Address**
- **Notes** — whatever helps: preferences, agreements, who referred them

Email is the only validated field. Fill the rest as you like — a customer can
exist with just a name and a WhatsApp number.

## Why keep this here

A quote is a document, and a document needs a recipient. When the customer is
registered, you pick them from a dropdown instead of typing; when they are
not, the quote goes out with no customer — and gets lost in the list.

The record also keeps history. Each customer shows **how many quotes** they
have already received, and search filters by name, company or email. In a
minute you can answer "how much have I proposed to Centro Modelos this year?"
without opening a single spreadsheet.

## Linking to a quote

The flow is simple:

1. register the customer here, with a name and at least one contact channel
2. in [Quotes](#user-content-orcamentos), open the quote and pick the
   customer from the dropdown
3. save — the quote stores the link plus a **copy** of the contact details
4. the customer's quote counter goes up on its own

The copy is intentional: fix the customer's email tomorrow and the older
quotes still carry the contact that was current when they were sent. The link
(the id) keeps pointing at the up-to-date record; what freezes is the text of
the document.

## Tracking the history

The list shows each customer with their quote counter, and search accepts
name, company or email. Edit and delete sit right there — deleting asks for
confirmation, because linked quotes still exist, they just lose the link.

## Importing and exporting

The whole record set can be exported as JSON for backup and imported back on
another machine. Export is blocked in the demo session, like in the other
tabs — the badge tells you when that applies.

## Example: what the history reveals

You register **Centro Modelos** (company) with Joana as the contact. Over the
next two months you produce four quotes linked to her:

- `#001` Batch of parts — **R$ 145.73** — Approved
- `#004` Protective cases — **R$ 320.00** — Approved
- `#007` Batch of mounts — **R$ 89.00** — Sent
- `#009` Single part — **R$ 58.00** — Rejected

In the Customers tab, Centro Modelos shows a counter of **4**. Adding the two
approved ones gives **R$ 465.73** in confirmed orders from a single customer —
information that changes how you handle her next quote: a customer who bought
twice deserves a faster reply and better terms than a stranger.

It is also the cheapest warning available: of the **R$ 612.73** proposed,
**R$ 58.00** came back rejected and **R$ 89.00** still awaits an answer.
Looking per customer shows where your pricing gets rejected — before it
becomes a habit.
