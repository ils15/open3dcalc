var e=`print`,t=`en-US`,n={title:`Print Parameters`,order:11},r=[{depth:1,text:`Print Parameters`,slug:`user-content-print-parameters`},{depth:2,text:`The three basic fields`,slug:`user-content-the-three-basic-fields`},{depth:2,text:`Numeric example`,slug:`user-content-numeric-example`},{depth:2,text:`Printer selection`,slug:`user-content-printer-selection`},{depth:2,text:`The warm-up adjustment`,slug:`user-content-the-warm-up-adjustment`},{depth:2,text:`The boundary with the machine section`,slug:`user-content-the-boundary-with-the-machine-section`},{depth:2,text:`Common pitfalls`,slug:`user-content-common-pitfalls`}],i=`<h1 id="user-content-print-parameters">Print Parameters</h1>
<p>The <strong>print</strong> section measures what the printer consumes while making the part:
machine time and electricity. It is the most straightforward section in the
calculator — few fields, no subjective adjustments — but it is also where people
conflate two different sums.</p>
<p>The rule of thumb: <strong>print measures consumption, machine measures investment</strong>.
The <code>print</code> section answers "how long and how much power did this part take?";
the <a href="#user-content-machine-costs">machine</a> section answers "how much of the printer's
price is this hour worth?". Neither replaces the other: power is an electric
bill, depreciation is an equipment bill. Both belong in the cost, kept separate.</p>
<h2 id="user-content-the-three-basic-fields">The three basic fields</h2>
<ul>
<li><strong>Print time</strong> — the total the machine takes, per the slicer. It does not
include post-processing time (that lives in the <code>labor</code> section).</li>
<li><strong>Printer power</strong> — the average draw in watts. Most FDM printers sit between
100 W and 350 W; resin printers usually draw less, but curing is an extra step.</li>
<li><strong>Energy cost</strong> — the per-kWh price on your electric bill.</li>
</ul>
<p>The math is a simple multiplication: watts become kilowatts, times the hours,
times the price per kWh.</p>
<pre><code>energy (kWh)    = (power / 1000) * hours
energy cost     = energy (kWh) * cost per kWh
</code></pre>
<h2 id="user-content-numeric-example">Numeric example</h2>
<p>A part that takes 5 hours on a 250 W printer, with energy at R$ 0.80 per kWh:</p>
<pre><code>energy      = (250 / 1000) * 5 = 1.25 kWh
cost        = 1.25 * 0.80      = R$ 1.00
</code></pre>
<p>Five hours of machine time for R$ 1.00. That is why power is rarely the problem
in a quote — and also why it is the first thing people forget. At a hundred
parts, that is R$ 100 nobody put in the price.</p>
<p>If the power or the time changes, the cost moves in the same proportion: a
10-hour part on the same machine costs R$ 2.00 in energy; a 500 W machine would
make the same 5-hour part cost R$ 2.00 as well.</p>
<h2 id="user-content-printer-selection">Printer selection</h2>
<p>At the <strong>Detailed</strong> level (and only on the FDM tab), the section gains a printer
picker. It lists the printers registered in the catalog — each with brand, power
and value — and choosing one <strong>fills the power field automatically</strong> with that
machine's data.</p>
<p>The point is not saving typing: it is <strong>consistency</strong>. If you know the workshop's
Ender 3 draws an average of 250 W, catalog it once and every estimate uses that
number, instead of whatever you remembered at the moment. With the right printer
selected, the power field reflects reality — and quotes become comparable to
each other.</p>
<h2 id="user-content-the-warm-up-adjustment">The warm-up adjustment</h2>
<p>At the <strong>Complete</strong> level two fields refine the energy math: the warm-up time
and the extra power percentage during it. The machine draws more while heating
up than during the rest of the print, and these fields add that excess to the
bill.</p>
<p>For most quotes the difference is a few cents — a handful of minutes at peak
power on a 250 W printer. It exists for anyone who wants the energy bill exact,
but it does not change the structure of the math: it is still kWh times the
price per kWh.</p>
<h2 id="user-content-the-boundary-with-the-machine-section">The boundary with the machine section</h2>
<p>The split between <code>print</code> and <code>machine</code> is intentional and worth understanding:</p>
<ul>
<li><strong><code>print</code></strong> is <strong>variable per part</strong> — it depends on the time and power this
specific part demanded. Bigger part, more hours, more energy.</li>
<li><strong><code>machine</code></strong> is <strong>fixed per hour</strong> — it takes the printer's price, divides it
by its total lifetime hours and yields a cost per hour. The hours the part
uses multiply that value.</li>
</ul>
<p>That is why a 5-hour part always has the same energy cost (given the same
power), but a machine cost that <strong>depends on how many hours the printer has
already worked that month</strong>. Once you enable the machine section, the hour is no
longer free — and long parts start costing proportionally more than just double
the machine time.</p>
<h2 id="user-content-common-pitfalls">Common pitfalls</h2>
<ul>
<li><strong>Using peak power.</strong> A printer with a 350 W peak may run at 150 W most of the
time. The field asks for the average; using the peak inflates all the energy.</li>
<li><strong>Confusing machine time with total time.</strong> The slicer gives the print time;
removing from the plate, washing, curing and finishing belong in <code>labor</code>.</li>
<li><strong>Forgetting to update the electric bill.</strong> The kWh price rises; if the field
keeps the old value, every estimate lands slightly below reality.</li>
</ul>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};