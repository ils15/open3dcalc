var e=`machine`,t=`en-US`,n={title:`Machine Costs`,order:14},r=[{depth:1,text:`Machine Costs`,slug:`user-content-machine-costs`},{depth:2,text:`Machine, energy and hardware: three different things`,slug:`user-content-machine-energy-and-hardware-three-different-things`},{depth:2,text:`Section fields`,slug:`user-content-section-fields`},{depth:2,text:`The formula`,slug:`user-content-the-formula`},{depth:2,text:`Numeric example, step by step`,slug:`user-content-numeric-example-step-by-step`},{depth:2,text:`Sensitivity: what moves the rate`,slug:`user-content-sensitivity-what-moves-the-rate`},{depth:2,text:`How this section relates to the others`,slug:`user-content-how-this-section-relates-to-the-others`},{depth:2,text:`Practical pitfalls`,slug:`user-content-practical-pitfalls`}],i=`<h1 id="user-content-machine-costs">Machine Costs</h1>
<p>The <strong>Machine Costs</strong> section answers: <em>how much of this part is the printer's
wear?</em> It is the equipment depreciation: the price you paid for the printer,
divided by its useful life, charged per working hour. It is the section that
makes a part's price include, slice by slice, the money you spent buying the
machine.</p>
<p>This section only shows up at the <strong>advanced</strong> level. In quick or detailed mode
it is omitted — the depreciation is still computed, just not shown.</p>
<h2 id="user-content-machine-energy-and-hardware-three-different-things">Machine, energy and hardware: three different things</h2>
<p>These three sections are easy to confuse. Here is the split:</p>
<ul>
<li><strong>Print parameters</strong> measures <strong>energy</strong> — how many kWh the printer consumed
for this part. It is the power bill.</li>
<li><strong>Machine</strong> measures the <strong>depreciation of the whole printer</strong> — the asset
paying for itself over its lifetime.</li>
<li><strong>Hardware wear</strong> measures the <strong>consumable parts</strong> — nozzle, bed, LCD, FEP.
See <a href="#user-content-hardware-wear">hardware</a>.</li>
</ul>
<p>If you put the printer's price in two of those three places, the customer pays
for the machine twice.</p>
<h2 id="user-content-section-fields">Section fields</h2>
<p>Every field here is a piece of the hourly rate. The toggle at the top of the
section turns the whole depreciation on or off.</p>
<ul>
<li><strong>Printer Cost</strong> — what you paid for the machine, in currency. Include
shipping and taxes if possible, since that is what left your pocket. Leaving
it at zero disables the depreciation (a "free" machine, which is rarely
true).</li>
<li><strong>Depreciation</strong> — <strong>how many months</strong> the printer takes to pay for itself.
The market standard is 36 months for equipment. A short term (12 months)
produces a high hourly rate; a long one (60 months) cheapens every part, but
the machine will likely die before finishing.</li>
<li><strong>Monthly Usage</strong> — <strong>how many hours per month</strong> the printer is actually
printing. It is the most dangerous field in the section, and has a pitfall
below.</li>
<li><strong>Maintenance</strong> (toggle) — enables the maintenance block.</li>
<li><strong>Monthly Maintenance Cost</strong> — what you spend per month on replacement
nozzles, belts, bearings, lubrication and spare parts.</li>
</ul>
<h2 id="user-content-the-formula">The formula</h2>
<p>The total useful life is months times monthly hours. The hourly rate is the
price divided by that life.</p>
<pre><code>usefulLifeHours = depreciationMonths * hoursPerMonth

depreciationPerHour = printerCost / usefulLifeHours
maintenancePerHour  = maintenanceCost / hoursPerMonth

hourlyRate = depreciationPerHour + maintenancePerHour + fixedShare

machine = hourlyRate * printTimeHours
</code></pre>
<p>The <code>fixedShare</code> comes from the <a href="#user-content-fixed-costs">fixed costs</a> section
and is added here, inside the machine's hourly rate, because productive hours
happen on the machine. If fixed costs are disabled, that share is zero.</p>
<p>The math is guarded against division by zero: a <code>usefulLifeHours</code> or
<code>hoursPerMonth</code> of zero zeroes the corresponding share instead of blowing up.</p>
<h2 id="user-content-numeric-example-step-by-step">Numeric example, step by step</h2>
<p>An <strong>Ender 3</strong> cost <strong>R$ 1,800</strong>. You have used it for 3 years, print about
<strong>100 hours a month</strong>, and spend <strong>R$ 30 a month</strong> on maintenance. Let us build
the example part: a phone stand taking <strong>5.5 hours</strong> to print.</p>
<pre><code>usefulLifeHours = 36 * 100 = 3,600 h

depreciationPerHour = 1,800 / 3,600 = R$ 0.50/h
maintenancePerHour  = 30 / 100      = R$ 0.30/h
fixedShare           = R$ 3.00/h    (from fixed costs)

hourlyRate = 0.50 + 0.30 + 3.00 = R$ 3.80/h

machine = 3.80 * 5.5 = R$ 20.90
</code></pre>
<p>The part carries <strong>R$ 20.90</strong> of machine. Of that, R$ 2.75 is pure depreciation
(0.50 × 5.5), R$ 1.65 is maintenance and R$ 16.50 is the fixed-cost share.
Notice who dominates: the fixed share. That is why the
<a href="#user-content-fixed-costs">fixed costs</a> section is what most separates a hobby
from a business.</p>
<p>A note on the numbers. This example uses <strong>100 hours a month</strong>, the actual usage
of <strong>this printer</strong>. That is the basis for depreciation and maintenance. The
<a href="#user-content-fixed-costs">fixed costs</a> section works with <strong>150 hours a month</strong>,
the productive hours of the whole workshop. These are independent fields in the
app, and the different values are correct: one measures the wear on a single
machine, the other prorates the cost of the space.</p>
<h2 id="user-content-sensitivity-what-moves-the-rate">Sensitivity: what moves the rate</h2>
<p>The hourly rate is a fraction with two denominators. Small changes in these
fields have a big effect on the final price:</p>
<pre><code>Monthly usage of 200 h instead of 100 h:
  depreciationPerHour = 1,800 / 7,200 = R$ 0.25/h   (half!)

Depreciation of 12 months instead of 36:
  depreciationPerHour = 1,800 / 1,200 = R$ 1.50/h   (triple!)
</code></pre>
<p>If you print little, depreciation per part is high — and that is correct, not a
calculator error. The fix is not to lie about the hours; it is to print more, or
accept that one-off parts on an idle machine are genuinely expensive.</p>
<h2 id="user-content-how-this-section-relates-to-the-others">How this section relates to the others</h2>
<ul>
<li>The <strong>time</strong> multiplying the hourly rate is the print time from the
<a href="#user-content-print-parameters">print parameters</a> section, not the labor time.</li>
<li>The <strong>share</strong> entering the rate comes from
<a href="#user-content-fixed-costs">fixed costs</a>.</li>
<li>The worn <strong>parts</strong> (nozzle, bed) live in <a href="#user-content-hardware-wear">hardware</a>
and are summed separately.</li>
<li>Depreciation lands in the "Equipment &#x26; Wear" block of the
<a href="#user-content-results">result</a>.</li>
</ul>
<h2 id="user-content-practical-pitfalls">Practical pitfalls</h2>
<ol>
<li><strong>Overestimating monthly usage.</strong> The number-one trap. If you enter 200
h/month but the printer only runs 40 h, depreciation comes out five times
lower than reality and every part is underpriced. Use an honest average of
the last three months.</li>
<li><strong>Forgetting maintenance.</strong> A 3D printer is a device with moving parts that
wear out. If you leave maintenance off, the real bill for belts and nozzles
arrives in eight months and no part paid for it.</li>
<li><strong>Depreciation stretched too long.</strong> 60 months makes the hourly rate look
irresistible, but an Ender 3 rarely survives 3,600 productive hours without
losing precision. 24 to 36 months is the realistic window.</li>
<li><strong>Counting powered-on hours as printing hours.</strong> Preheating, leveling and
filament swaps print nothing. The field is "hours per month printing" — time
the build plate is actually moving.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};