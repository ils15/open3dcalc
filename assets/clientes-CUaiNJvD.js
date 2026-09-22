var e=`clientes`,t=`en-US`,n={title:`Customers`,order:22},r=[{depth:1,text:`Customers`,slug:`user-content-customers`},{depth:2,text:`The record`,slug:`user-content-the-record`},{depth:2,text:`Why keep this here`,slug:`user-content-why-keep-this-here`},{depth:2,text:`Linking to a quote`,slug:`user-content-linking-to-a-quote`},{depth:2,text:`Tracking the history`,slug:`user-content-tracking-the-history`},{depth:2,text:`Importing and exporting`,slug:`user-content-importing-and-exporting`},{depth:2,text:`Common pitfalls`,slug:`user-content-common-pitfalls`},{depth:2,text:`Example: what the history reveals`,slug:`user-content-example-what-the-history-reveals`}],i=`<h1 id="user-content-customers">Customers</h1>
<p>The <strong>Customers</strong> tab is the record of who receives your proposals. Name,
contact details and notes — little more than that, but in the right place.</p>
<p>Without it, your quote history turns into a pile of numbers with no owner.
With it, you know how many proposals each customer received, what each was
worth, and what the answer was.</p>
<h2 id="user-content-the-record">The record</h2>
<p>Each customer has:</p>
<ul>
<li><strong>Name</strong> — required, it is what shows in the list and on the quote</li>
<li><strong>Company</strong> — optional, useful when someone buys for a business</li>
<li><strong>Email</strong> — optional, but validated: <code>joao@empresa</code> is rejected, it needs a
full domain such as <code>joao@empresa.com</code></li>
<li><strong>Phone</strong></li>
<li><strong>Address</strong></li>
<li><strong>Notes</strong> — whatever helps: preferences, agreements, who referred them</li>
</ul>
<p>Email is the only validated field. Fill the rest as you like — a customer can
exist with just a name and a WhatsApp number.</p>
<h2 id="user-content-why-keep-this-here">Why keep this here</h2>
<p>A quote is a document, and a document needs a recipient. When the customer is
registered, you pick them from a dropdown instead of typing; when they are
not, the quote goes out with no customer — and gets lost in the list.</p>
<p>The record also keeps history. Each customer shows <strong>how many quotes</strong> they
have already received, and search filters by name, company or email. In a
minute you can answer "how much have I proposed to Centro Modelos this year?"
without opening a single spreadsheet.</p>
<h2 id="user-content-linking-to-a-quote">Linking to a quote</h2>
<p>The flow is simple:</p>
<ol>
<li>register the customer here, with a name and at least one contact channel</li>
<li>in <a href="#user-content-quotes">Quotes</a>, open the quote and pick the
customer from the dropdown</li>
<li>save — the quote stores the link plus a <strong>copy</strong> of the contact details</li>
<li>the customer's quote counter goes up on its own</li>
</ol>
<p>The copy is intentional: fix the customer's email tomorrow and the older
quotes still carry the contact that was current when they were sent. The link
(the id) keeps pointing at the up-to-date record; what freezes is the text of
the document.</p>
<h2 id="user-content-tracking-the-history">Tracking the history</h2>
<p>The list shows each customer with their quote counter, and search accepts
name, company or email. Edit and delete sit right there — deleting asks for
confirmation, because linked quotes still exist, they just lose the link.</p>
<h2 id="user-content-importing-and-exporting">Importing and exporting</h2>
<p>The whole record set can be exported as JSON for backup and imported back on
another machine. Export is blocked in the demo session, like in the other
tabs — the badge tells you when that applies.</p>
<h2 id="user-content-common-pitfalls">Common pitfalls</h2>
<p>Four catalog mistakes, and each one quietly weakens the history.</p>
<ul>
<li><strong>Leaving the customer off the quote.</strong> With no link, the proposal gets lost in the list and
nobody can answer "how much have I already proposed to this customer?". The record exists so
the dropdown can exist.</li>
<li><strong>Registering the same person twice.</strong> Without the company, two "Johns" sit loose; the quote
counter splits between the copies and the history loses its bite. The company field exists
to tell identical names apart.</li>
<li><strong>Expecting a record edit to rewrite a sent quote.</strong> The link points at the current record,
but the document's text is a frozen copy. Fixing the email today does not change what the
customer received yesterday.</li>
<li><strong>Deleting the customer to clean the list.</strong> Deletion asks for confirmation because linked
quotes still exist, they just lose the link. Instead of deleting, use the search.</li>
</ul>
<h2 id="user-content-example-what-the-history-reveals">Example: what the history reveals</h2>
<p>You register <strong>Centro Modelos</strong> (company) with Joana as the contact. Over the
next two months you produce four quotes linked to her:</p>
<ul>
<li><code>#001</code> Batch of parts — <strong>R$ 145.73</strong> — Approved</li>
<li><code>#004</code> Protective cases — <strong>R$ 320.00</strong> — Approved</li>
<li><code>#007</code> Batch of mounts — <strong>R$ 89.00</strong> — Sent</li>
<li><code>#009</code> Single part — <strong>R$ 58.00</strong> — Rejected</li>
</ul>
<p>In the Customers tab, Centro Modelos shows a counter of <strong>4</strong>. Adding the two
approved ones gives <strong>R$ 465.73</strong> in confirmed orders from a single customer —
information that changes how you handle her next quote: a customer who bought
twice deserves a faster reply and better terms than a stranger.</p>
<p>It is also the cheapest warning available: of the <strong>R$ 612.73</strong> proposed,
<strong>R$ 58.00</strong> came back rejected and <strong>R$ 89.00</strong> still awaits an answer.
Looking per customer shows where your pricing gets rejected — before it
becomes a habit.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};