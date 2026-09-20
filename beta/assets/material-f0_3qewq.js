var e=`material`,t=`en-US`,n={title:`Material`,order:10},r=[{depth:1,text:`Material`,slug:`user-content-material`},{depth:2,text:`FDM: weight, price and efficiency`,slug:`user-content-fdm-weight-price-and-efficiency`},{depth:2,text:`The fields everyone forgets`,slug:`user-content-the-fields-everyone-forgets`},{depth:2,text:`A full numeric example`,slug:`user-content-a-full-numeric-example`},{depth:2,text:`Resin: volume, not weight`,slug:`user-content-resin-volume-not-weight`},{depth:2,text:`How the inventory feeds the section`,slug:`user-content-how-the-inventory-feeds-the-section`},{depth:2,text:`Common pitfalls`,slug:`user-content-common-pitfalls`}],i=`<h1 id="user-content-material">Material</h1>
<p>The <strong>material</strong> section calculates how much filament or resin the part consumes
and converts that into money. It is the calculator's first section and, in most
prints, the heaviest line in the final cost — which also makes it the first
place where a wrong assumption becomes a wrong price.</p>
<p>The core idea is to keep two things apart: <strong>what the part weighs</strong> and <strong>what
you actually paid for the material</strong>. A 50 g part printed from a R$ 125/kg spool
does not cost R$ 6.25 — because the spool is never used whole, purge wastes
plastic, and resin stays in the vat. The material section folds those losses
into the math instead of pretending they do not exist.</p>
<h2 id="user-content-fdm-weight-price-and-efficiency">FDM: weight, price and efficiency</h2>
<p>For filament printing, the basic fields are:</p>
<ul>
<li><strong>Material type</strong> — PLA, PETG, ABS and others. Sets the density used in volume
conversions and the suggested price points.</li>
<li><strong>Cost per kg</strong> — the average price per kilo. For reference: PLA runs around
R$ 90, PETG R$ 110 and ABS R$ 100.</li>
<li><strong>Weight used</strong> — how many grams the part consumes, per the slicer.</li>
</ul>
<p>The basic formula is straightforward: weight converted to kilos times the price
per kilo.</p>
<pre><code>material cost = (weight used / 1000) * cost per kg
</code></pre>
<p>A 50 g part in PLA at R$ 125/kg costs <code>(50/1000) * 125 = R$ 6.25</code>. That is the
<strong>theoretical</strong> cost, with no losses — and it is rarely the real one.</p>
<h2 id="user-content-the-fields-everyone-forgets">The fields everyone forgets</h2>
<p>Moving up to the <strong>Detailed</strong> level reveals four fields that close the gap
between theory and the actual print:</p>
<ul>
<li><strong>Purge / loss</strong> — the grams wasted in the purge tower or on color changes. On
multicolor prints it can be larger than the part itself.</li>
<li><strong>Spool efficiency</strong> — nobody uses 100% of a spool: leftover tails and
changes reduce the yield. The suggested default is 95–98%.</li>
<li><strong>Density</strong> — used to convert volume into weight. PLA ≈ 1.24, PETG ≈ 1.27,
ABS ≈ 1.04 g/cm³.</li>
<li><strong>Waste margin</strong> — applied to resin, covers what stays in the vat, in the
supports and in cleaning. Suggested: 5–10%.</li>
</ul>
<p>Purge and efficiency affect cost differently. <strong>Purge</strong> is extra weight that
goes in the trash; <strong>efficiency</strong> is a factor that dilutes the price of every
gram you consume. The full formula applies both:</p>
<pre><code>total weight      = weight used + purge
effective weight  = total weight * (100 / spool efficiency)
material cost     = (effective weight / 1000) * cost per kg
</code></pre>
<p>Note the division: at 98% efficiency the factor is <code>100/98 ≈ 1.02</code> — you pay
about 2% more for every gram, because part of the spool went in the trash. It is
little per part, and a lot per year.</p>
<h2 id="user-content-a-full-numeric-example">A full numeric example</h2>
<p>A PLA part weighing 50 g, with an 8 g purge tower, 98% efficiency and R$ 125/kg:</p>
<pre><code>total weight      = 50 + 8        = 58 g
factor            = 100 / 98      = 1.0204
effective weight  = 58 * 1.0204   = 59.18 g
material cost     = 0.05918 * 125 = R$ 7.40
</code></pre>
<p>Without those fields the math would say R$ 6.25. The R$ 1.15 difference per part
is exactly the kind of loss that shows up at a hundred units — R$ 115 of profit
evaporated by forgetting the purge.</p>
<p>The part that runs through the other articles — the phone stand — is the
simplest case: <strong>180 g of PLA at R$ 90/kg</strong>, with no purge tower:</p>
<pre><code>material cost = (180 / 1000) * 90 = 0.18 * 90 = R$ 16.20
</code></pre>
<p>That <strong>R$ 16.20</strong> is the number the <a href="#user-content-fixed-costs">fixed costs</a> and
<a href="#user-content-operational--software">operational &#x26; software</a> articles cite when
comparing against their own cost.</p>
<h2 id="user-content-resin-volume-not-weight">Resin: volume, not weight</h2>
<p>Resin printing works differently, because you buy liquid. The fields change:</p>
<ul>
<li><strong>Cost per liter</strong> — the price of the bottle.</li>
<li><strong>Volume used</strong> — how many milliliters the part consumes.</li>
<li><strong>Waste margin</strong> — the percentage left in the vat and in the supports.</li>
<li><strong>Density</strong> — converts volume into weight, for the inventory record.</li>
</ul>
<p>The formula mirrors the filament one, but in milliliters:</p>
<pre><code>volume with waste = volume used * (1 + waste margin / 100)
material cost     = (volume with waste / 1000) * cost per liter
</code></pre>
<p>A 30 ml part with a 10% waste margin and resin at R$ 150 per liter:</p>
<pre><code>volume with waste = 30 * 1.10   = 33 ml
material cost     = 0.033 * 150 = R$ 4.95
</code></pre>
<p>Density does not feed the price — it only exists so the inventory knows how many
grams the part has, which is used for resin stock tracking.</p>
<h2 id="user-content-how-the-inventory-feeds-the-section">How the inventory feeds the section</h2>
<p>You do not have to type the cost and density every time. If the filament is
cataloged in the <strong>inventory</strong>, the calculator offers the list of registered
spools, and selecting one fills the section with that roll's data: material
type, cost per kg and density.</p>
<p>The link also runs the other way: when a part uses a selected spool, the system
shows how much of that roll is left — and subtracts the consumed weight on
every print. That way the next part is priced with the real cost of the plastic
on your shelf, not a fixed estimate. See the <a href="#user-content-inventory">inventory</a>
article for details.</p>
<h2 id="user-content-common-pitfalls">Common pitfalls</h2>
<ul>
<li><strong>Forgetting the purge on color prints.</strong> The purge tower of a three-color
model can outweigh the part itself. Without the field, the cost is
understated from the very first print.</li>
<li><strong>Using the wrong density.</strong> PLA and ABS have very different densities; if
the catalog says 1.24 and the roll is 1.04, every volume conversion is wrong.</li>
<li><strong>Mixing the spool price with the kilo price.</strong> A R$ 90 spool with 1 kg is
R$ 90/kg; a R$ 90 spool with 750 g is R$ 120/kg. The inventory stores the
price per kilo precisely so this trap does not exist.</li>
<li><strong>Leaving efficiency at 100%.</strong> It is tempting, but it is a lie: the last
stretch of a spool is almost always wasted. 98% is an honest value.</li>
</ul>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};