var e=`sales`,t=`en-US`,n={title:`Additional Costs and Sales`,order:18},r=[{depth:1,text:`Additional Costs and Sales`,slug:`user-content-additional-costs-and-sales`},{depth:2,text:`The fields`,slug:`user-content-the-fields`},{depth:2,text:`The sale price formula`,slug:`user-content-the-sale-price-formula`},{depth:2,text:`A complete numeric example`,slug:`user-content-a-complete-numeric-example`},{depth:2,text:`The markup presets`,slug:`user-content-the-markup-presets`},{depth:2,text:`Conscious margin vs. hidden rounding`,slug:`user-content-conscious-margin-vs-hidden-rounding`},{depth:2,text:`Common pitfalls`,slug:`user-content-common-pitfalls`}],i=`<h1 id="user-content-additional-costs-and-sales">Additional Costs and Sales</h1>
<p>The <strong>sales</strong> section is the only one in the calculator that <strong>is not a cost</strong>.
Every other section adds up money you already spent; <code>sales</code> answers a different
question: given the cost, <strong>how much should this part sell for?</strong> This is where
margin, taxes and marketplace fees meet — and it is why its result shows up in
the sale price, not in the cost.</p>
<p>The split is the core of the calculator's philosophy: <strong>cost is fact, price is
decision</strong>. The cost exists whether you sell or not; the price is built. When
the <code>results</code> section puts both side by side, the margin stops being a hidden
rounding and becomes a visible lever.</p>
<h2 id="user-content-the-fields">The fields</h2>
<p>The section mixes logistics, fees and profit:</p>
<ul>
<li><strong>Quantity</strong> — how many identical units will be produced. Setup cost is split
across the units, and the value flows into the quote export.</li>
<li><strong>Infill percentage</strong> — how much of the interior is filled. Helps estimate
material use: 15% for decorative parts, 50% or more for functional ones.</li>
<li><strong>Extras</strong> — screws, glue, varnish, paint: everything that goes into the part
beyond the plastic.</li>
<li><strong>Packaging</strong> — box, bubble wrap, tape.</li>
<li><strong>Shipping</strong> — the cost of delivery to the customer.</li>
<li><strong>Marketplace</strong> — the sales platform, picked from the catalog. Each one carries
its own percentage fee, filled in automatically.</li>
<li><strong>Taxes</strong> — taxes over the sale amount (ICMS, ISS, Simples Nacional).</li>
<li><strong>Profit margin</strong> — the desired profit percentage over the total cost.</li>
</ul>
<h2 id="user-content-the-sale-price-formula">The sale price formula</h2>
<p>The mechanics are less obvious than they look, and worth understanding. First
the base is closed: production cost plus failures plus packaging plus shipping.
On top of that base the margin is applied. Only then do taxes and fees enter —
but in a special way, <strong>by division</strong>, so they do not eat your profit:</p>
<pre><code>base cost       = production + failures + packaging + shipping
profit          = base cost * (margin / 100)
price w/o fees  = base cost + profit
sale price      = price w/o fees / (1 - (taxes + marketplace fee) / 100)
</code></pre>
<p>The division is not a technicality: it is what makes the margin <strong>honored</strong>.
Because the fees are computed inside the final price, the profit left at the end
is exactly the percentage you declared — not a cent less.</p>
<h2 id="user-content-a-complete-numeric-example">A complete numeric example</h2>
<p>A part with a R$ 20.00 production cost, R$ 2.00 in failures, R$ 2.00 in packaging
and R$ 1.00 in shipping, sold on a platform with a 10% fee, with 15% in taxes and
a 100% margin:</p>
<pre><code>base cost       = 20 + 2 + 2 + 1        = R$ 25.00
profit (100%)   = 25 * 1.00             = R$ 25.00
price w/o fees  = 25 + 25               = R$ 50.00
total fee rate  = 15 + 10               = 25%
sale price      = 50 / (1 - 0.25)       = R$ 66.67
</code></pre>
<p>Checking what is left:</p>
<pre><code>taxes (15%)     = 66.67 * 0.15          = R$ 10.00
marketplace(10%)= 66.67 * 0.10          = R$  6.67
net profit      = 66.67 - 25 - 10 - 6.67 = R$ 25.00
</code></pre>
<p>The net profit is exactly the R$ 25.00 of the margin. If the taxes were added
naively (R$ 50 + 25% = R$ 62.50), the real fees on that sale would be R$ 15.63 —
and the profit would fall to under R$ 22.00, below the R$ 25.00 you declared. The
division formula exists so the margin is a promise that holds.</p>
<h2 id="user-content-the-markup-presets">The markup presets</h2>
<p>Next to the margin field are buttons with ready-made percentages: 100%, 150%,
200%, 250%, 300% and 500%. These are the <strong>markup presets</strong> — shortcuts that fill
the margin with one tap, for cases where you want to apply a known markup instead
of typing a value.</p>
<p>They are pure input: clicking 200% is the same as typing 200 in the margin field,
and changing the value afterward clears the button's highlight. What they really
save is the reasoning — for anyone selling wholesale, for instance, 100% over
cost is a standard markup repeated across every quote.</p>
<h2 id="user-content-conscious-margin-vs-hidden-rounding">Conscious margin vs. hidden rounding</h2>
<p>The difference between pricing well and pricing poorly is the order of the sums:</p>
<ul>
<li><strong>Conscious margin</strong>: you know the cost, you choose the margin, and the price
follows. If the market pushes back, you know whether the problem is the cost or
the margin — and you can move either one.</li>
<li><strong>Hidden rounding</strong>: you pick a price that "feels right" and the profit is
whatever is left. It works until nothing is left, and you cannot tell why.</li>
</ul>
<p>The calculator is built to force the first path: the <code>results</code> section always
shows cost, profit and sale price together, precisely so the margin never hides
behind the final price. When that trio is on the same screen, it becomes
impossible to pretend you do not know where the money comes from.</p>
<h2 id="user-content-common-pitfalls">Common pitfalls</h2>
<p>Four pitfalls live in this section, and each one shrinks the profit without showing in the price.</p>
<ul>
<li><strong>A margin that is too low "to sell more."</strong> If the margin does not cover the
failures and the fixed costs you never apportioned, selling more only scales
the loss.</li>
<li><strong>Forgetting the marketplace fee.</strong> Ten percent of the price is far more than
ten percent of the cost; leaving the field at zero is a gift to the platform.</li>
<li><strong>Packaging and shipping outside the base.</strong> They add to the cost before the
margin — R$ 3.00 of shipping left unrated is profit that vanishes on every sale.</li>
<li><strong>Margin over the price instead of the cost.</strong> The margin here is markup over
cost. 100% means selling for twice the cost — not "100% of the price as
profit," which would be a different number.</li>
</ul>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};