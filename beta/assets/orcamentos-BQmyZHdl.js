var e=`orcamentos`,t=`en-US`,n={title:`Quotes`,order:3},r=[{depth:1,text:`Quotes`,slug:`user-content-quotes`},{depth:2,text:`Creating a quote`,slug:`user-content-creating-a-quote`},{depth:2,text:`Customers`,slug:`user-content-customers`},{depth:2,text:`Tracking`,slug:`user-content-tracking`},{depth:2,text:`Relation to the calculator`,slug:`user-content-relation-to-the-calculator`}],i=`<h1 id="user-content-quotes">Quotes</h1>
<p>The <strong>Quotes</strong> tab turns an estimate into a document you can send to a client,
with a history and a customer record attached.</p>
<h2 id="user-content-creating-a-quote">Creating a quote</h2>
<p>The basic flow is:</p>
<ol>
<li>compute the estimate on the <strong>Calculator</strong> tab</li>
<li>open <strong>Quotes</strong> and start a new quote from that estimate</li>
<li>review costs, margin and validity</li>
<li>save it and, on desktop, export the PDF</li>
</ol>
<h2 id="user-content-customers">Customers</h2>
<p>The customer registry keeps name and contact next to the quotes, so the history
stays organized by whoever received each proposal.</p>
<h2 id="user-content-tracking">Tracking</h2>
<p>Every quote records its state, so it is easy to tell apart:</p>
<ul>
<li>proposals not yet sent</li>
<li>proposals awaiting a reply</li>
<li>approved or rejected proposals</li>
</ul>
<pre><code>quote = estimate + customer + validity + state
</code></pre>
<h2 id="user-content-relation-to-the-calculator">Relation to the calculator</h2>
<p>A quote is a snapshot of the estimate at the moment it was created: editing the
calculator afterwards does not rewrite the saved quote. That keeps the document
you sent the client consistent with what was agreed.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};