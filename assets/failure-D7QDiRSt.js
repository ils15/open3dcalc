var e=`failure`,t=`pt-BR`,n={title:`Risco e Falhas`,order:12},r=[{depth:1,text:`Risco e Falhas`,slug:`user-content-risco-e-falhas`},{depth:2,text:`Os campos`,slug:`user-content-os-campos`},{depth:2,text:`Como o cálculo funciona`,slug:`user-content-como-o-cálculo-funciona`},{depth:2,text:`Exemplo numérico`,slug:`user-content-exemplo-numérico`},{depth:2,text:`De onde vem a sua taxa`,slug:`user-content-de-onde-vem-a-sua-taxa`},{depth:2,text:`Armadilhas comuns`,slug:`user-content-armadilhas-comuns`}],i=`<h1 id="user-content-risco-e-falhas">Risco e Falhas</h1>
<p>A seção <strong>failure</strong> existe porque uma peça falhada não é um acidente — é um
custo. Toda impressão que dá errado consome filamento, energia e horas de
máquina que não geram venda nenhuma. Quem vende peça sem incluir essa perda no
preço está pagando do próprio bolso por cada falha.</p>
<p>A seção é <strong>opcional por design</strong>: ela fica desativada no nível <strong>Rápido</strong> e
aparece a partir do <strong>Detalhado</strong>, porque ela só faz sentido para quem já
produziu o suficiente para ter uma noção real da sua taxa de perda. Se você
imprime esporadicamente, o custo de falha pode ser zero; se vende centenas de
peças por mês, ignorá-lo é prejuízo certo.</p>
<h2 id="user-content-os-campos">Os campos</h2>
<p>A seção inteira se resume a quatro campos, e cada um controla uma parte da conta.</p>
<ul>
<li><strong>Ativar custo de falha</strong> — a seção inteira é ligada ou desligada por um
interruptor. Desligada, ela não soma nada, e o resto do cálculo não muda.</li>
<li><strong>Modo de falha</strong> — como a perda é medida: <strong>Percentual</strong> (uma taxa sobre o
custo de produção) ou <strong>Fixo</strong> (um valor em reais por peça).</li>
<li><strong>Valor da falha</strong> — no modo percentual, a porcentagem esperada de perda; no
modo fixo, o custo de cada falha. Dez por cento é um bom ponto de partida
para começar.</li>
<li><strong>Multiplicador de risco</strong> — um fator aplicado sobre a taxa de falha para
cenários mais arriscados (peças grandes, materiais difíceis, primeira vez num
modelo novo).</li>
</ul>
<h2 id="user-content-como-o-cálculo-funciona">Como o cálculo funciona</h2>
<p>No modo <strong>fixo</strong>, a lógica é direta: o valor da falha é somado ao custo de cada
peça, sem surpresa.</p>
<pre><code>custo de falha (fixo) = valor da falha
</code></pre>
<p>No modo <strong>percentual</strong>, a taxa é aplicada sobre o <strong>custo de produção</strong> — a
soma de material, energia, máquina, hardware, mão de obra e operação, antes de
embalagem e frete. O multiplicador de risco, quando existe, altera a taxa antes
dela ser aplicada:</p>
<pre><code>taxa ajustada     = valor da falha * multiplicador de risco
custo de falha    = custo de produção * (taxa ajustada / 100)
</code></pre>
<p>A ordem importa: a falha incide sobre o que a peça <strong>consumiu de verdade</strong>, e
não sobre o preço final. Assim, uma falha de 10% sobre um custo de produção de
R$ 20,00 é R$ 2,00 — e não 10% de um preço de venda inflado.</p>
<h2 id="user-content-exemplo-numérico">Exemplo numérico</h2>
<p>Suponha uma peça com R$ 20,00 de custo de produção e uma taxa de falha de 10%:</p>
<pre><code>custo de falha = 20,00 * (10 / 100) = R$ 2,00
</code></pre>
<p>Cada peça que você entrega carrega R$ 2,00 das que deram errado. Agora o mesmo
print num cenário de risco alto — um modelo grande que você nunca imprimiu,
com multiplicador de risco de 1,5:</p>
<pre><code>taxa ajustada  = 10 * 1,5           = 15%
custo de falha = 20,00 * (15 / 100) = R$ 3,00
</code></pre>
<p>A diferença é o multiplicador fazendo o seu trabalho: ele te obriga a reconhecer
que um print arriscado custa mais que um print rotineiro. Se a peça sair de
primeira, você ganhou os R$ 3,00; se falhar, eles já estavam no preço.</p>
<p>No modo <strong>fixo</strong>, a mesma peça com um custo de R$ 4,00 por falha simplesmente
soma R$ 4,00 ao custo de cada peça entregue — útil quando você conhece o valor
médio de uma tentativa perdida e prefere trabalhar com um número em reais.</p>
<h2 id="user-content-de-onde-vem-a-sua-taxa">De onde vem a sua taxa</h2>
<p>Não existe taxa universal — a sua vem do seu próprio histórico. Algumas
referências práticas:</p>
<ul>
<li><strong>Iniciante em FDM, peças simples</strong>: 5–10%. PLA é tolerante e modelos pequenos
raramente falham.</li>
<li><strong>Peças técnicas ou altas</strong>: 15–20%. Mais tempo de máquina significa mais
exposição a um problema no meio do print.</li>
<li><strong>Resina</strong>: costuma ser maior. A peça pode falhar na impressão, na lavagem ou
na cura — três etapas em vez de uma.</li>
<li><strong>Modelo novo ou cliente exigente</strong>: use o multiplicador de risco. A primeira
unidade de qualquer série tem uma taxa de perda muito maior que a décima.</li>
</ul>
<p>O lugar certo para descobrir a sua taxa é o <strong>histórico</strong> de peças que você já
fez, não um palpite. Se você registrou suas tentativas, divida as que falharam
pelo total e terá o número para pôr no campo.</p>
<h2 id="user-content-armadilhas-comuns">Armadilhas comuns</h2>
<p>Quatro erros cercam esta seção, e todos eles fazem a perda sair do seu bolso, não do preço.</p>
<ul>
<li><strong>Manter a falha desligada "para baratear".</strong> Ela não torna o preço mais
competitivo — apenas transfere a perda do cliente para você. Quando a falha
inevitavelmente acontece, saiu do seu lucro.</li>
<li><strong>Aplicar a taxa sobre o preço de venda.</strong> A falha é proporcional ao custo de
produção, não ao preço. Usar a base errada dobra o valor e infla o preço.</li>
<li><strong>Ignorar o multiplicador em prints grandes.</strong> Uma peça de 30 horas não tem a
mesma taxa de risco de uma de 30 minutos; o multiplicador existe justamente
para esses casos.</li>
<li><strong>Taxa de 0%.</strong> Só é honesto se você realmente nunca perde uma peça. Mesmo
quem imprime há anos tem perdas esporádicas — 5% já cobre a maioria delas.</li>
</ul>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};