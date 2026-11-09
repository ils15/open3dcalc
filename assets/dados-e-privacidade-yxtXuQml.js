var e=`dados-e-privacidade`,t=`en-US`,n={title:`Data & Privacy`,order:25},r=[{depth:1,text:`Data & Privacy`,slug:`user-content-data--privacy`},{depth:2,text:`What stays local`,slug:`user-content-what-stays-local`},{depth:2,text:`Take your data with you`,slug:`user-content-take-your-data-with-you`},{depth:2,text:`Import data from the test profile (Beta)`,slug:`user-content-import-data-from-the-test-profile-beta`},{depth:2,text:`Demo mode`,slug:`user-content-demo-mode`},{depth:2,text:`Deleting`,slug:`user-content-deleting`}],i=`<h1 id="user-content-data--privacy">Data &#x26; Privacy</h1>
<p>Everything you register and save in Open3DCalc lives <strong>on your device</strong> — in
the browser profile (web) or the app's local database (desktop). Nothing is
sent to servers. The <strong>Privacy</strong> screen documents this and doubles as your
data control panel.</p>
<h2 id="user-content-what-stays-local">What stays local</h2>
<ul>
<li>Saved calculations, customers, quotes, products, catalog and stock live in
readable local keys — with no additional app-side encryption. Anyone with
access to your profile can read them; anyone without, sees nothing.</li>
<li>No data leaves the device: there is no login, cloud sync or telemetry.</li>
</ul>
<h2 id="user-content-take-your-data-with-you">Take your data with you</h2>
<p>On the <strong>Privacy</strong> screen, the <strong>"Take your data with you"</strong> section exports a
<strong>readable</strong> JSON file with everything (history, customers, quotes, catalog,
stock, products, theme) plus an integrity <strong>checksum</strong>. Import accepts that
file in two modes:</p>
<ul>
<li><strong>Merge</strong> — adds records to what already exists, keeping both;</li>
<li><strong>Replace</strong> — wipes the current data before importing (asks for
confirmation).</li>
</ul>
<p>This is your backup: export regularly and keep the file safe.</p>
<h2 id="user-content-import-data-from-the-test-profile-beta">Import data from the test profile (Beta)</h2>
<p>If you used the Beta channel in this browser, your test data (customers,
quotes and history) lives in a separate profile. The <strong>"Import data from the
test profile"</strong> section brings those records into this stable profile with one
tap: per-type preview, ids preserved, duplicates skipped, and the test source
<strong>always preserved</strong> — importing does not wipe the Beta.</p>
<h2 id="user-content-demo-mode">Demo mode</h2>
<p><strong>Demo mode</strong> loads a sample workshop ("Estúdio Maria Print") on top of your
data, with a permanent on-screen banner and the <strong>[DEMO]</strong> badge in the tab
title. On exit, your real data is restored byte-for-byte — the demo never
writes to it.</p>
<h2 id="user-content-deleting">Deleting</h2>
<p>Deletion is scoped and always confirmed: you delete what you chose (customers,
history, everything) and receive a report of what was removed.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};