var e=`hardware`,t=`en-US`,n={title:`Hardware Wear`,order:13},r=[{depth:1,text:`Hardware Wear`,slug:`user-content-hardware-wear`},{depth:2,text:`Why this cost exists even for a single print`,slug:`user-content-why-this-cost-exists-even-for-a-single-print`},{depth:2,text:`FDM: nozzle, bed and finishing`,slug:`user-content-fdm-nozzle-bed-and-finishing`},{depth:3,text:`Nozzle`,slug:`user-content-nozzle`},{depth:3,text:`Bed and Adhesion`,slug:`user-content-bed-and-adhesion`},{depth:3,text:`Physical Finishing`,slug:`user-content-physical-finishing`},{depth:2,text:`Resin: LCD, FEP, washing and curing`,slug:`user-content-resin-lcd-fep-washing-and-curing`},{depth:2,text:`The formula`,slug:`user-content-the-formula`},{depth:2,text:`Numeric example, step by step`,slug:`user-content-numeric-example-step-by-step`},{depth:2,text:`How this section relates to the others`,slug:`user-content-how-this-section-relates-to-the-others`},{depth:2,text:`Practical pitfalls`,slug:`user-content-practical-pitfalls`}],i=`<h1 id="user-content-hardware-wear">Hardware Wear</h1>
<p>The <strong>Hardware Wear</strong> section answers a question almost every beginner ignores:
<em>what did this print consume besides filament?</em> Filament is only the visible
part of the cost. The part also passes through the <strong>nozzle</strong> (wearing the
bore), the <strong>bed</strong> (wearing the adhesive or the PEI sheet) and, on resin, the
<strong>LCD panel</strong>, the <strong>FEP film</strong> and the <strong>curing lamp</strong>.</p>
<p>This section only shows up at the <strong>advanced</strong> level of the calculator. In
quick or detailed mode it stays hidden — but the cost is still there, just
invisible.</p>
<h2 id="user-content-why-this-cost-exists-even-for-a-single-print">Why this cost exists even for a single print</h2>
<p>There is a classic excuse to skip this section: <em>"my printer is already paid
for, so the part costs me nothing"</em>. The problem is that the nozzle is never
paid for forever. Every meter of filament pushed through a 0.4 mm nozzle
enlarges it a tiny bit. A new brass nozzle costs about R$ 35 and lasts roughly
20 kg of PLA. If your part uses 180 g, it consumed 0.9% of that nozzle's life —
that is R$ 0,32 that exists in the single print and nobody paid you back for.</p>
<p>This section turns that silent wear into a number you can add up and charge.
Without it, your price covers filament and donates the machine's wear.</p>
<h2 id="user-content-fdm-nozzle-bed-and-finishing">FDM: nozzle, bed and finishing</h2>
<p>On <strong>FDM</strong>, the section gathers three blocks, each with its own toggle.</p>
<h3 id="user-content-nozzle">Nozzle</h3>
<ul>
<li><strong>Nozzle Cost</strong> — what you paid for the nozzle, in currency. Brass is cheap;
hardened steel costs several times more.</li>
<li><strong>Lifespan</strong> — how many <strong>kilograms</strong> of filament this nozzle holds up before
losing precision. Brass with PLA: close to 20 kg. Steel with carbon-filled
filament: 10 kg or less.</li>
</ul>
<p>Leaving <strong>Lifespan</strong> at zero disables the nozzle math (the division by zero is
guarded and becomes zero — the nozzle does not inflate the price, but it is
also not being charged).</p>
<h3 id="user-content-bed-and-adhesion">Bed and Adhesion</h3>
<ul>
<li><strong>Adhesive Cost per Print</strong> — estimated value of spray, glue, tape or PEI
sheet wear <strong>per print</strong>. It is a fixed per-part value, not an hourly one.</li>
</ul>
<h3 id="user-content-physical-finishing">Physical Finishing</h3>
<ul>
<li><strong>Finishing Supplies</strong> — what you spend on sandpaper, primer, paint, body
filler or acetone for this part in particular. If the part ships with no
finishing at all, leave it at zero.</li>
</ul>
<h2 id="user-content-resin-lcd-fep-washing-and-curing">Resin: LCD, FEP, washing and curing</h2>
<p>On the resin tab the same section gains other wear items, because an SLA
printer has parts that wear by the <strong>hour</strong> and by the <strong>part</strong>.</p>
<ul>
<li><strong>LCD Cost</strong> and <strong>LCD Lifespan</strong> — the resin panel loses power with use.
Its lifespan is counted in exposure <strong>hours</strong>.</li>
<li><strong>FEP Film Cost</strong> and <strong>FEP Durability</strong> — the tank's bottom film gets
scratched on every removed part. Durability is counted in <strong>prints</strong>.</li>
<li><strong>Washing (Alcohol)</strong> — cost per liter of isopropyl alcohol and volume used
per cycle. <strong>Water-washable</strong> resin zeroes this block automatically, since
the part is rinsed under the tap.</li>
<li><strong>UV Curing</strong> — curing time and lamp power, which also wears out.</li>
</ul>
<h2 id="user-content-the-formula">The formula</h2>
<p>For FDM the math is straightforward: the nozzle is prorated by the part weight,
the bed and the finishing are fixed per part.</p>
<pre><code>weightKg = partWeight / 1000

nozzleWear = (weightKg / lifespanKg) * nozzleCost
bedWear    = adhesiveCost
finishing  = finishingSupplies

hardware = nozzleWear + bedWear + finishing
</code></pre>
<p>On resin, the LCD is prorated by the hour and the FEP by the print:</p>
<pre><code>lcdWear = (exposureHours / lcdLifespanHours) * lcdCost
fepWear = (1 / fepDurability) * fepCost
</code></pre>
<h2 id="user-content-numeric-example-step-by-step">Numeric example, step by step</h2>
<p>Picture a <strong>phone stand</strong> in PLA, weighing <strong>180 g</strong>, printed with light
sanding and paint.</p>
<p>Step by step on FDM:</p>
<pre><code>weightKg = 180 / 1000 = 0.18 kg

nozzleWear = (0.18 / 20) * 35 = 0.009 * 35 = R$ 0.32
bedWear    = R$ 1.50
finishing  = R$ 2.00

hardware = 0.32 + 1.50 + 2.00 = R$ 3.82
</code></pre>
<p>The part just became <strong>R$ 3.82</strong> more expensive than "filament only". That is
R$ 0,32 of nozzle nobody remembers to charge — across a hundred identical parts
it is R$ 32 of nozzle alone, enough for a new nozzle and a coffee.</p>
<h2 id="user-content-how-this-section-relates-to-the-others">How this section relates to the others</h2>
<ul>
<li>The <strong>weight</strong> feeding the nozzle formula comes from the
<a href="#user-content-material">material</a> section — fill it first.</li>
<li>The LCD <strong>exposure time</strong> comes from the print time, in the
<a href="#user-content-print">print parameters</a> section.</li>
<li>Depreciation of the <strong>whole</strong> printer (the asset, not its parts) lives in the
<a href="#user-content-machine">machine</a> section. Hardware is the part that wears;
machine is the whole that depreciates.</li>
<li>The <strong>time</strong> you spend sanding and painting is charged separately, under
<a href="#user-content-labor">labor</a> — here only the supplies belong.</li>
<li>Everything here is summed up in <a href="#user-content-results">results</a>.</li>
</ul>
<h2 id="user-content-practical-pitfalls">Practical pitfalls</h2>
<ol>
<li><strong>Underestimating nozzle lifespan with abrasive filament.</strong> Carbon fiber
and glitter eat a brass nozzle in a few kilograms. If you print with those,
either drop the lifespan to 10 kg or switch to a steel nozzle.</li>
<li><strong>Forgetting the finishing.</strong> It is the most common zeroed field — and the
one that separates a "prototype" part from a "product" part. Sandpaper and
paint are not free.</li>
<li><strong>Mixing up wear with depreciation.</strong> If you put the printer's price here,
the cost gets duplicated: the whole printer is already being depreciated in
the <a href="#user-content-machine">machine</a> section. Only consumable parts belong
here.</li>
<li><strong>Measuring nozzle lifespan in parts, not kilograms.</strong> The nozzle wears by
the amount of material extruded, not by the number of files. An 800 g hollow
part wears the nozzle eight times more than a 100 g solid rod.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};