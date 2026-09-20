var e=`calculadora`,t=`en-US`,n={title:`Calculator`,order:1},r=[{depth:1,text:`Calculator`,slug:`user-content-calculator`},{depth:2,text:`Basic and advanced levels`,slug:`user-content-basic-and-advanced-levels`},{depth:2,text:`Advanced cost sections`,slug:`user-content-advanced-cost-sections`},{depth:2,text:`Sale price`,slug:`user-content-sale-price`}],i=`<h1 id="user-content-calculator">Calculator</h1>
<p>The <strong>Calculator</strong> is the heart of Open3DCalc: it estimates the cost of a 3D
print from a handful of inputs and breaks the result down into auditable
sections, never hiding how each value is composed.</p>
<h2 id="user-content-basic-and-advanced-levels">Basic and advanced levels</h2>
<p>The calculator has two detail levels:</p>
<ul>
<li><strong>Basic</strong>: only the essentials, for a quick estimate.</li>
<li><strong>Advanced</strong>: reveals every cost section, from material to sale price.</li>
</ul>
<p>Switching levels never clears what you have already filled in.</p>
<h2 id="user-content-advanced-cost-sections">Advanced cost sections</h2>
<p>Every advanced estimate is built from independent sections:</p>
<ol>
<li><code>material</code> — filament consumed, including failures and rework.</li>
<li><code>hardware</code> — depreciation of the printer components.</li>
<li><code>machine</code> — machine time and power consumption.</li>
<li><code>fixedCost</code> — apportioned fixed costs such as rent and maintenance.</li>
<li><code>labor</code> — labor for setup and post-processing.</li>
<li><code>ops</code> — additional supplies and operation.</li>
<li><code>sales</code> — taxes, fees and sales margin.</li>
<li><code>results</code> — consolidation and suggested final price.</li>
</ol>
<h2 id="user-content-sale-price">Sale price</h2>
<p>The <code>results</code> section shows total cost and suggested sale price side by side,
so the margin is a conscious choice instead of a hidden rounding.</p>
<pre><code>total cost = material + hardware + machine
           + fixedCost + labor + ops
sale price = total cost + sales
</code></pre>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};