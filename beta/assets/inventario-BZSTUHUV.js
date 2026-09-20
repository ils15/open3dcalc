var e=`inventario`,t=`en-US`,n={title:`Inventory`,order:2},r=[{depth:1,text:`Inventory`,slug:`user-content-inventory`},{depth:2,text:`Filaments`,slug:`user-content-filaments`},{depth:2,text:`Machines`,slug:`user-content-machines`},{depth:2,text:`How inventory reaches the estimate`,slug:`user-content-how-inventory-reaches-the-estimate`}],i=`<h1 id="user-content-inventory">Inventory</h1>
<p>The <strong>Inventory</strong> tab catalogs filaments and machines so the calculator can use
real values instead of generic defaults. A well-kept catalog is what separates
a guess from a reliable cost.</p>
<h2 id="user-content-filaments">Filaments</h2>
<p>Each filament stores the data that feeds the <code>material</code> section:</p>
<ul>
<li>material diameter and density</li>
<li>price paid and spool quantity</li>
<li>recommended extrusion temperature</li>
</ul>
<h2 id="user-content-machines">Machines</h2>
<p>Each machine describes the hardware that will be depreciated in the <code>hardware</code>
section:</p>
<ul>
<li>printer acquisition cost</li>
<li>estimated lifetime hours</li>
<li>power draw in Watts</li>
</ul>
<h2 id="user-content-how-inventory-reaches-the-estimate">How inventory reaches the estimate</h2>
<p>Selecting a cataloged filament and machine makes the calculator replace its
defaults with yours:</p>
<pre><code>material cost = (part weight + failure weight) * price per gram
hardware cost = (hours used / lifetime) * machine price
</code></pre>
<p>Keeping the inventory current is the cheapest way to gain accuracy.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};