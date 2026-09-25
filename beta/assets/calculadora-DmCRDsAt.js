var e=`calculadora`,t=`en-US`,n={title:`Calculator`,order:1,tourId:`calc-basico`},r=[{depth:1,text:`Calculator`,slug:`user-content-calculator`},{depth:2,text:`What it calculates`,slug:`user-content-what-it-calculates`},{depth:2,text:`Available layouts`,slug:`user-content-available-layouts`},{depth:2,text:`Detail level: Quick, Detailed and Complete`,slug:`user-content-detail-level-quick-detailed-and-complete`},{depth:2,text:`The map of the ten sections`,slug:`user-content-the-map-of-the-ten-sections`},{depth:2,text:`The master formula`,slug:`user-content-the-master-formula`},{depth:2,text:`Rules that prevent misleading numbers`,slug:`user-content-rules-that-prevent-misleading-numbers`},{depth:3,text:`Real margin vs. markup`,slug:`user-content-real-margin-vs-markup`},{depth:3,text:`A missing value is not zero`,slug:`user-content-a-missing-value-is-not-zero`},{depth:3,text:`Demonstration presets removed`,slug:`user-content-demonstration-presets-removed`},{depth:3,text:`Multi-material is temporarily disabled`,slug:`user-content-multi-material-is-temporarily-disabled`},{depth:2,text:`Controls and presentation`,slug:`user-content-controls-and-presentation`},{depth:2,text:`A complete example`,slug:`user-content-a-complete-example`},{depth:2,text:`Workflow`,slug:`user-content-workflow`},{depth:2,text:`Common pitfalls`,slug:`user-content-common-pitfalls`},{depth:2,text:`Where to start`,slug:`user-content-where-to-start`}],i=`<h1 id="user-content-calculator">Calculator</h1>
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
markup, taxes and marketplace fees — and the sale price appears next to the
cost, never on its own.</li>
</ol>
<p>Keeping these two sums separate is what turns margin into a <strong>conscious
choice</strong>. When cost and sale price sit side by side, you decide whether to earn
more by raising the margin or by cutting a real cost.</p>
<h2 id="user-content-available-layouts">Available layouts</h2>
<p>Beta 3 provides three implemented layouts for the same calculator:</p>
<ul>
<li><strong>Classic</strong> — the calculator organized into sections, with navigation and a
detail-level control at the top. Choose this layout for direct access to the
sections and for a familiar workflow.</li>
<li><strong>Guided</strong> — a step-by-step layout for beginners and mobile use. It presents
the estimate as a sequence of questions rather than displaying all sections at once.</li>
<li><strong>Bento Grid</strong> — five cards arranged in a responsive grid. It is no longer a
read-only dashboard: it is an editable calculator with the same fields as
Classic, and its cards feed the real calculation.</li>
</ul>
<p>The layout selector is in the header, and the app remembers the preference. Farm
is on the roadmap and is not available in this beta; there is no fourth layout
to use.</p>
<h2 id="user-content-detail-level-quick-detailed-and-complete">Detail level: Quick, Detailed and Complete</h2>
<p>The <strong>Quick / Detailed / Complete</strong> selector appears at the top of Classic and
Bento. It is the same component and the same state in both layouts: changing the
level in one immediately carries over to the other.</p>
<ul>
<li><strong>Quick</strong> — shows <code>material</code>, <code>print</code>, <code>sales</code> and <code>results</code>, the shortest
path to an estimate.</li>
<li><strong>Detailed</strong> — adds the <code>failure</code> section when you want to include losses and
rework.</li>
<li><strong>Complete</strong> — unlocks all ten sections, including <code>hardware</code>, <code>machine</code>,
<code>fixedCost</code>, <code>labor</code> and <code>ops</code>.</li>
</ul>
<p>Visibility is governed by
<code>isFieldVisibleForLevel(calcLevel, hiddenFields, sectionId, fieldId)</code>. Classic
and Bento share this contract, and it also respects <code>hiddenFields</code>, so choices
about hidden fields are not discarded when you switch layouts.</p>
<p><strong>Changing levels never clears values.</strong> Fields you have already filled stay
stored; only sections or fields hidden by the current level disappear. Start on
Quick and increase the detail when you need it.</p>
<h2 id="user-content-the-map-of-the-ten-sections">The map of the ten sections</h2>
<p>Each section is an independent block that computes one part of the total. This
is what each one does:</p>
<ul>
<li><a href="#user-content-material"><strong>material</strong></a> — how much filament or resin the part
consumes, and what that costs.</li>
<li><a href="#user-content-print-parameters"><strong>print</strong></a> — the print time and the power the machine
draws.</li>
<li><a href="#user-content-risk-and-failures"><strong>failure</strong></a> — failures and rework turned into cost,
by percentage or fixed amount.</li>
<li><a href="#user-content-hardware-wear"><strong>hardware</strong></a> — wear on the nozzle, the build plate
and the LCD (for resin).</li>
<li><a href="#user-content-machine-costs"><strong>machine</strong></a> — printer depreciation and maintenance,
split across hours of use.</li>
<li><a href="#user-content-fixed-costs"><strong>fixedCost</strong></a> — rent, internet and baseline power,
distributed over productive hours.</li>
<li><a href="#user-content-labor"><strong>labor</strong></a> — setup and post-processing time multiplied
by your hourly rate.</li>
<li><a href="#user-content-operational--software"><strong>ops</strong></a> — PPE, the slicer license, the model file and
other operational supplies.</li>
<li><a href="#user-content-additional-costs-and-sales"><strong>sales</strong></a> — packaging, shipping, taxes, marketplace
fees and your margin: the section that builds the sale price.</li>
<li><a href="#user-content-results"><strong>results</strong></a> — consolidates everything and shows cost,
profit and final price side by side.</li>
</ul>
<p>All ten sections in this map have their own Wiki articles, with the full formula
and worked examples — just follow the links above. And the
<a href="#user-content-results">results</a> section displays the sum of all of them side
by side.</p>
<h2 id="user-content-the-master-formula">The master formula</h2>
<p>Everything the calculator does fits in three lines. Production cost adds up the
consumption sections; total cost adds failures and logistics; and the sale price
applies margin and taxes on top of that base:</p>
<pre><code>production cost = material + print + hardware + machine
                + fixedCost + labor + ops

total cost      = production + failure + packaging + shipping

sale price      = total cost + markup
                + taxes and marketplace fees
</code></pre>
<p>Note that <code>sales</code> is the only section that is <strong>not a cost</strong>: packaging and
shipping add to the total, but margin, taxes and fees are applied <strong>on top</strong> of
it. That is why the sale price grows differently from the cost — and why the
<code>results</code> section exists, to make that difference visible.</p>
<h2 id="user-content-rules-that-prevent-misleading-numbers">Rules that prevent misleading numbers</h2>
<h3 id="user-content-real-margin-vs-markup">Real margin vs. markup</h3>
<p><code>profitMarginPercent</code> is a <strong>markup on cost</strong>, not the final profit percentage
on the sale price. For example, <code>110%</code> markup means the sale price must be
<code>2.10 ×</code> the cost: a cost of <code>$100.00</code> becomes <code>$210.00</code>, leaving <code>$110.00</code> of
gross profit.</p>
<p><strong>Real margin</strong> is derived and read-only:</p>
<pre><code>real margin = profit ÷ sale price × 100
</code></pre>
<p>In this example, <code>$110.00 ÷ $210.00 = 52.38%</code> real margin. Taxes and fees can
change the final price and therefore the net profit, so read real margin
together with the result.</p>
<p>The interface shows real margin in five places so the comparison stays visible.
Its tooltip says: <strong>“Markup: profit over cost. Margin: profit over the price the
customer pays.”</strong> See <a href="#user-content-additional-costs-and-sales">Sales</a> and
<a href="#user-content-results">Results</a> for the full formulas.</p>
<h3 id="user-content-a-missing-value-is-not-zero">A missing value is not zero</h3>
<p>In beta 3, <code>$0.00</code> no longer means that the calculation finished at zero. A
non-finite value is displayed as <code>—</code>, never as a made-up amount.</p>
<p>This fixes a real failure: restoring an older calculation could leave
<code>energyCostPerKwh</code> absent. <code>NaN</code> then flowed through the calculation chain and
the screen showed <code>$0.00</code> as if it were a valid cost. The rule is now:</p>
<ul>
<li><strong>Missing data in a legacy snapshot:</strong> the app uses its default for the missing
field and tries to complete the calculation.</li>
<li><strong>Corrupt or invalid data:</strong> <code>NaN</code>, a negative value, the wrong type, or
division by zero produces an explicit error with the exact field path.</li>
<li><strong>A non-finite result:</strong> the UI shows <code>—</code> and the invalid-calculation notice;
it does not turn the problem into zero.</li>
</ul>
<p>Validation runs before the calculation in seven paths: initial load,
<code>loadHistoryItem</code>, <code>undo</code>, <code>restoreAutoSnapshot</code>, <code>loadSharedCalculation</code>,
setters, and <code>setWithCompute</code>. Opening, undoing, restoring, sharing, or editing
a value therefore cannot silently turn a failure into zero.</p>
<p>If you see <code>—</code>, read the field name in the notice and correct that field. If the
problem came from history or a shared calculation, load a valid configuration or
fill in the missing value before using the result. Never replace an unknown
value with <code>0</code>: the price is not reliable while the error is present.</p>
<h3 id="user-content-demonstration-presets-removed">Demonstration presets removed</h3>
<p>The three demonstration presets — <strong>Vase</strong>, <strong>GoPro Mount</strong>, and <strong>Statue</strong> —
were removed. They supplied invented weights and print times; those values
belong to the model, not to the calculation workflow, so a preset must not
pretend to know the part.</p>
<p>Use <strong>Demo Mode</strong> when the goal is to see how the calculator works. Use
<strong>History</strong> when you want to load a real configuration.</p>
<h3 id="user-content-multi-material-is-temporarily-disabled">Multi-material is temporarily disabled</h3>
<p>Multi-material support is disabled in this beta. The toggle remains visible but
unavailable, with text explaining that the complete model will arrive in its
own phase. The reason is concrete: slot costs replaced only <code>materialCost</code>;
<code>subtotal</code>, <code>totalCost</code>, <code>sellPrice</code>, and <code>profit</code> did not include that value,
which silently underestimated the sale price.</p>
<p>Do not use a partial multi-material value to close a quote. <code>fdmAmsSlots</code> is
preserved for that future phase, but it does not represent a complete cost model
today.</p>
<h2 id="user-content-controls-and-presentation">Controls and presentation</h2>
<p>Field customization now appears once, in the <code>FieldCustomizer</code> component. The
same control used to appear between two and four times in different sections.
<code>SectionHeader</code> is presentational only; it does not keep a second copy of the
state. Detail level and <code>hiddenFields</code> remain the single source of truth for
Classic and Bento.</p>
<p>The interface uses a self-hosted <strong>Plus Jakarta Sans</strong> WOFF2 file under the OFL
1.1 license. The Google-hosted font was blocked by CSP, so the app does not
depend on it to display the Wiki. <code>tokens.css</code> is the single source of visual
tokens, with matching semantic values for the light and dark themes.</p>
<p>The Wiki also preserves accessibility when moving between articles: the target
is scrolled to and focused before the next interaction. The fix uses
<code>useLayoutEffect</code> instead of <code>useEffect</code>, so focus is applied after the heading
has mounted.</p>
<h2 id="user-content-a-complete-example">A complete example</h2>
<p>A decorative PLA part, 50 g, 5 hours of printing, 100% markup:</p>
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
<p>The math behind the taxes is explained in the <a href="#user-content-additional-costs-and-sales">sales</a>
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
<li><strong>Tune the <code>sales</code> section</strong> — the markup is your declared profit over cost.
Move it up or down with the market; the sale price updates instantly.</li>
<li><strong>Level up if needed</strong> — enable <code>failure</code> to include losses, or go Complete
to apportion machine, labor and fixed costs.</li>
<li><strong>Save or export</strong> — the estimate becomes a product in the inventory or a
quote line item, and the history keeps the numbers for the next part.</li>
</ol>
<h2 id="user-content-common-pitfalls">Common pitfalls</h2>
<p>Four mistakes surround anyone starting with the calculator, and all of them disguise themselves as haste.</p>
<ul>
<li><strong>Applying the margin without knowing the cost.</strong> The sale price updates instantly when you
move the percentage, which invites blind adjustments. Without <code>results</code> side by side, a 100%
margin looks like 100% profit — and it is not.</li>
<li><strong>Adding the margin and forgetting what goes on top.</strong> Total cost plus margin is R$ 28.84 in
the example; the sale price is R$ 38.45. The R$ 9.61 difference is taxes and the marketplace
fee, applied on top of the total, and it is not profit.</li>
<li><strong>Starting at the Complete level.</strong> Quick covers the path from filament to sale price with
four sections, and leveling up later erases nothing. Anyone opening all ten sections at once
drowns in fields before closing a single price.</li>
<li><strong>Treating <code>sales</code> as another cost.</strong> Packaging and shipping add to the total; margin, taxes
and fees are applied on top of it. Mixing up addition with application makes the price grow
in the wrong proportion.</li>
</ul>
<h2 id="user-content-where-to-start">Where to start</h2>
<p>If you have never used the calculator, do this: open it on the <strong>Quick</strong> level,
fill in only <code>material</code> and <code>print</code>, and look at <code>results</code>. That is already an
honest quote. Most pricing mistakes do not happen because of missing sections —
they happen when the margin is applied without knowing the cost. Start with the
cost; leave the advanced sections for when they start affecting your wallet.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};