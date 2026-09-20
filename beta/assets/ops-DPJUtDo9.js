var e=`ops`,t=`en-US`,n={title:`Operational & Software`,order:17},r=[{depth:1,text:`Operational & Software`,slug:`user-content-operational--software`},{depth:2,text:`Why "invisible" is the right word`,slug:`user-content-why-invisible-is-the-right-word`},{depth:2,text:`Block: Software and Files`,slug:`user-content-block-software-and-files`},{depth:2,text:`Block: PPE / Consumables`,slug:`user-content-block-ppe--consumables`},{depth:2,text:`Numeric example, step by step`,slug:`user-content-numeric-example-step-by-step`},{depth:2,text:`How this section relates to the others`,slug:`user-content-how-this-section-relates-to-the-others`},{depth:2,text:`Practical pitfalls`,slug:`user-content-practical-pitfalls`}],i=`<h1 id="user-content-operational--software">Operational &#x26; Software</h1>
<p>The <strong>Operational &#x26; Software</strong> section answers: <em>what invisible costs does this
part carry?</em> This is where software subscriptions, the 3D model you bought, the
gloves and the alcohol live — things that are neither filament nor machine, and
that almost always stay out of the quote.</p>
<p>This section only shows up at the <strong>advanced</strong> level. It has two blocks:
<strong>Software and Files</strong> and <strong>PPE / Consumables</strong>.</p>
<h2 id="user-content-why-invisible-is-the-right-word">Why "invisible" is the right word</h2>
<p>You do not see the slicer in the part. You do not see the glove. You do not see
the paid STL file. But each of them is a real expense that existed for this
part to exist. The classic example is the slicer: a R$ 30 monthly subscription
sounds small, but if you print 100 hours a month, each hour carries R$ 0.30 —
and on a 5.5-hour part that is R$ 1.65 nobody usually charges.</p>
<p>The same logic applies to the model. If you paid R$ 50 for an STL file and sell
10 parts of it, each part carries R$ 5 of file. If you sell 1,000, it carries
R$ 0.05. The cost exists; what changes is the dilution.</p>
<h2 id="user-content-block-software-and-files">Block: Software and Files</h2>
<ul>
<li><strong>Slicer Subscription</strong> — the monthly cost of the slicing software, if you use
a paid one. Leave it at zero if you use a free slicer; but remember that many
slicers' "free" tier is not the commercial one.</li>
<li><strong>STL File Cost</strong> — what you paid for the 3D file, if you bought it from a
third party. It is charged <strong>once per part</strong>, not per hour, so a single part
carries the whole value.</li>
</ul>
<p>The subscription is prorated by the month's print hours, using the <strong>same hours
field</strong> as the <a href="#user-content-machine">machine</a> section:</p>
<pre><code>softwarePerHour = slicerSubscription / hoursPerMonth

software = (softwarePerHour * printTimeHours) + stlFileCost
</code></pre>
<p>The file cost is added in full, because every part comes from it. Note: when
the quantity is greater than 1, only <strong>labor</strong> is diluted across the units —
the STL file is still charged in full on each part. See
<a href="#user-content-labor">labor</a> and <a href="#user-content-results">results</a>.</p>
<h2 id="user-content-block-ppe--consumables">Block: PPE / Consumables</h2>
<ul>
<li><strong>PPE Cost per Print</strong> — what you spend on gloves, masks, paper towels,
filters and isopropyl alcohol per print. It is a <strong>fixed per-part</strong> value,
not an hourly one. On FDM the default is zero (many people use no PPE); on
resin the default is R$ 2.50, because handling resin without gloves is a real
hazard.</li>
<li><strong>Carbon Intensity</strong> — grams of CO₂ per kWh of your power grid. It is not a
monetary cost: it lets the calculator show the part's <strong>carbon footprint</strong>.
It is informational, not part of the price.</li>
</ul>
<p>The carbon footprint is computed from the energy consumed:</p>
<pre><code>energyKwh = (powerW / 1000) * printTimeHours

carbonFootprintGrams = energyKwh * carbonIntensity
</code></pre>
<h2 id="user-content-numeric-example-step-by-step">Numeric example, step by step</h2>
<p>Our example part, the 5.5-hour phone stand. You pay a slicer subscription of
<strong>R$ 30 a month</strong>, print <strong>100 hours a month</strong>, bought the STL for <strong>R$ 5</strong>,
and spend <strong>R$ 2 per part</strong> on gloves and isopropyl alcohol.</p>
<pre><code>softwarePerHour = 30 / 100 = R$ 0.30/h

software = (0.30 * 5.5) + 5 = 1.65 + 5 = R$ 6.65

ppe = R$ 2.00

ops = 6.65 + 2.00 = R$ 8.65
</code></pre>
<p>And the carbon footprint, with the default intensity of 100 g/kWh and a 150 W
printer:</p>
<pre><code>energyKwh = (150 / 1000) * 5.5 = 0.825 kWh

carbonFootprintGrams = 0.825 * 100 = 82.5 g of CO2
</code></pre>
<p>For a decorative part, <strong>R$ 8.65</strong> of "invisibles" is more than half the
<a href="#user-content-material">material</a> cost — which was R$ 16.20.</p>
<h2 id="user-content-how-this-section-relates-to-the-others">How this section relates to the others</h2>
<ul>
<li>The <strong>hours per month</strong> prorating the subscription are the same as
<a href="#user-content-machine">machine</a> — use matching numbers, or the share comes
out wrong.</li>
<li>The <strong>print time</strong> multiplying the rate comes from
<a href="#user-content-print">print parameters</a>.</li>
<li>The <strong>finishing supplies</strong> (sandpaper, paint) live in
<a href="#user-content-hardware">hardware wear</a>; here belong the safety and cleaning
supplies.</li>
<li>The result is summed into the "Operational &#x26; Work" block of
<a href="#user-content-results">results</a>.</li>
</ul>
<h2 id="user-content-practical-pitfalls">Practical pitfalls</h2>
<ol>
<li><strong>Free slicer in life, paid slicer in the quote.</strong> If you use a slicer's free
tier to sell parts, you are technically using a non-commercial license. The
cost of a proper license is real and should be here — either in the price or
on your conscience.</li>
<li><strong>Forgetting the paid STL on a single part.</strong> It is the inverse of the
dilution mistake: on a single part, the whole file goes in. If you sell
little, the STL is one of the part's biggest costs — and it justifies
charging more for the first sale.</li>
<li><strong>Zeroing PPE on resin.</strong> Resin is toxic and handled with gloves. The R$ 2.50
per-part default exists because isopropyl alcohol and gloves run out. If you
zero this field "out of generosity", you are subsidizing the customer.</li>
<li><strong>Treating the carbon footprint as a cost.</strong> Carbon intensity is information
only (g of CO₂). It does not raise the price — it lets you answer customers
who ask, and compare against imported parts.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};