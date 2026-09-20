var e=`dashboard`,t=`en-US`,n={title:`Dashboard`,order:23,tourId:`dashboard-kpis`},r=[{depth:1,text:`Dashboard`,slug:`user-content-dashboard`},{depth:2,text:`KPIs of the active estimate`,slug:`user-content-kpis-of-the-active-estimate`},{depth:2,text:`KPIs of the history`,slug:`user-content-kpis-of-the-history`},{depth:3,text:`Period filters`,slug:`user-content-period-filters`},{depth:2,text:`Charts`,slug:`user-content-charts`},{depth:2,text:`Goals and alerts`,slug:`user-content-goals-and-alerts`},{depth:2,text:`Exporting the report`,slug:`user-content-exporting-the-report`},{depth:2,text:`Starting from scratch`,slug:`user-content-starting-from-scratch`}],i=`<h1 id="user-content-dashboard">Dashboard</h1>
<p>The <strong>Dashboard</strong> is where the app gathers your estimates and shows whether the
work is paying off. Cost, profit, margin and trend on a single screen.</p>
<p>One rule matters more than any chart: <strong>the dashboard invents no number</strong>.
Everything on it comes from the estimates you saved to <strong>History</strong>, plus the
estimate currently open in the
<a href="#user-content-calculator">Calculator</a>. It reads no quotes, reads no revenue
and queries no external system.</p>
<p>That is why a first visit usually shows empty charts and the message <strong>"No
history data"</strong>. It is not a bug and not a missing setting — it is the normal
state for someone who just installed the app. Save three estimates to History,
come back here, and the same screen is filled in.</p>
<h2 id="user-content-kpis-of-the-active-estimate">KPIs of the active estimate</h2>
<p>The first group of numbers follows the part open in the calculator. Each one
answers a different question:</p>
<ul>
<li><strong>Total Cost</strong> — how much the part costs to produce</li>
<li><strong>Selling Price</strong> — the price the calculator suggests</li>
<li><strong>Net Profit</strong> — revenue minus cost, in money</li>
<li><strong>ROI</strong> — the return on the money invested</li>
<li><strong>Break-Even Point</strong> — how many parts cover the monthly fixed cost</li>
<li><strong>Break-Even Revenue</strong> — the revenue at that point</li>
<li><strong>Monthly Projection</strong> — the profit if you keep your production pace</li>
</ul>
<p>ROI is the percentage the invested money yields:</p>
<pre><code>ROI = (net profit / total cost) * 100
</code></pre>
<p>A part that costs <strong>R$ 20.00</strong> and sells for <strong>R$ 30.00</strong> leaves R$ 10.00 of
profit. The ROI is <code>(10 / 20) * 100 = 50%</code>: every real invested returns fifty
cents clean.</p>
<p>The break-even point shows when the operation stops losing money:</p>
<pre><code>break-even point = ceil(monthly fixed cost / margin per unit)
</code></pre>
<p>With <strong>R$ 600.00</strong> of monthly fixed cost and <strong>R$ 10.00</strong> of margin per part,
that is <code>ceil(600 / 10) = 60 parts</code>. The revenue at this point is
<code>60 * R$ 30.00</code>, or <strong>R$ 1,800.00</strong> of revenue just to break even.</p>
<p>When the margin per unit goes negative, the app does not compute it and warns
instead: a part sold below cost has no break-even point, and the goal becomes a
warning rather than a goal.</p>
<p>The monthly projection takes the part's profit up to the quantity you plan to
produce. Holding 100 units in the example, that is
<code>100 * R$ 10.00 = R$ 1,000.00</code> of projected profit for the month.</p>
<h2 id="user-content-kpis-of-the-history">KPIs of the history</h2>
<p>The second group looks backwards and counts only the filtered period. Four
numbers summarize what has already passed through the calculator:</p>
<ul>
<li><strong>Total Profit</strong> — the sum of each estimate's profit in the period</li>
<li><strong>Average Cost per Print</strong> — the mean of the individual costs</li>
<li><strong>Average Margin</strong> — the mean of each estimate's margin</li>
<li><strong>Total Prints</strong> — how many estimates are counted</li>
</ul>
<p>The average margin is not total profit divided by revenue. Each estimate
computes its own first, and the mean comes after:</p>
<pre><code>average margin = mean of (profit / selling price * 100) for each estimate
</code></pre>
<p>It is the same calculation as for a single part, repeated per item. That is why
a cheap part with a high margin moves the number as much as an expensive one.</p>
<p>Picture three estimates saved in the month:</p>
<ul>
<li><strong>N20 motor mount</strong> — cost R$ 18.00, sale R$ 42.70, profit <strong>R$ 24.70</strong></li>
<li><strong>Raspberry case</strong> — cost R$ 41.00, sale R$ 68.00, profit <strong>R$ 27.00</strong></li>
<li><strong>Identification tag</strong> — cost R$ 1.20, sale R$ 8.00, profit <strong>R$ 6.80</strong></li>
</ul>
<p>Total profit is <strong>R$ 58.50</strong> and total prints are <strong>3</strong>. The average cost per
print is <code>(18.00 + 41.00 + 1.20) / 3 = R$ 20.07</code>. The individual margins are
57.8%, 39.7% and 85.0%, which gives an <strong>average margin of 60.8%</strong>.</p>
<h3 id="user-content-period-filters">Period filters</h3>
<p>The start and end date filters choose what gets counted. Narrow the period to a
quarter and you see only that; clear the filters and the view returns to the
whole history. Everything in the second KPI group and in the charts follows the
same window.</p>
<h2 id="user-content-charts">Charts</h2>
<p>Four charts turn the history into pictures. Each one answers a question:</p>
<ul>
<li><strong>Profit Trend</strong> — is profit going up or down?</li>
<li><strong>Most Profitable Printers</strong> — which machine pays the bill?</li>
<li><strong>Most Used Materials</strong> — where is your filament going?</li>
<li><strong>Period Comparison</strong> — is this month better than the last?</li>
</ul>
<p>The <strong>Profit Trend</strong> is an area chart of profit over time. The most useful read
is not the highest point but the direction: a curve that climbs slowly is
already a sign that pricing deserves attention.</p>
<p><strong>Most Profitable Printers</strong> and <strong>Most Used Materials</strong> show the top 5 of
each. When a machine sits at the top, it is the one that should take the next
part; when a material dominates, that is what is worth buying in larger
quantities.</p>
<p>The <strong>Period Comparison</strong> is a pie chart with the current month next to the
previous one. If this month totals R$ 850.00 and the last one R$ 620.00, the
slices are 58% and 42% — the current month's share already tells you the period
is better.</p>
<h2 id="user-content-goals-and-alerts">Goals and alerts</h2>
<p>You set a <strong>monthly profit goal</strong> and the app stores it on your machine, under
the key <code>open3dcalc_dashboard_goal</code>. From that, the required part count is
calculated:</p>
<pre><code>required parts = profit goal / profit per part
</code></pre>
<p>With a goal of <strong>R$ 2,000.00</strong> and <strong>R$ 10.00</strong> of profit per part, that is 200
parts in the month. If the margin per unit is negative, no quantity fixes it —
so the app warns instead of showing a meaningless number.</p>
<p>The <strong>low margin alerts</strong> flag estimates whose margin is below 20%. A part sold
for <strong>R$ 25.00</strong> at a cost of <strong>R$ 21.00</strong> has a 16% margin and lands on the
list. It is not a prohibition: it is where money is slipping away unnoticed.</p>
<h2 id="user-content-exporting-the-report">Exporting the report</h2>
<p>The <strong>Executive Report</strong> exports as PDF. The export uses <code>html2canvas</code> to
capture the trend chart and builds the document with the period KPIs, the top
printers, the top materials and the comparison between the two months.</p>
<p>It is the file you send to a partner or keep as a record of the period, without
anyone needing to install anything to read it.</p>
<h2 id="user-content-starting-from-scratch">Starting from scratch</h2>
<p>If the dashboard is empty, the path is short:</p>
<ol>
<li>calculate a part in the <a href="#user-content-calculator">Calculator</a> tab</li>
<li>save the estimate to <strong>History</strong></li>
<li>repeat with two more parts, preferably in different materials</li>
<li>return to the dashboard — KPIs and charts now have something to show</li>
</ol>
<p>The dashboard is a mirror of your saved estimates. There is no shortcut to fill
it, but no secret either: every estimate saved is one more data point on the
screen.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};