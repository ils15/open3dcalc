var e=`fixedCost`,t=`en-US`,n={title:`Fixed Costs`,order:15},r=[{depth:1,text:`Fixed Costs`,slug:`user-content-fixed-costs`},{depth:2,text:`Why prorate instead of ignoring`,slug:`user-content-why-prorate-instead-of-ignoring`},{depth:2,text:`Section fields`,slug:`user-content-section-fields`},{depth:2,text:`The formula`,slug:`user-content-the-formula`},{depth:2,text:`Numeric example, step by step`,slug:`user-content-numeric-example-step-by-step`},{depth:2,text:`The sensitivity that stings`,slug:`user-content-the-sensitivity-that-stings`},{depth:2,text:`How this section relates to the others`,slug:`user-content-how-this-section-relates-to-the-others`},{depth:2,text:`Practical pitfalls`,slug:`user-content-practical-pitfalls`}],i=`<h1 id="user-content-fixed-costs">Fixed Costs</h1>
<p>The <strong>Fixed Costs</strong> section answers an uncomfortable question: <em>how much of the
rent does this part pay?</em> Everything you spend per month even if the printer
stays off — workshop rent, internet, baseline power, building fees, mandatory
software. No single part uses these things alone, but every part needs them to
exist.</p>
<p>This section only shows up at the <strong>advanced</strong> level. It is by far the most
underestimated section of the calculator, and the one that most separates a
hobby from a real business.</p>
<h2 id="user-content-why-prorate-instead-of-ignoring">Why prorate instead of ignoring</h2>
<p>The argument against this section is: <em>"I pay rent anyway"</em>. That is true, and
exactly why it must be in the price. If no part pays the rent, then it is your
salary — or your savings — covering the rent of the business. The customer
walks away with a cheap part and you walk away paying for the space it was made
in.</p>
<p>Proration solves this with a simple idea: the monthly cost is divided by the
month's productive hours, and each part pays for the hours it consumed. A part
that uses more hours pays more rent. Fair.</p>
<h2 id="user-content-section-fields">Section fields</h2>
<p>The section is intentionally lean — two fields and one toggle.</p>
<ul>
<li><strong>Monthly Fixed Cost</strong> — the sum of everything you pay per month regardless of
production. Rent, internet, baseline power, building maintenance, software
with a mandatory subscription. See the pitfall below on what not to put here.</li>
<li><strong>Hours per Month</strong> — the estimated <strong>productive hours</strong> of the printer per
month, the same idea as the <a href="#user-content-machine-costs">monthly usage</a> field. If
this field is left at zero, the division is guarded and the share becomes
zero — which means no part is paying the rent.</li>
</ul>
<h2 id="user-content-the-formula">The formula</h2>
<p>This is the simplest calculation in the calculator, and maybe that is why it is
the most ignored:</p>
<pre><code>sharePerHour = monthlyFixedCost / monthlyProductiveHours

fixedCost = sharePerHour * printTimeHours
</code></pre>
<p>The result is not added as a separate line: it is injected into the
<strong>machine's hourly rate</strong>, in the <a href="#user-content-machine-costs">machine</a> section. That
way the share follows each part's print hours — a longer part pays more rent.</p>
<h2 id="user-content-numeric-example-step-by-step">Numeric example, step by step</h2>
<p>A small workshop in a bedroom turned into a studio:</p>
<pre><code>rent + building fees   = R$ 350
internet                = R$ 60
baseline power (standby)= R$ 40
-------------------------
monthlyFixedCost        = R$ 450

monthlyProductiveHours  = 150 h

sharePerHour = 450 / 150 = R$ 3.00/h
</code></pre>
<p>Our example part, the phone stand with <strong>5.5 hours</strong> of printing:</p>
<pre><code>fixedCost = 3.00 * 5.5 = R$ 16.50
</code></pre>
<p>The part carries <strong>R$ 16.50</strong> of rent, internet and baseline power. Compare it
to the R$ 16.20 of <a href="#user-content-material">material</a> (0.18 kg of PLA at R$ 90/kg):
the part pays more rent than filament. That is the moment many people discover
their selling price was only covering plastic.</p>
<h2 id="user-content-the-sensitivity-that-stings">The sensitivity that stings</h2>
<p>The share is a division — and divisions blow up when the denominator is small.
Here is the same workshop at different productive hours:</p>
<pre><code>150 h/month → 450 / 150 = R$ 3.00/h
100 h/month → 450 / 100 = R$ 4.50/h
 50 h/month → 450 /  50 = R$ 9.00/h
</code></pre>
<p>If the printer sits idle all week, every part has to carry double or quadruple
the rent. That is not a calculation flaw; it is the reality of an
underused operation. The way out is either to keep the machine busy or to
accept that weekend one-off parts have a higher fair price.</p>
<h2 id="user-content-how-this-section-relates-to-the-others">How this section relates to the others</h2>
<ul>
<li>The share is applied inside the <a href="#user-content-machine-costs">machine</a> hourly rate,
alongside depreciation and maintenance.</li>
<li>The workshop's productive hours need not match the
<a href="#user-content-machine-costs">machine's</a> usage hours. The share divides the fixed
cost by the productive hours of the whole workshop. The machine, in turn, uses
the hours of that printer itself, for depreciation and maintenance. These are
independent fields, so different values are correct.</li>
<li>The <strong>printing energy</strong> (unlike baseline power) is counted in the
<a href="#user-content-print-parameters">print parameters</a> section; do not duplicate it here.</li>
<li><strong>Equipment maintenance</strong> belongs to <a href="#user-content-machine-costs">machine</a>; here
belongs the maintenance of the <strong>space</strong>.</li>
</ul>
<h2 id="user-content-practical-pitfalls">Practical pitfalls</h2>
<ol>
<li><strong>Putting variable costs here.</strong> Filament, nozzles, isopropyl alcohol and
shipping are proportional to production — they already have their own
section. Only what is fixed belongs here: if production doubled or stopped,
the value would not change.</li>
<li><strong>Optimistic productive hours.</strong> If the machine is powered on 12 hours a day
but only prints 4, the productive hours are 4. Overestimating this field is
the most common way to artificially cheapen your own price.</li>
<li><strong>Forgetting invisible costs.</strong> Internet, subscription software, card
reader fees, parking. Nobody remembers to charge R$ 60 of internet — across
a hundred parts a month that is R$ 0.60 per part nobody paid.</li>
<li><strong>Not prorating when printing little.</strong> Those making two parts a month tend
to zero this section because charging R$ 40 of rent on one part feels unfair.
But the rent is real: either it is in the price, or it is in your pocket.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};