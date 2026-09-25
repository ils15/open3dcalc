var e=`results`,t=`en-US`,n={title:`Results`,order:19},r=[{depth:1,text:`Results`,slug:`user-content-results`},{depth:2,text:`Real margin vs. markup`,slug:`user-content-real-margin-vs-markup`},{depth:2,text:`The order of the sum matters`,slug:`user-content-the-order-of-the-sum-matters`},{depth:2,text:`Key figures in the result`,slug:`user-content-key-figures-in-the-result`},{depth:2,text:`Complete numeric example`,slug:`user-content-complete-numeric-example`},{depth:2,text:`The lesson hidden in the example`,slug:`user-content-the-lesson-hidden-in-the-example`},{depth:2,text:`Target margin mode and custom price`,slug:`user-content-target-margin-mode-and-custom-price`},{depth:2,text:`Monthly projection and batches`,slug:`user-content-monthly-projection-and-batches`},{depth:2,text:`How this section relates to the others`,slug:`user-content-how-this-section-relates-to-the-others`},{depth:2,text:`When the result is not reliable`,slug:`user-content-when-the-result-is-not-reliable`},{depth:2,text:`Practical pitfalls`,slug:`user-content-practical-pitfalls`}],i=`<h1 id="user-content-results">Results</h1>
<p>The <strong>Results</strong> section is where everything comes together: it takes every cost
from the other sections, sums them in the right order, and answers the three
questions that matter — <strong>how much the part cost</strong>, <strong>how much it should sell
for</strong>, and <strong>what is left as profit</strong>.</p>
<p>Unlike the other advanced sections, results show up at <strong>every</strong> level. What
changes is the detail of the line items; the final consolidation is always
there.</p>
<h2 id="user-content-real-margin-vs-markup">Real margin vs. markup</h2>
<p>The value shown as <strong>Actual Margin</strong> is read-only and calculated over the sale
price:</p>
<pre><code>real margin = profit ÷ sale price × 100
</code></pre>
<p>The <code>profitMarginPercent</code> field, on the other hand, is markup on cost. With
<code>110%</code> markup, a cost of <code>R$ 100,00</code> produces a price of <code>R$ 210,00</code>; the
<code>R$ 110,00</code> profit corresponds to <code>52,38%</code> real margin. The interface repeats
this distinction in five places. Its tooltip says: “Markup: profit over cost.
Margin: profit over the price the customer pays.”</p>
<h2 id="user-content-the-order-of-the-sum-matters">The order of the sum matters</h2>
<p>The selling price is not "cost plus a markup". It is a sequence where each step
adds something different:</p>
<pre><code>productionCost = material + energy + machine + hardware
               + ppe + labor + software + finishing + extras

baseCost = productionCost + failure + packaging + shipping

grossProfit = baseCost * (margin / 100)

priceBeforeFees = baseCost + grossProfit

sellPrice = priceBeforeFees / (1 - (taxes% + fees%) / 100)
</code></pre>
<p>Notice two things. First, <strong>failure</strong> and <strong>logistics</strong> (packaging and
shipping) enter the base cost — you also profit on them. Second, taxes and the
marketplace fee are deducted <strong>from the selling price</strong>, so they raise the final
price instead of lowering your profit.</p>
<h2 id="user-content-key-figures-in-the-result">Key figures in the result</h2>
<p>Four numbers summarize the result, and each one says something different about the part.</p>
<ul>
<li><strong>Total Cost</strong> — how much the part cost to make, including failure, packaging
and shipping. It is the <strong>break-even point</strong>: selling below it is a loss, and
the app warns you.</li>
<li><strong>Sell Price</strong> — the one suggested by the formula. Editable; the actual margin
is recalculated on the spot.</li>
<li><strong>Actual Margin</strong> — net profit over the selling price, not over the cost. It
is always lower than the markup you typed — see the example.</li>
<li><strong>Profit per Hour</strong> — net profit ÷ total hours (print + post + setup). It is
the best metric for deciding whether a job is worth taking.</li>
</ul>
<h2 id="user-content-complete-numeric-example">Complete numeric example</h2>
<p>Let us consolidate the example part used across all articles: a <strong>PLA phone
stand</strong>, 180 g, 5.5 hours of printing, 250 W of power at R$ 0.80 per kWh, an
R$ 1,800 printer depreciated over 36 months at 100 h/month, R$ 30/month of
maintenance, R$ 450 of fixed costs at 150 h/month, 30 minutes of labor at
R$ 25/h, a R$ 30/month slicer, an R$ 5 STL, R$ 2 of PPE per part, 10% failure,
R$ 3 packaging, R$ 8 shipping, 50% markup, 6% taxes and 10% marketplace fee.</p>
<p>Each line, coming from its section:</p>
<pre><code>material    0.18 kg * R$ 90/kg    =  R$ 16.20
energy      1.375 kWh * R$ 0.80   =  R$  1.10
machine     R$ 3.80/h * 5.5 h     =  R$ 20.90
hardware    nozzle + bed + paint  =  R$  3.82
labor       0.5 h * R$ 25         =  R$ 12.50
ops         software + PPE        =  R$  8.65
</code></pre>
<p>Now the consolidation:</p>
<pre><code>productionCost = 16.20 + 1.10 + 20.90 + 3.82 + 12.50 + 8.65 = R$ 63.17

failure (10%)  = 63.17 * 0.10                              =  R$  6.32
packaging                                                         R$  3.00
shipping                                                          R$  8.00
baseCost       = 63.17 + 6.32 + 3.00 + 8.00                 = R$ 80.49

grossProfit    = 80.49 * 0.50                              = R$ 40.24
priceBeforeFees = 80.49 + 40.24                           = R$ 120.73

sellPrice      = 120.73 / (1 - 0.16)                       = R$ 143.73

tax (6%)       = 143.73 * 0.06                             =  R$  8.62
marketplace    = 143.73 * 0.10                             =  R$ 14.37

netProfit      = 143.73 - 80.49 - 8.62 - 14.37            = R$ 40.25
actualMargin   = 40.25 / 143.73                           =   28.0%
</code></pre>
<h2 id="user-content-the-lesson-hidden-in-the-example">The lesson hidden in the example</h2>
<p>You asked for <strong>50% markup</strong> and ended with a <strong>28% actual margin</strong>. Nothing
was miscalculated: the 50% is markup <strong>over cost</strong>, while the actual margin is
over the <strong>selling price</strong> — which is bigger, because taxes and fees inflated
it.</p>
<p>The good news is in the profit: <strong>R$ 40.25</strong>, the 50% gross profit on the base
cost preserved in practice. Not a coincidence: the formula passes taxes and
fees on to the price, so net profit tracks the gross one — the cent of
difference is just rounding of the fees, not of the math. What changes is the
percentage, not the money.</p>
<p>The <strong>profit per hour</strong> here is:</p>
<pre><code>totalHours = (330 + 18 + 12) / 60 = 6.0 h
profitPerHour = 40.25 / 6.0 = R$ 6.71/h
</code></pre>
<p>R$ 6.71 an hour is the number that decides whether this job is worth taking —
far more honest than "50% margin".</p>
<h2 id="user-content-target-margin-mode-and-custom-price">Target margin mode and custom price</h2>
<p>You do not always want to derive the price. Sometimes the customer says "I want
to pay R$ 120" and you need to know whether it is worth it. That is what
<strong>target margin mode</strong> is for: you type the desired selling price and the
calculator shows its real margin, deducting taxes and fees from the typed value.</p>
<p>On our part, a price of R$ 120 would give:</p>
<pre><code>tax = 7.20    marketplace = 12.00
profit = 120 - 80.49 - 7.20 - 12.00 = R$ 20.31
actualMargin = 20.31 / 120 = 16.9%
</code></pre>
<p>If the result falls below the break-even point, the calculator warns you on
screen — the sign that it is better to decline the job than to take a loss.</p>
<h2 id="user-content-monthly-projection-and-batches">Monthly projection and batches</h2>
<p>The section also shows a <strong>monthly projection</strong>: how many parts you sell per
month and what that means in revenue, cost and profit. On our part, at 30 sales
per month:</p>
<pre><code>revenue = 143.73 * 30 = R$ 4,311.90
cost    =  80.49 * 30 = R$ 2,414.70
profit  =  40.25 * 30 = R$ 1,207.50   (annual: R$ 14,490.00)
</code></pre>
<p>For more than one unit, the <strong>setup</strong> cost is diluted across the parts — see
<a href="#user-content-labor">labor</a>. The per-unit price drops and the difference shows
up here.</p>
<h2 id="user-content-how-this-section-relates-to-the-others">How this section relates to the others</h2>
<p>Each line of the result comes from a specific place:</p>
<ul>
<li><a href="#user-content-material">material</a> — the filament consumed.</li>
<li><a href="#user-content-print-parameters">print parameters</a> — time, energy and the printer used.</li>
<li><a href="#user-content-machine-costs">machine</a> — depreciation, maintenance and the
<a href="#user-content-fixed-costs">fixed costs</a> share.</li>
<li><a href="#user-content-hardware-wear">hardware</a> — nozzle, bed, LCD wear and finishing.</li>
<li><a href="#user-content-labor">labor</a> — setup and post-processing.</li>
<li><a href="#user-content-operational--software">ops</a> — software, STL and PPE.</li>
<li><a href="#user-content-additional-costs-and-sales">failure and sales</a> — risk, packaging, shipping, taxes
and margin.</li>
</ul>
<h2 id="user-content-when-the-result-is-not-reliable">When the result is not reliable</h2>
<p><code>R$ 0,00</code> is no longer a fallback for an unknown value. When a non-finite number
reaches the interface, it is shown as <code>—</code> and the calculation is marked as
invalid. This prevents a failure from looking like a real cost.</p>
<p>The difference between <strong>missing data</strong> and <strong>corrupt data</strong> matters:</p>
<ul>
<li>a legacy snapshot without <code>energyCostPerKwh</code> uses the app default;</li>
<li><code>NaN</code>, a negative value, an invalid type, or division by zero produces an
explicit error with the exact field path.</li>
</ul>
<p>The rule is applied before the calculation in seven paths: initial load,
<code>loadHistoryItem</code>, <code>undo</code>, <code>restoreAutoSnapshot</code>, <code>loadSharedCalculation</code>,
setters, and <code>setWithCompute</code>. Opening history, undoing, restoring, sharing, or
editing a value therefore cannot silently turn a failure into zero.</p>
<p>If you see <code>—</code>, open the calculation warning, find the named field, and correct
it. If the problem came from history or a shared calculation, load a valid
configuration or fill in the missing value before using the result. Never
replace an unknown value with <code>0</code>: the price is not reliable while the error is
present.</p>
<h2 id="user-content-practical-pitfalls">Practical pitfalls</h2>
<p>Four misreadings of the result, each capable of making a loss look like good business.</p>
<ol>
<li><strong>Thinking a 50% margin is 50% profit on the price.</strong> As the example shows,
it is 28%. Always read the <strong>actual margin</strong>, not the margin you typed.</li>
<li><strong>Selling at the break-even point.</strong> Total cost is the survival floor, not
the fair price. Selling at it means working for free while still paying tax.</li>
<li><strong>Forgetting that failure also earns margin.</strong> Failure enters the base cost
and gets a margin. That is correct — a part that fails costs more than one
that does not, and the parts that succeed have to pay for the ones that
fail.</li>
<li><strong>Ignoring profit per hour.</strong> A job with R$ 200 of profit over 80 machine
hours yields R$ 2.50/h. The profit in currency looks good; the hourly rate
reveals you would have been better off doing something else.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};