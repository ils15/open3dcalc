var e=`calculadora`,t=`pt-BR`,n={title:`Calculadora`,order:1},r=[{depth:1,text:`Calculadora`,slug:`user-content-calculadora`},{depth:2,text:`Níveis básico e avançado`,slug:`user-content-níveis-básico-e-avançado`},{depth:2,text:`Seções de custo do nível avançado`,slug:`user-content-seções-de-custo-do-nível-avançado`},{depth:2,text:`Preço de venda`,slug:`user-content-preço-de-venda`}],i=`<h1 id="user-content-calculadora">Calculadora</h1>
<p>A <strong>Calculadora</strong> é o núcleo do Open3DCalc: ela estima o custo de uma impressão
3D a partir de poucos dados de entrada e divide o resultado em seções
auditáveis, sem esconder como cada valor é composto.</p>
<h2 id="user-content-níveis-básico-e-avançado">Níveis básico e avançado</h2>
<p>A calculadora tem dois níveis de detalhe:</p>
<ul>
<li><strong>Básico</strong>: apenas as informações essenciais, para uma estimativa rápida.</li>
<li><strong>Avançado</strong>: revela todas as seções de custo, do material ao preço de venda.</li>
</ul>
<p>Mudar de nível não apaga nada do que já foi preenchido.</p>
<h2 id="user-content-seções-de-custo-do-nível-avançado">Seções de custo do nível avançado</h2>
<p>Cada estimativa avançada é composta por seções independentes:</p>
<ol>
<li><code>material</code> — filamento consumido, incluindo falhas e retrabalho.</li>
<li><code>hardware</code> — amortização dos componentes da impressora.</li>
<li><code>machine</code> — tempo de máquina e consumo de energia.</li>
<li><code>fixedCost</code> — custos fixos rateados, como aluguel e manutenção.</li>
<li><code>labor</code> — mão de obra do preparo e do pós-processamento.</li>
<li><code>ops</code> — insumos e operação adicionais.</li>
<li><code>sales</code> — impostos, taxas e margem de venda.</li>
<li><code>results</code> — consolidação e preço final sugerido.</li>
</ol>
<h2 id="user-content-preço-de-venda">Preço de venda</h2>
<p>A seção <code>results</code> mostra o custo total e o preço de venda sugerido lado a lado,
para que a margem seja uma escolha consciente e não um arredondamento oculto.</p>
<pre><code>custo total = material + hardware + machine
            + fixedCost + labor + ops
preco de venda = custo total + sales
</code></pre>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};