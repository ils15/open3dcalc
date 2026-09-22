var e=`orcamentos`,t=`en-US`,n={title:`Quotes`,order:21,tourId:`orcamentos-clientes`},r=[{depth:1,text:`Quotes`,slug:`user-content-quotes`},{depth:2,text:`From calculation to document`,slug:`user-content-from-calculation-to-document`},{depth:2,text:`Items come from History`,slug:`user-content-items-come-from-history`},{depth:2,text:`What the quote carries`,slug:`user-content-what-the-quote-carries`},{depth:2,text:`Discounts and totals`,slug:`user-content-discounts-and-totals`},{depth:2,text:`The four statuses`,slug:`user-content-the-four-statuses`},{depth:2,text:`The quote is a snapshot`,slug:`user-content-the-quote-is-a-snapshot`},{depth:2,text:`Exporting the PDF`,slug:`user-content-exporting-the-pdf`},{depth:2,text:`Tracking the list`,slug:`user-content-tracking-the-list`},{depth:2,text:`Common pitfalls`,slug:`user-content-common-pitfalls`},{depth:2,text:`End-to-end example`,slug:`user-content-end-to-end-example`}],i=`<h1 id="user-content-quotes">Quotes</h1>
<p>The <strong>Quotes</strong> tab turns an estimate into a document: with a number, a
customer, a validity date and a status. It is what you send, what you file,
and what you check later to recall what was agreed with each customer.</p>
<p>Every quote is built from estimates that already exist in the app — it does
not recalculate anything, it only organizes what the
<a href="#user-content-calculator">Calculator</a> already produced.</p>
<h2 id="user-content-from-calculation-to-document">From calculation to document</h2>
<p>The full flow:</p>
<ol>
<li>estimate the part in the <strong>Calculator</strong> tab and save it to <strong>History</strong></li>
<li>in <strong>Quotes</strong>, open <strong>New Quote</strong> and give it a title</li>
<li>add items straight from History and adjust quantities and discounts</li>
<li>pick the customer, the validity date and the payment terms</li>
<li>save — the quote is born as a <strong>Draft</strong>, with its own sequential number</li>
</ol>
<p>The number is automatic and continuous: <code>Quote #001</code>, <code>#002</code>, <code>#003</code>. There
is no gap when you delete one — the sequence only moves forward.</p>
<h2 id="user-content-items-come-from-history">Items come from History</h2>
<p>A quote does not let you type a price from memory. You add items directly from
the estimates saved in History, and each item's <strong>unit price</strong> is that
estimate's sale price.</p>
<p>From there everything is editable: the quantity, the unit price and a
percentage discount for that item alone. If the original estimate said
R$ 42.70 but you closed at R$ 45.00, just fix it on the line — the quote
reflects what was agreed, not the estimate.</p>
<h2 id="user-content-what-the-quote-carries">What the quote carries</h2>
<p>Besides the items, the form stores:</p>
<ul>
<li><strong>Title</strong>, which identifies the quote in the list and in search</li>
<li><strong>Customer</strong>, optional — see <a href="#user-content-customers">Clientes</a></li>
<li><strong>Valid until</strong>, the date the proposal expires</li>
<li><strong>Payment terms</strong>, such as "50% upfront, 50% on delivery"</li>
<li><strong>Delivery estimate</strong>, in days or as an agreed date</li>
<li><strong>Notes</strong>, free text shown in the document footer</li>
<li><strong>Global discount</strong>, a percentage applied to the whole subtotal</li>
</ul>
<h2 id="user-content-discounts-and-totals">Discounts and totals</h2>
<p>The footer numbers are computed automatically:</p>
<pre><code>subtotal       = sum of (quantity * unit price) for every item
discount       = subtotal * global discount / 100
total          = subtotal - discount
</code></pre>
<p>Discounts come in two shapes: per item (on the line itself) or global (over
everything). Both stack, and the app always shows the discount in money, not
just as a percentage — so you feel the size of the cut before sending.</p>
<h2 id="user-content-the-four-statuses">The four statuses</h2>
<p>Every quote has a status, shown as a colored badge and editable right in the
document:</p>
<ul>
<li><strong>Draft</strong> — created and not yet sent. This is the initial state.</li>
<li><strong>Sent</strong> — you sent it to the customer and are waiting for a reply.</li>
<li><strong>Approved</strong> — the customer accepted; that is the signal to produce.</li>
<li><strong>Rejected</strong> — the customer declined; it stands as a record for renegotiating.</li>
</ul>
<p>Status is your commitment to reality, not an automatic notice: the app does
not send email and does not know whether the customer read it. When you
change the status, you are noting what happened.</p>
<h2 id="user-content-the-quote-is-a-snapshot">The quote is a snapshot</h2>
<p>The moment you save, the quote freezes three things: each item's price, the
customer's details (name, company, email and phone) and the terms. That
portrait travels with the document.</p>
<p>That is why recalculating the part in the calculator does <strong>not</strong> rewrite a
quote already saved. If filament prices rise, the new estimate comes out
higher, but the quote the customer received still says what was agreed.</p>
<pre><code>quote = estimate + customer + validity + status (frozen at save time)
</code></pre>
<p>This is on purpose. Without the snapshot, any calculator tweak would rewrite
documents already sent, and what the customer holds would stop matching what
you see in the app.</p>
<h2 id="user-content-exporting-the-pdf">Exporting the PDF</h2>
<p>Open any quote and use <strong>Export PDF</strong> to generate a print-ready file, already
named <code>orcamento_001.pdf</code>. Exporting is blocked during a demo session — the
badge next to the button warns you when that is the case.</p>
<h2 id="user-content-tracking-the-list">Tracking the list</h2>
<p>The tab lists every quote with its status and totals, and search filters by
title or customer name. Deleting asks for confirmation, because that quote's
number will never be handed out again.</p>
<h2 id="user-content-common-pitfalls">Common pitfalls</h2>
<p>Four mistakes happen while assembling the document, and all of them surface only after it is sent.</p>
<ul>
<li><strong>Typing the price from memory.</strong> The unit price is editable, and adjusting R$ 42.70 to
R$ 45.00 is correct when that was agreed. But typing a price with no estimate behind it
loses the trail of the cost — the item comes from History precisely so the price is born
from a calculation.</li>
<li><strong>Forgetting that discounts stack.</strong> A discount on the line and a global one add up, and the
app shows the total in money. Anyone looking only at the percentages underestimates the size
of the cut before sending.</li>
<li><strong>Recalculating the part and expecting the quote to follow.</strong> The quote is a snapshot: prices,
customer details and terms freeze at save time. If filament prices rise, the new estimate
comes out higher and the document still says what was agreed.</li>
<li><strong>Deleting drafts to reorganize the numbering.</strong> The sequence is automatic and continuous,
and deleting one leaves no gap — that number is never handed out again. The deletion
confirmation exists for that reason.</li>
</ul>
<h2 id="user-content-end-to-end-example">End-to-end example</h2>
<p>A real example shows the path: from the first estimate to an approved document, with every number.</p>
<ol>
<li>You estimate a <strong>N20 motor mount</strong>: suggested sale price R$ 42.70. Save it
to History.</li>
<li>You also estimate a <strong>Raspberry case</strong>: R$ 68.00. Save it.</li>
<li>Open <strong>New Quote</strong>, title "Batch of parts — Centro Modelos".</li>
<li>Add the mount, quantity 2: R$ 85.40.</li>
<li>Add the case, quantity 1: R$ 68.00.</li>
<li>Subtotal: <strong>R$ 153.40</strong>. Apply a 5% global discount: R$ 7.67.</li>
<li>Total: <strong>R$ 145.73</strong>, valid for 30 days, paid in two installments.</li>
<li>Save. It becomes <code>Quote #001</code> as a Draft.</li>
<li>Send it to the customer and switch the status to <strong>Sent</strong>.</li>
<li>The customer accepts: status <strong>Approved</strong>. Time to produce.</li>
</ol>
<p>Six months later, quote #001 still reads R$ 145.73 — even if you have
recalculated that part dozens of times since.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};