var e=`calculadora`,t=`en-US`,n={title:`Calculator`,order:1,tourId:`calc-basico`},r=[{depth:1,text:`Calculator`,slug:`user-content-calculator`},{depth:2,text:`What it calculates`,slug:`user-content-what-it-calculates`},{depth:2,text:`Three detail levels`,slug:`user-content-three-detail-levels`},{depth:2,text:`The map of the ten sections`,slug:`user-content-the-map-of-the-ten-sections`},{depth:2,text:`The master formula`,slug:`user-content-the-master-formula`},{depth:2,text:`A complete example`,slug:`user-content-a-complete-example`},{depth:2,text:`Workflow`,slug:`user-content-workflow`},{depth:2,text:`Where to start`,slug:`user-content-where-to-start`}],i=`<h1 id="user-content-calculator">Calculator</h1>
<p>The <strong>Calculator</strong> is the core of Open3DCalc. It estimates the cost of a 3D print
from a handful of inputs and breaks the result down into <strong>auditable sections</strong>:
you see exactly how much each part contributes to the total, with no black boxes.</p>
<p>The philosophy is simple: <strong>cost is a sum, not a guess</strong>. Every number on the
screen has a traceable origin — a field you filled in and a known formula. If
the final price looks high, the calculator shows you which section is weighing
it down, instead of hiding the problem inside a lump "total".</p>
<h2 id="user-content-what-it-calculates">What it calculates</h2>
<p>The calculator answers two separate questions, always in this order:</p>
<ol>
<li><strong>How much does this part cost to exist?</strong> It is the sum of everything you
consume to produce it: material, power, machine wear, labor, failures and
the workshop's fixed costs.</li>
<li><strong>How much should it sell for?</strong> On top of the production cost you apply the
margin, taxes and marketplace fees — and the sale price appears next to the
cost, never on its own.</li>
</ol>
<p>Keeping these two sums separate is what turns margin into a <strong>conscious
choice</strong>. When cost and sale price sit side by side, you decide whether to earn
more by raising the margin or by cutting a real cost.</p>
<h2 id="user-content-three-detail-levels">Three detail levels</h2>
<p>Not every quote needs every section. That is why the calculator has three
levels, and each one reveals more sections:</p>
<ul>
<li><strong>Quick</strong> — four sections: <code>material</code>, <code>print</code>, <code>sales</code> and <code>results</code>. Enough
for a 30-second estimate.</li>
<li><strong>Detailed</strong> — adds the <code>failure</code> section, for anyone with a history of
spoiled prints who wants to price it in.</li>
<li><strong>Complete</strong> — reveals all ten sections, including <code>hardware</code>, <code>machine</code>,
<code>fixedCost</code>, <code>labor</code> and <code>ops</code>. Full control over every parameter.</li>
</ul>
<p>The logic is gradual: the <strong>Quick</strong> level covers the path from filament to sale
price; <strong>Detailed</strong> turns on failure accounting; <strong>Complete</strong> opens the whole
spreadsheet.</p>
<p><strong>Switching levels never clears anything.</strong> The fields you already filled in
stay right where they are — you only stop seeing the sections the current level
hides. Start on Quick to close a fast price, then level up when you need
precision.</p>
<h2 id="user-content-the-map-of-the-ten-sections">The map of the ten sections</h2>
<p>Each section is an independent block that computes one part of the total. This
is what each one does:</p>
<ul>
<li><a href="#user-content-material"><strong>material</strong></a> — how much filament or resin the part
consumes, and what that costs.</li>
<li><a href="#user-content-print"><strong>print</strong></a> — the print time and the power the machine
draws.</li>
<li><a href="#user-content-failure"><strong>failure</strong></a> — failures and rework turned into cost,
by percentage or fixed amount.</li>
<li><a href="#user-content-hardware"><strong>hardware</strong></a> — wear on the nozzle, the build plate
and the LCD (for resin).</li>
<li><a href="#user-content-machine"><strong>machine</strong></a> — printer depreciation and maintenance,
split across hours of use.</li>
<li><a href="#user-content-fixedcost"><strong>fixedCost</strong></a> — rent, internet and baseline power,
distributed over productive hours.</li>
<li><a href="#user-content-labor"><strong>labor</strong></a> — setup and post-processing time multiplied
by your hourly rate.</li>
<li><a href="#user-content-ops"><strong>ops</strong></a> — PPE, the slicer license, the model file and
other operational supplies.</li>
<li><a href="#user-content-sales"><strong>sales</strong></a> — packaging, shipping, taxes, marketplace
fees and your margin: the section that builds the sale price.</li>
<li><a href="#user-content-results"><strong>results</strong></a> — consolidates everything and shows cost,
profit and final price side by side.</li>
</ul>
<p>The first four in this map have their own Wiki articles, with the full formula
and worked examples. The rest arrive in later waves — for now, the <code>results</code>
section already displays the sum of all of them.</p>
<h2 id="user-content-the-master-formula">The master formula</h2>
<p>Everything the calculator does fits in three lines. Production cost adds up the
consumption sections; total cost adds failures and logistics; and the sale price
applies margin and taxes on top of that base:</p>
<pre><code>production cost = material + print + hardware + machine
                + fixedCost + labor + ops

total cost      = production + failure + packaging + shipping

sale price      = total cost + margin
                + taxes and marketplace fees
</code></pre>
<p>Note that <code>sales</code> is the only section that is <strong>not a cost</strong>: packaging and
shipping add to the total, but margin, taxes and fees are applied <strong>on top</strong> of
it. That is why the sale price grows differently from the cost — and why the
<code>results</code> section exists, to make that difference visible.</p>
<h2 id="user-content-a-complete-example">A complete example</h2>
<p>A decorative PLA part, 50 g, 5 hours of printing, 100% margin:</p>
<pre><code>material    50 g at R$ 125/kg (98% efficiency)  = R$  6.38
print       5 h at 250 W, R$ 0.80/kWh           = R$  1.00
machine + hardware + labor + ops (example)     = R$  3.00
                              production cost  = R$ 10.38
failure     10% rework                         = R$  1.04
packaging + shipping                           = R$  3.00
                                    total cost = R$ 14.42
margin      100% over total cost               = R$ 14.42
taxes + marketplace (25%)                      = R$  9.61
                              sale price       = R$ 38.45
</code></pre>
<p>The math behind the taxes is explained in the <a href="#user-content-sales">sales</a>
article; what matters here is that every line traces back to a section. If the
customer finds it expensive, you know exactly where the R$ 14.42 of cost lives
and can act on it — instead of adjusting the price blindly.</p>
<h2 id="user-content-workflow">Workflow</h2>
<p>The recommended path, from the first number to the final price:</p>
<ol>
<li><strong>Pick the level</strong> and the tab (FDM or resin). Start on Quick if you are in a
hurry; the level never locks you out later.</li>
<li><strong>Fill the <code>material</code> section</strong> with the type, cost per kg and part weight.
If the filament is cataloged in the inventory, picking the spool fills the
values automatically.</li>
<li><strong>Fill the <code>print</code> section</strong> with the slicer's time, the printer's power draw
and your cost per kWh.</li>
<li><strong>Check the <code>results</code> section</strong> — it already shows a cost and a sale price
with the default margin.</li>
<li><strong>Tune the <code>sales</code> section</strong> — the margin is your declared profit. Move it up
or down with the market; the sale price updates instantly.</li>
<li><strong>Level up if needed</strong> — enable <code>failure</code> to include losses, or go Complete
to apportion machine, labor and fixed costs.</li>
<li><strong>Save or export</strong> — the estimate becomes a product in the inventory or a
quote line item, and the history keeps the numbers for the next part.</li>
</ol>
<h2 id="user-content-where-to-start">Where to start</h2>
<p>If you have never used the calculator, do this: open it on the <strong>Quick</strong> level,
fill in only <code>material</code> and <code>print</code>, and look at <code>results</code>. That is already an
honest quote. Most pricing mistakes do not happen because of missing sections —
they happen when the margin is applied without knowing the cost. Start with the
cost; leave the advanced sections for when they start affecting your wallet.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};