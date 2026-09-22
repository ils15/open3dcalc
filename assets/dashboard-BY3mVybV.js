var e=`dashboard`,t=`pt-BR`,n={title:`Dashboard`,order:23,tourId:`dashboard-kpis`},r=[{depth:1,text:`Dashboard`,slug:`user-content-dashboard`},{depth:2,text:`KPIs da estimativa ativa`,slug:`user-content-kpis-da-estimativa-ativa`},{depth:2,text:`KPIs do histórico`,slug:`user-content-kpis-do-histórico`},{depth:3,text:`Filtros de período`,slug:`user-content-filtros-de-período`},{depth:2,text:`Gráficos`,slug:`user-content-gráficos`},{depth:2,text:`Metas e alertas`,slug:`user-content-metas-e-alertas`},{depth:2,text:`Exportar o relatório`,slug:`user-content-exportar-o-relatório`},{depth:2,text:`Armadilhas comuns`,slug:`user-content-armadilhas-comuns`},{depth:2,text:`Começando do zero`,slug:`user-content-começando-do-zero`}],i=`<h1 id="user-content-dashboard">Dashboard</h1>
<p>O <strong>Dashboard</strong> é onde o app junta suas estimativas e mostra se o trabalho está
pagando. Custo, lucro, margem e tendência em uma só tela.</p>
<p>Vale mais que qualquer gráfico uma regra: <strong>o dashboard não inventa número</strong>.
Tudo o que aparece ali vem das estimativas que você salvou no <strong>Histórico</strong>,
somadas à estimativa que está aberta na
<a href="#user-content-calculadora">Calculadora</a>. Ele não lê orçamentos, não lê
faturamento e não consulta nenhum sistema externo.</p>
<p>Por isso a primeira visita costuma mostrar os gráficos vazios com a mensagem
<strong>"Sem dados de histórico"</strong>. Não é defeito nem configuração faltando — é o
estado normal de quem acabou de instalar. Salve três estimativas no Histórico,
volte aqui, e a mesma tela está preenchida.</p>
<h2 id="user-content-kpis-da-estimativa-ativa">KPIs da estimativa ativa</h2>
<p>O primeiro grupo de números acompanha a peça aberta na calculadora. Cada um
responde a uma pergunta diferente:</p>
<ul>
<li><strong>Custo Total</strong> — quanto a peça custa para sair</li>
<li><strong>Preço de Venda</strong> — o preço que a calculadora sugere</li>
<li><strong>Lucro Líquido</strong> — venda menos custo, em dinheiro</li>
<li><strong>ROI</strong> — o retorno sobre o dinheiro investido</li>
<li><strong>Ponto de Equilíbrio</strong> — quantas peças pagam o custo fixo do mês</li>
<li><strong>Receita no Equilíbrio</strong> — o faturamento desse ponto</li>
<li><strong>Projeção Mensal</strong> — o lucro se você mantiver o ritmo de produção</li>
</ul>
<p>O ROI é a porcentagem que o dinheiro investido rende:</p>
<pre><code>ROI = (lucro liquido / custo total) * 100
</code></pre>
<p>Uma peça que custa <strong>R$ 20,00</strong> e é vendida por <strong>R$ 30,00</strong> deixa R$ 10,00 de
lucro. O ROI é <code>(10 / 20) * 100 = 50%</code>: cada real investido rende cinquenta
centavos limpos.</p>
<p>O ponto de equilíbrio mostra quando a operação deixa de perder dinheiro:</p>
<pre><code>ponto de equilibrio = ceil(custo fixo mensal / margem por unidade)
</code></pre>
<p>Com <strong>R$ 600,00</strong> de custo fixo no mês e <strong>R$ 10,00</strong> de margem por peça, são
<code>ceil(600 / 10) = 60 peças</code>. A receita desse ponto é <code>60 * R$ 30,00</code>, ou seja,
<strong>R$ 1.800,00</strong> de faturamento só para empatar.</p>
<p>Quando a margem por unidade fica negativa, o app não calcula e avisa: peça
vendida abaixo do custo não tem ponto de equilíbrio, e a meta vira um aviso em
vez de meta.</p>
<p>A projeção mensal leva o lucro da peça até a quantidade que você pretende
produzir. Mantendo 100 unidades no exemplo, são <code>100 * R$ 10,00 = R$ 1.000,00</code>
de lucro projetado para o mês.</p>
<h2 id="user-content-kpis-do-histórico">KPIs do histórico</h2>
<p>O segundo grupo olha para trás e considera só o período dos filtros. Quatro
números resumem o que já passou pela calculadora:</p>
<ul>
<li><strong>Lucro Total</strong> — a soma do lucro de cada estimativa do período</li>
<li><strong>Custo Médio por Impressão</strong> — a média dos custos individuais</li>
<li><strong>Margem Média</strong> — a média das margens de cada estimativa</li>
<li><strong>Total de Impressões</strong> — quantas estimativas entram na conta</li>
</ul>
<p>A margem média não é o lucro total dividido pela receita. Cada estimativa
calcula a sua primeiro, e a média vem depois:</p>
<pre><code>margem media = media de (lucro / preco de venda * 100) de cada estimativa
</code></pre>
<p>É a mesma conta da peça única, repetida em cada item. Por isso uma peça barata
de margem alta move o número tanto quanto uma peça cara.</p>
<p>Imagine três estimativas salvas no mês:</p>
<ul>
<li><strong>Suporte N20</strong> — custo R$ 18,00, venda R$ 42,70, lucro <strong>R$ 24,70</strong></li>
<li><strong>Caixa para Raspberry</strong> — custo R$ 41,00, venda R$ 68,00, lucro <strong>R$ 27,00</strong></li>
<li><strong>Tag de identificação</strong> — custo R$ 1,20, venda R$ 8,00, lucro <strong>R$ 6,80</strong></li>
</ul>
<p>O lucro total é <strong>R$ 58,50</strong> e o total de impressões é <strong>3</strong>. O custo médio por
impressão fica <code>(18,00 + 41,00 + 1,20) / 3 = R$ 20,07</code>. As margens individuais
são 57,8%, 39,7% e 85,0%, o que dá <strong>margem média de 60,8%</strong>.</p>
<h3 id="user-content-filtros-de-período">Filtros de período</h3>
<p>Os filtros de data inicial e final escolhem o que entra na conta. Estreite o
período para um trimestre e você vê só ele; limpe os filtros e a volta é para o
histórico inteiro. Tudo no segundo grupo de KPIs e nos gráficos acompanha a
mesma janela.</p>
<h2 id="user-content-gráficos">Gráficos</h2>
<p>Quatro gráficos traduzem o histórico em imagem. Cada um responde a uma
pergunta:</p>
<ul>
<li><strong>Tendência de Lucro</strong> — o lucro está subindo ou baixando?</li>
<li><strong>Impressoras com Mais Lucro</strong> — qual máquina paga a conta?</li>
<li><strong>Materiais Mais Usados</strong> — onde está indo o seu filamento?</li>
<li><strong>Comparação de Períodos</strong> — este mês está melhor que o anterior?</li>
</ul>
<p>A <strong>Tendência de Lucro</strong> é um gráfico de área com o lucro ao longo do tempo. A
leitura mais útil não é o ponto mais alto, e sim a direção: uma curva que
cresce devagar já é sinal de que a precificação merece atenção.</p>
<p><strong>Impressoras com Mais Lucro</strong> e <strong>Materiais Mais Usados</strong> mostram o top 5 de
cada. Quando uma máquina aparece no topo, é ela que deve receber a próxima
peça; quando um material domina, é o que vale negociar em maior quantidade.</p>
<p>A <strong>Comparação de Períodos</strong> é um gráfico de pizza com o mês atual ao lado do
anterior. Se o mês soma R$ 850,00 e o anterior R$ 620,00, as fatias ficam 58%
e 42% — a predominância do mês atual já diz que o período está melhor.</p>
<h2 id="user-content-metas-e-alertas">Metas e alertas</h2>
<p>Você define uma <strong>meta de lucro mensal</strong> e o app guarda na sua máquina, na
chave <code>open3dcalc_dashboard_goal</code>. A partir dela é calculada a quantidade de
peças necessária:</p>
<pre><code>pecas necessarias = meta de lucro / lucro por peca
</code></pre>
<p>Com meta de <strong>R$ 2.000,00</strong> e lucro de <strong>R$ 10,00</strong> por peça, são 200 peças no
mês. Se a margem por unidade estiver negativa, nenhuma quantidade resolve —
por isso o app avisa em vez de mostrar um número sem sentido.</p>
<p>Os <strong>alertas de margem baixa</strong> marcam as estimativas com margem abaixo de 20%.
Uma peça vendida por <strong>R$ 25,00</strong> com custo de <strong>R$ 21,00</strong> tem margem de 16% e
entra na lista. Não é uma proibição: é onde o dinheiro está escapando sem
alarde.</p>
<h2 id="user-content-exportar-o-relatório">Exportar o relatório</h2>
<p>O <strong>Relatório Executivo</strong> sai em PDF. A exportação usa o <code>html2canvas</code> para
capturar o gráfico de tendência e monta o documento com os KPIs do período, o
top de impressoras, o top de materiais e a comparação entre os dois meses.</p>
<p>É o arquivo que você manda para um sócio ou guarda como registro do período,
sem que ninguém precise instalar nada para ler.</p>
<h2 id="user-content-armadilhas-comuns">Armadilhas comuns</h2>
<p>Quatro leituras erradas desta tela, e todas elas levam a uma decisão com o número errado.</p>
<ul>
<li><strong>Esperar que o dashboard mostre o faturamento.</strong> Ele não lê orçamentos e não consulta
sistema externo: só soma as estimativas do Histórico e a que está aberta. Orçamento
aprovado não aparece aqui enquanto não virar estimativa salva.</li>
<li><strong>Ler a margem média como lucro sobre a receita.</strong> Cada estimativa calcula a sua primeiro;
a média de 57,8%, 39,7% e 85,0% é 60,8%, mas não é o lucro total dividido pela receita.
Uma peça barata de margem alta move o número tanto quanto uma cara.</li>
<li><strong>Achar que a tela vazia é defeito.</strong> "Sem dados de histórico" é o estado normal de quem
acabou de instalar — salve três estimativas e a tela se enche. Não há configuração
faltando.</li>
<li><strong>Ignorar o alerta de margem baixa.</strong> A peça vendida por R$ 25,00 com custo de R$ 21,00
tem 16% de margem e entra na lista. Não é proibição: é onde o dinheiro escapa sem alarde.</li>
</ul>
<h2 id="user-content-começando-do-zero">Começando do zero</h2>
<p>Se o dashboard está vazio, o caminho é curto:</p>
<ol>
<li>calcule uma peça na aba <a href="#user-content-calculadora">Calculadora</a></li>
<li>salve a estimativa no <strong>Histórico</strong></li>
<li>repita com mais duas peças, de preferência de materiais diferentes</li>
<li>volte ao dashboard — KPIs e gráficos já têm o que mostrar</li>
</ol>
<p>O dashboard é um espelho do seu cadastro de estimativas. Não existe atalho para
preenchê-lo, mas também não existe segredo: cada estimativa salva é mais um
dado na tela.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};