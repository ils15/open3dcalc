var e=`results`,t=`pt-BR`,n={title:`Resultados`,order:19},r=[{depth:1,text:`Resultados`,slug:`user-content-resultados`},{depth:2,text:`A ordem da soma importa`,slug:`user-content-a-ordem-da-soma-importa`},{depth:2,text:`Marcas importantes do resultado`,slug:`user-content-marcas-importantes-do-resultado`},{depth:2,text:`Exemplo numérico completo`,slug:`user-content-exemplo-numérico-completo`},{depth:2,text:`A lição escondida no exemplo`,slug:`user-content-a-lição-escondida-no-exemplo`},{depth:2,text:`Modo margem alvo e preço personalizado`,slug:`user-content-modo-margem-alvo-e-preço-personalizado`},{depth:2,text:`Projeção mensal e lotes`,slug:`user-content-projeção-mensal-e-lotes`},{depth:2,text:`Como esta seção se relaciona com as demais`,slug:`user-content-como-esta-seção-se-relaciona-com-as-demais`},{depth:2,text:`Armadilhas práticas`,slug:`user-content-armadilhas-práticas`}],i=`<h1 id="user-content-resultados">Resultados</h1>
<p>A seção <strong>Resultados</strong> é onde tudo se encontra: pega cada custo das outras seções,
soma na ordem certa e responde às três perguntas que importam — <strong>quanto a peça
custou</strong>, <strong>por quanto deve ser vendida</strong> e <strong>quanto sobra de lucro</strong>.</p>
<p>Diferente das outras seções avançadas, os resultados aparecem em <strong>todos os
níveis</strong>. O que muda é o detalhe das parcelas; a consolidação final está sempre
lá.</p>
<h2 id="user-content-a-ordem-da-soma-importa">A ordem da soma importa</h2>
<p>O preço de venda não é "custo mais um acréscimo". É uma sequência em que cada
etapa adiciona algo diferente:</p>
<pre><code>custoProducao = material + energia + maquina + hardware
              + epi + maoDeObra + software + acabamento + extras

custoBase = custoProducao + falhas + embalagem + frete

lucroBruto = custoBase * (margem / 100)

precoAntesTaxas = custoBase + lucroBruto

precoVenda = precoAntesTaxas / (1 - (impostos% + taxas%) / 100)
</code></pre>
<p>Repare em duas coisas. Primeiro, a <strong>falha</strong> e a <strong>logística</strong> (embalagem e
frete) entram no custo base — você lucra sobre elas também. Segundo, os
impostos e a taxa de marketplace são descontados <strong>do preço de venda</strong>, então
eles aumentam o preço final, não diminuem o seu lucro.</p>
<h2 id="user-content-marcas-importantes-do-resultado">Marcas importantes do resultado</h2>
<ul>
<li><strong>Custo Total</strong> — quanto a peça custou para existir, incluindo falha,
embalagem e frete. É o <strong>ponto de equilíbrio</strong>: vender abaixo é prejuízo, e o
app avisa.</li>
<li><strong>Preço de Venda</strong> — o sugerido pela fórmula. Editável; a margem real é
recalculada na hora.</li>
<li><strong>Margem Real</strong> — o lucro líquido sobre o preço de venda, não sobre o custo. É
sempre menor que a margem digitada — veja o exemplo.</li>
<li><strong>Lucro por Hora</strong> — lucro líquido ÷ horas totais (impressão + pós + setup).
É a melhor métrica para decidir se um trabalho vale a pena.</li>
</ul>
<h2 id="user-content-exemplo-numérico-completo">Exemplo numérico completo</h2>
<p>Vamos consolidar a peça-exemplo usada em todos os artigos: um <strong>suporte de
celular em PLA</strong>, 180 g, 5,5 horas de impressão, 150 W de potência, impressora
de R$ 1.800 depreciada em 36 meses a 100 h/mês, R$ 30/mês de manutenção, R$ 550
de custos fixos a 150 h/mês, 30 minutos de mão de obra a R$ 25/h, slicer de
R$ 30/mês, STL de R$ 5, EPI de R$ 2 por peça, 10% de falha, embalagem R$ 3,
frete R$ 8, margem de 50%, 6% de impostos e 10% de marketplace.</p>
<p>Cada parcela, vinda de sua seção:</p>
<pre><code>material    0,18 kg * R$ 90/kg   =  R$ 16,20
energia     0,825 kWh * R$ 0,75  =  R$  0,62
maquina     R$ 3,80/h * 5,5 h    =  R$ 20,90
hardware    bico + mesa + pintura=  R$  3,82
maoDeObra   0,5 h * R$ 25        =  R$ 12,50
ops         software + EPI       =  R$  8,65
</code></pre>
<p>Agora a consolidação:</p>
<pre><code>custoProducao = 16,20 + 0,62 + 20,90 + 3,82 + 12,50 + 8,65 = R$ 62,69

falha (10%)   = 62,69 * 0,10                              =  R$  6,27
embalagem                                                        R$  3,00
frete                                                            R$  8,00
custoBase     = 62,69 + 6,27 + 3,00 + 8,00                 = R$ 79,96

lucroBruto    = 79,96 * 0,50                              = R$ 39,98
precoAntesTaxas = 79,96 + 39,98                           = R$ 119,94

precoVenda    = 119,94 / (1 - 0,16)                       = R$ 142,79

imposto (6%)  = 142,79 * 0,06                             =  R$  8,57
marketplace   = 142,79 * 0,10                             =  R$ 14,28

lucroLiquido  = 142,79 - 79,96 - 8,57 - 14,28            = R$ 39,98
margemReal    = 39,98 / 142,79                           =   28,0%
</code></pre>
<h2 id="user-content-a-lição-escondida-no-exemplo">A lição escondida no exemplo</h2>
<p>Você pediu <strong>50% de margem</strong> e acabou com <strong>28% de margem real</strong>. Nada foi
calculado errado: os 50% são uma margem <strong>sobre o custo</strong> (markup), enquanto a
margem real é sobre o <strong>preço de venda</strong> — que é maior, porque impostos e taxas
o incharam.</p>
<p>A boa notícia está no lucro: <strong>R$ 39,98</strong>, exatamente os 50% do custo base. Não
é coincidência: a fórmula repassa impostos e taxas para o preço, então o lucro
líquido é preservado. O que muda é a porcentagem, não o dinheiro.</p>
<p>O <strong>lucro por hora</strong> aqui é:</p>
<pre><code>horasTotais = (330 + 18 + 12) / 60 = 6,0 h
lucroPorHora = 39,98 / 6,0 = R$ 6,66/h
</code></pre>
<p>R$ 6,66 por hora é o número que decide se este trabalho vale a pena — muito
mais honesto que "50% de margem".</p>
<h2 id="user-content-modo-margem-alvo-e-preço-personalizado">Modo margem alvo e preço personalizado</h2>
<p>Nem sempre você quer derivar o preço. Às vezes o cliente diz "quero pagar R$
120" e você precisa saber se vale a pena. Para isso serve o <strong>modo margem
alvo</strong>: você digita o preço de venda desejado e a calculadora mostra a margem
real dele, descontando impostos e taxas do valor digitado.</p>
<p>Na nossa peça, um preço de R$ 120 daria:</p>
<pre><code>imposto = 7,20    marketplace = 12,00
lucro = 120 - 79,96 - 7,20 - 12,00 = R$ 20,84
margemReal = 20,84 / 120 = 17,4%
</code></pre>
<p>Se o resultado ficar abaixo do ponto de equilíbrio, a calculadora avisa na tela
— é o sinal de que é melhor recusar o trabalho do que aceitar prejuízo.</p>
<h2 id="user-content-projeção-mensal-e-lotes">Projeção mensal e lotes</h2>
<p>A seção ainda mostra uma <strong>projeção mensal</strong>: quantas peças você vende por mês e
o que isso dá em receita, custo e lucro. Na nossa peça, a 30 vendas por mês:</p>
<pre><code>receita = 142,79 * 30 = R$ 4.283,70
custo   =  79,96 * 30 = R$ 2.398,80
lucro   =  39,98 * 30 = R$ 1.199,40   (anual: R$ 14.392,80)
</code></pre>
<p>Para mais de uma unidade, o <strong>setup</strong> é diluído entre as peças — veja
<a href="#user-content-labor">mão de obra</a>. O preço por unidade cai e a diferença
aparece aqui.</p>
<h2 id="user-content-como-esta-seção-se-relaciona-com-as-demais">Como esta seção se relaciona com as demais</h2>
<p>Cada parcela do resultado vem de um lugar específico:</p>
<ul>
<li><a href="#user-content-material">material</a> — o filamento consumido.</li>
<li><a href="#user-content-print">parâmetros</a> — tempo, energia e a impressora usada.</li>
<li><a href="#user-content-machine">máquina</a> — depreciação, manutenção e rateio de
<a href="#user-content-fixedCost">custos fixos</a>.</li>
<li><a href="#user-content-hardware">hardware</a> — desgaste de bico, mesa, LCD e
acabamento.</li>
<li><a href="#user-content-labor">mão de obra</a> — setup e pós-processamento.</li>
<li><a href="#user-content-ops">ops</a> — software, STL e EPI.</li>
<li><a href="#user-content-sales">falhas e vendas</a> — risco, embalagem, frete, impostos e
margem.</li>
</ul>
<h2 id="user-content-armadilhas-práticas">Armadilhas práticas</h2>
<ol>
<li><strong>Achar que 50% de margem é 50% de lucro no preço.</strong> Como o exemplo mostra,
é 28%. Sempre leia a <strong>margem real</strong>, não a margem que você digitou.</li>
<li><strong>Vender pelo ponto de equilíbrio.</strong> O custo total é o piso de
sobrevivência, não o preço justo. Vender nele significa trabalhar de graça e
ainda pagar imposto.</li>
<li><strong>Esquecer que a falha lucra junto.</strong> A falha entra no custo base e recebe
margem. É correto — uma peça que falhar sai mais cara que uma que não falha,
e as peças que dão certo precisam pagar as que falham.</li>
<li><strong>Desconsiderar o lucro por hora.</strong> Um trabalho de R$ 200 de lucro em 80
horas de máquina rende R$ 2,50/h. O lucro em reais parece bom; o por hora
revela que era melhor ter feito outra coisa.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};