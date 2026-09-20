var e=`labor`,t=`en-US`,n={title:`Labor`,order:16},r=[{depth:1,text:`Labor`,slug:`user-content-labor`},{depth:2,text:`What does NOT belong here: print time`,slug:`user-content-what-does-not-belong-here-print-time`},{depth:2,text:`Section fields`,slug:`user-content-section-fields`},{depth:2,text:`The formula`,slug:`user-content-the-formula`},{depth:2,text:`Numeric example, step by step`,slug:`user-content-numeric-example-step-by-step`},{depth:2,text:`How much to charge as an hourly rate`,slug:`user-content-how-much-to-charge-as-an-hourly-rate`},{depth:2,text:`How this section relates to the others`,slug:`user-content-how-this-section-relates-to-the-others`},{depth:2,text:`Practical pitfalls`,slug:`user-content-practical-pitfalls`}],i=`<h1 id="user-content-labor">Labor</h1>
<p>The <strong>Labor</strong> section answers: <em>how much is my time worth on this part?</em> It is
the minutes when a human being is actually working: preparing the file,
slicing, setting up the printer, removing the part, breaking away supports,
sanding.</p>
<p>This section only shows up at the <strong>advanced</strong> level. It is the section that
separates those who cost their own time from those who treat their own hours as
free.</p>
<h2 id="user-content-what-does-not-belong-here-print-time">What does NOT belong here: print time</h2>
<p>This is the most important point of the section, and the source of the most
common mistake: <strong>the time the printer spends printing is not labor.</strong> During
those hours the machine works alone and you can be doing something else — or
another paid job. Print time is charged by the <a href="#user-content-machine">machine</a>
(depreciation, energy, share), not here.</p>
<p>If you add the 5.5 hours of printing to labor, the customer pays twice: once as
machine, once as person. Labor counts only the minutes where <strong>you</strong> are
needed.</p>
<h2 id="user-content-section-fields">Section fields</h2>
<ul>
<li><strong>Setup (Slicing)</strong> — minutes spent preparing the file: adjusting the model,
positioning the plate, configuring the slicer, exporting the gcode, leveling
the bed and loading filament. A simple part takes 5 minutes; a client file
with several revisions can take 40.</li>
<li><strong>Post-Processing</strong> — minutes removing the part from the bed, breaking off
supports, sanding, gluing, painting. This time is proportional to each part.</li>
<li><strong>Hourly Rate</strong> — how much you want to earn per <strong>hour</strong> of work, in
currency. It is the field most often left at zero. If it is zero, this whole
section sums to zero — and you donate your own time.</li>
</ul>
<h2 id="user-content-the-formula">The formula</h2>
<p>Minutes become hours and multiply by the hourly rate:</p>
<pre><code>totalMinutes = setupMinutes + postProcessingMinutes

labor = (totalMinutes / 60) * hourlyRate
</code></pre>
<p>When you produce more than one identical unit, the app dilutes the labor across
the units — the setup is shared by the whole batch:</p>
<pre><code>laborPerUnit = labor / quantity
</code></pre>
<p>See the pitfall below about post-processing in that dilution.</p>
<h2 id="user-content-numeric-example-step-by-step">Numeric example, step by step</h2>
<p>Our example part, the phone stand. You spent 12 minutes configuring the slicer
and 18 minutes removing and sanding the part, and you want to earn <strong>R$ 25 an
hour</strong>.</p>
<pre><code>totalMinutes = 12 + 18 = 30 min

labor = (30 / 60) * 25 = 0.5 * 25 = R$ 12.50
</code></pre>
<p>Behind the number: <strong>R$ 5.00</strong> of setup (0.2 h × 25) and <strong>R$ 7.50</strong> of
post-processing (0.3 h × 25). Now the same scenario with a batch of 10 units:</p>
<pre><code>labor = 12.50 / 10 = R$ 1.25 per unit
</code></pre>
<p>In practice the 12-minute setup was paid once and prorated. The 18 minutes of
sanding, though, happen again for every part — which is why batches deserve
attention.</p>
<h2 id="user-content-how-much-to-charge-as-an-hourly-rate">How much to charge as an hourly rate</h2>
<p>There is no single answer, but there is a floor: your hourly rate needs to cover
what an hour costs you, not just what it is "worth in the market". Add what you
spend per month (including what is in the
<a href="#user-content-fixedCost">fixed costs</a> and <a href="#user-content-machine">machine</a>
sections) and divide by the hours you actually work in the business. Anything
below that is unpaid work.</p>
<pre><code>rateFloor = totalMonthlyCost / monthlyWorkedHours
</code></pre>
<p>R$ 25/h is an honest starting point for a one-person operation; R$ 8/h is
underpaid labor subsidized by another source of income.</p>
<h2 id="user-content-how-this-section-relates-to-the-others">How this section relates to the others</h2>
<ul>
<li>The <strong>print time</strong> (which is NOT here) comes from
<a href="#user-content-print">print parameters</a> and feeds
<a href="#user-content-machine">machine</a>.</li>
<li>The <strong>supplies</strong> for post-processing — sandpaper, paint, acetone — live in
<a href="#user-content-hardware">hardware wear</a>, in the finishing block. Only the
time belongs here; the material belongs there.</li>
<li>The <strong>share and depreciation</strong> are in <a href="#user-content-machine">machine</a> and
<a href="#user-content-fixedCost">fixed costs</a>, and are multiplied by print hours,
not by your hours.</li>
<li>The profit-per-hour shown in <a href="#user-content-results">results</a> uses exactly
this combination: print hours + post + diluted setup.</li>
</ul>
<h2 id="user-content-practical-pitfalls">Practical pitfalls</h2>
<ol>
<li><strong>Leaving the hourly rate at zero.</strong> The most frequent mistake. The
calculator accepts it and simply shows a lower price — nice on screen, loss
in real life. If you do not know the number, start at R$ 25 and adjust
upward.</li>
<li><strong>Adding print time to labor.</strong> Pure duplication. The machine is already
being charged for those hours; you were not there the whole time.</li>
<li><strong>Not counting the setup.</strong> "Oh, it was only 10 minutes." Those are 10
minutes each time that you never billed. Across a hundred quotes, that is
more than 16 donated hours.</li>
<li><strong>Diluting post-processing in batches.</strong> The app dilutes the entire labor
per unit when the quantity is greater than 1, which is fair for setup. But
if every part is sanded individually, post is a per-unit cost, not a batch
cost — check that the per-unit price in <a href="#user-content-results">results</a>
still covers the individual finishing.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};