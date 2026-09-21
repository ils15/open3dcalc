var e=`failure`,t=`en-US`,n={title:`Risk and Failures`,order:12},r=[{depth:1,text:`Risk and Failures`,slug:`user-content-risk-and-failures`},{depth:2,text:`The fields`,slug:`user-content-the-fields`},{depth:2,text:`How the calculation works`,slug:`user-content-how-the-calculation-works`},{depth:2,text:`Numeric example`,slug:`user-content-numeric-example`},{depth:2,text:`Where your rate comes from`,slug:`user-content-where-your-rate-comes-from`},{depth:2,text:`Common pitfalls`,slug:`user-content-common-pitfalls`}],i=`<h1 id="user-content-risk-and-failures">Risk and Failures</h1>
<p>The <strong>failure</strong> section exists because a spoiled print is not an accident — it
is a cost. Every print that goes wrong consumes filament, power and machine
hours that generate no sale at all. If you sell parts without pricing that loss
in, you are paying for every failure out of your own pocket.</p>
<p>The section is <strong>optional by design</strong>: it stays hidden at the <strong>Quick</strong> level and
appears from <strong>Detailed</strong> onward, because it only makes sense once you have
produced enough to have a real sense of your loss rate. If you print
occasionally, the failure cost may be zero; if you sell hundreds of parts a
month, ignoring it is a guaranteed loss.</p>
<h2 id="user-content-the-fields">The fields</h2>
<p>The whole section comes down to four fields, and each one controls a part of the math.</p>
<ul>
<li><strong>Enable failure cost</strong> — the whole section is toggled by a single switch. Off,
it adds nothing and the rest of the calculation is unaffected.</li>
<li><strong>Failure mode</strong> — how the loss is measured: <strong>Percentage</strong> (a rate over the
production cost) or <strong>Fixed</strong> (an amount in currency per part).</li>
<li><strong>Failure value</strong> — in percentage mode, the expected loss rate; in fixed mode,
the cost of each failure. Ten percent is a good starting point.</li>
<li><strong>Risk multiplier</strong> — a factor applied to the failure rate for riskier
scenarios (large parts, difficult materials, a model you have never printed).</li>
</ul>
<h2 id="user-content-how-the-calculation-works">How the calculation works</h2>
<p>In <strong>fixed</strong> mode the logic is direct: the failure value is added to the cost of
every part, no surprises.</p>
<pre><code>failure cost (fixed) = failure value
</code></pre>
<p>In <strong>percentage</strong> mode, the rate applies to the <strong>production cost</strong> — the sum of
material, energy, machine, hardware, labor and operation, before packaging and
shipping. The risk multiplier, when present, adjusts the rate before it is
applied:</p>
<pre><code>adjusted rate   = failure value * risk multiplier
failure cost    = production cost * (adjusted rate / 100)
</code></pre>
<p>The order matters: failure is charged on what the part <strong>actually consumed</strong>, not
on the final price. So a 10% failure rate on a R$ 20.00 production cost is
R$ 2.00 — not 10% of an inflated sale price.</p>
<h2 id="user-content-numeric-example">Numeric example</h2>
<p>Take a part with a R$ 20.00 production cost and a 10% failure rate:</p>
<pre><code>failure cost = 20.00 * (10 / 100) = R$ 2.00
</code></pre>
<p>Every part you deliver carries R$ 2.00 of the ones that went wrong. Now the same
print in a high-risk scenario — a large model you have never made, with a risk
multiplier of 1.5:</p>
<pre><code>adjusted rate = 10 * 1.5            = 15%
failure cost  = 20.00 * (15 / 100)  = R$ 3.00
</code></pre>
<p>The difference is the multiplier doing its job: it forces you to acknowledge that
a risky print costs more than a routine one. If the part succeeds on the first
try, you earned the R$ 3.00; if it fails, they were already in the price.</p>
<p>In <strong>fixed</strong> mode, the same part with a R$ 4.00 cost per failure simply adds
R$ 4.00 to the cost of every delivered part — useful when you know the average
value of a lost attempt and prefer to work with a currency figure.</p>
<h2 id="user-content-where-your-rate-comes-from">Where your rate comes from</h2>
<p>There is no universal rate — yours comes from your own history. Some practical
references:</p>
<ul>
<li><strong>Beginner in FDM, simple parts</strong>: 5–10%. PLA is forgiving and small models
rarely fail.</li>
<li><strong>Technical or tall parts</strong>: 15–20%. More machine time means more exposure to
a problem mid-print.</li>
<li><strong>Resin</strong>: usually higher. The part can fail during printing, washing or
curing — three stages instead of one.</li>
<li><strong>New model or demanding client</strong>: use the risk multiplier. The first unit of
any series has a far higher loss rate than the tenth.</li>
</ul>
<p>The right place to find your rate is the <strong>history</strong> of parts you have already
made, not a guess. If you recorded your attempts, divide the failures by the
total and you have the number for the field.</p>
<h2 id="user-content-common-pitfalls">Common pitfalls</h2>
<p>Four mistakes surround this section, and all of them leave the loss in your pocket instead of the price.</p>
<ul>
<li><strong>Leaving failure off "to make it cheaper."</strong> It does not make the price more
competitive — it only moves the loss from the customer to you. When the failure
inevitably happens, it came out of your profit.</li>
<li><strong>Applying the rate to the sale price.</strong> Failure is proportional to the
production cost, not to the price. Using the wrong base doubles the value and
inflates the price.</li>
<li><strong>Ignoring the multiplier on large prints.</strong> A 30-hour part does not have the
same risk as a 30-minute one; the multiplier exists precisely for those cases.</li>
<li><strong>A 0% rate.</strong> That is only honest if you truly never lose a part. Even
veteran printers have occasional losses — 5% already covers most of them.</li>
</ul>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};