var e=`inventario`,t=`en-US`,n={title:`Inventory`,order:20,tourId:`inventario-bobinas`},r=[{depth:1,text:`Inventory`,slug:`user-content-inventory`},{depth:2,text:`The Filaments tab`,slug:`user-content-the-filaments-tab`},{depth:2,text:`The Cadastros tab`,slug:`user-content-the-cadastros-tab`},{depth:2,text:`How each field reaches the estimate`,slug:`user-content-how-each-field-reaches-the-estimate`},{depth:2,text:`Generic estimate vs. real catalog`,slug:`user-content-generic-estimate-vs-real-catalog`},{depth:2,text:`Partial spools, tare and coverage`,slug:`user-content-partial-spools-tare-and-coverage`},{depth:2,text:`Pitfalls that cost money`,slug:`user-content-pitfalls-that-cost-money`},{depth:2,text:`Why it pays off`,slug:`user-content-why-it-pays-off`}],i=`<h1 id="user-content-inventory">Inventory</h1>
<p>The <strong>Inventory</strong> is the catalog that feeds the calculator. Instead of
estimating cost from generic values, you enter once what you bought and what
you use — and every estimate starts from real numbers.</p>
<p>It lives across two tabs, side by side in the app:</p>
<ul>
<li><strong>Filaments</strong>: the filament spools on your shelf.</li>
<li><strong>Cadastros</strong>: printers, materials and marketplaces used as presets.</li>
</ul>
<p>Every field in those tabs is read by a specific calculator section. Get one
wrong and every quote that uses it comes out wrong — which is why this catalog
is the cheapest place to gain accuracy.</p>
<h2 id="user-content-the-filaments-tab">The Filaments tab</h2>
<p>Each entry is a physical <strong>spool</strong>, with these fields:</p>
<ul>
<li><strong>Brand</strong> and <strong>material</strong> (PLA, PETG, ABS, TPU, ASA, SILK...).</li>
<li><strong>Color</strong> and its hex value, to tell similar spools apart.</li>
<li><strong>Remaining weight</strong> and <strong>original weight</strong>, in grams.</li>
<li><strong>Price per kg</strong>, meaning what you actually paid per kilogram.</li>
<li><strong>Diameter</strong>, in millimeters — the default is <code>1.75</code>.</li>
<li><strong>Status</strong>: <code>In stock</code>, <code>On the way</code> or <code>Empty</code>.</li>
<li><strong>Spool tare</strong>, the weight of the empty bobbin.</li>
<li><strong>Where bought</strong> and <strong>notes</strong>, free-form.</li>
</ul>
<p>The list filters by material and by status, so you quickly find the right
spool before starting a print.</p>
<h2 id="user-content-the-cadastros-tab">The Cadastros tab</h2>
<p>Three preset catalogs:</p>
<ul>
<li><strong>Printers</strong>: name, brand, <strong>power</strong> (W), <strong>value</strong> (R$), <strong>useful life</strong>
in hours, <strong>maintenance per hour</strong> (R$/h) and free-form organizing tags.</li>
<li><strong>Materials</strong>: name, <strong>type</strong> (<code>fdm</code> or <code>resin</code>), <strong>density</strong> (g/cm³) and
<strong>average price</strong> (R$/kg).</li>
<li><strong>Marketplaces</strong>: name, <strong>percent fee</strong>, <strong>fixed fee</strong>, <strong>free shipping</strong>
and the <strong>shipping percentage</strong>.</li>
</ul>
<p>The app ships a ready-made list of materials (PLA, PETG, ABS, ASA, TPU,
Nylon, PC and the carbon-fiber blends) and of known printers. You can edit any
preset or create a custom one.</p>
<h2 id="user-content-how-each-field-reaches-the-estimate">How each field reaches the estimate</h2>
<p>The calculator splits cost into independent sections, and the inventory feeds
four of them:</p>
<ul>
<li>price per kg, remaining weight and spool diameter → <a href="#user-content-material">Material</a> section</li>
<li>printer value, useful life and monthly maintenance → <a href="#user-content-machine-costs">Machine</a> section</li>
<li>printer power and energy rate → <a href="#user-content-print-parameters">Print</a> section</li>
<li>marketplace fees and shipping → <a href="#user-content-additional-costs-and-sales">Sales</a> section</li>
</ul>
<pre><code>material = (part weight + failure weight) * price per kg / 1000
machine  = ((printer value / useful life) + (monthly maintenance / hours per month) + fixed share) * hours
print    = (power / 1000) * hours * energy rate
</code></pre>
<p>Diameter comes first: it converts the model volume into weight. That is why
the default is <code>1.75</code> — a <code>0.05</code> mm deviation already shifts volume by about
<code>5.7%</code>, and weight along with it.</p>
<h2 id="user-content-generic-estimate-vs-real-catalog">Generic estimate vs. real catalog</h2>
<p>Picture a <strong>180 g</strong> part. With the generic PLA preset at R$ 90/kg:</p>
<pre><code>material = 0.180 kg * R$ 90 = R$ 16.20
</code></pre>
<p>You paid R$ 112/kg for a specific PLA Silk. With the catalog updated:</p>
<pre><code>material = 0.180 kg * R$ 112 = R$ 20.16
</code></pre>
<p>That is <strong>R$ 3.96 more</strong> per part — 24% above what the generic estimate
showed. Over a 50-part month, R$ 198 of margin would quietly vanish. The
catalog does not change what you paid; it just shows the truth.</p>
<p>The same applies to the machine. An R$ 1,800 printer with a 2,000-hour useful
life costs <strong>R$ 0.90 per hour</strong> of use, so a 6-hour print carries R$ 5.40 of
depreciation — that amount lands in the Machine section. The registered power
feeds a different section, Print: 350 W over 6 hours at R$ 0.75 per kWh adds
another R$ 1.58 of energy. Without those fields filled in, the calculator has
no way to guess either number.</p>
<h2 id="user-content-partial-spools-tare-and-coverage">Partial spools, tare and coverage</h2>
<p><strong>Remaining weight</strong> is what makes the inventory useful day to day. It tracks
the calculator: the active part and the current quantity define how much
plastic the run needs, and each spool answers whether it can cover it:</p>
<pre><code>needed    = part unit weight * quantity
coverage  = spool remaining weight - needed
</code></pre>
<p>When it falls short, the app shows <strong>"Does not cover the part"</strong> along with
how many grams are missing. That way you swap the spool before printing,
not mid-print.</p>
<p>To weigh a partial spool on a scale, fill in the <strong>tare</strong>. Without it, the
reading includes the empty bobbin. The app knows the tares by brand (Bambu Lab
210 g, Prusament 194 g, Polymaker 140 g, Anycubic 127 g) and applies that
table automatically — but a tare measured on the actual spool always beats
the table, because lot variation is real.</p>
<p>Example: the scale reads 400 g on a Bambu Lab spool. Discounting the 210 g
tare leaves <strong>190 g</strong> of actual filament. Skipping the tare would make the
calculator overstate the material by more than 100%.</p>
<h2 id="user-content-pitfalls-that-cost-money">Pitfalls that cost money</h2>
<p>Four silent catalog mistakes, each one enough to strip the accuracy out of every estimate.</p>
<ul>
<li><strong>Wrong density</strong>: ABS is 1.04 g/cm³, PLA is 1.24. A 100 cm³ part is 104 g
of ABS or 124 g of PLA — a 20 g difference. Estimate by volume with the
wrong material's density and both the weight and the cost come out wrong.</li>
<li><strong>Price per spool, not per kg</strong>: a 1 kg spool at R$ 90 is R$ 90/kg; a
500 g "economy" spool at R$ 65 is R$ 130/kg — 44% more per gram.</li>
<li><strong>Partial spool ignored</strong>: quoting with the original weight of a half-empty
spool breaks coverage right when you go to print.</li>
<li><strong>Stale status</strong>: a spool still marked <code>In stock</code> but empty fools the filter
when you pick the filament.</li>
</ul>
<h2 id="user-content-why-it-pays-off">Why it pays off</h2>
<p>Filling this in is a one-time job. Every field you enter makes every later
estimate more precise, with no purchases and no process change. No other
lever in the app buys this much accuracy for this little effort — start with
the printer and the material you use most, and the rest gets easier.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};