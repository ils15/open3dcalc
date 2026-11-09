var e=`results`,t=`pt-BR`,n={title:`Resultados`,order:19},r=[{depth:1,text:`Resultados`,slug:`user-content-resultados`},{depth:2,text:`Margem real x markup`,slug:`user-content-margem-real-x-markup`},{depth:2,text:`A ordem da soma importa`,slug:`user-content-a-ordem-da-soma-importa`},{depth:2,text:`Marcas importantes do resultado`,slug:`user-content-marcas-importantes-do-resultado`},{depth:2,text:`Exemplo numérico completo`,slug:`user-content-exemplo-numérico-completo`},{depth:2,text:`A lição escondida no exemplo`,slug:`user-content-a-lição-escondida-no-exemplo`},{depth:2,text:`Modo margem alvo e preço personalizado`,slug:`user-content-modo-margem-alvo-e-preço-personalizado`},{depth:2,text:`Projeção mensal e lotes`,slug:`user-content-projeção-mensal-e-lotes`},{depth:2,text:`Como esta seção se relaciona com as demais`,slug:`user-content-como-esta-seção-se-relaciona-com-as-demais`},{depth:2,text:`Quando o resultado não é confiável`,slug:`user-content-quando-o-resultado-não-é-confiável`},{depth:2,text:`Armadilhas práticas`,slug:`user-content-armadilhas-práticas`}],i=`<h1 id="user-content-resultados">Resultados</h1>
<p>A seção <strong>Resultados</strong> é onde tudo se encontra: pega cada custo das outras seções,
soma na ordem certa e responde às três perguntas que importam — <strong>quanto a peça
custou</strong>, <strong>por quanto deve ser vendida</strong> e <strong>quanto sobra de lucro</strong>.</p>
<p>Diferente das outras seções avançadas, os resultados aparecem em <strong>todos os
níveis</strong>. O que muda é o detalhe das parcelas; a consolidação final está sempre
lá.</p>
<h2 id="user-content-margem-real-x-markup">Margem real x markup</h2>
<p>O valor que aparece como <strong>Margem Real</strong> é somente-leitura e calculado sobre o
preço de venda:</p>
<pre><code>margem real = lucro ÷ preço de venda × 100
</code></pre>
<p>O campo <code>profitMarginPercent</code>, por outro lado, é markup sobre o custo. Com
<code>110%</code> de markup, um custo de <code>R$ 100,00</code> produz um preço de <code>R$ 210,00</code>; o
lucro de <code>R$ 110,00</code> corresponde a <code>52,38%</code> de margem real. Essa distinção é
repetida em cinco pontos da interface. O tooltip da UI explica: “Markup: lucro
sobre o custo. Margem: lucro sobre o preço que o cliente paga.”</p>
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
<p>Quatro números resumem o resultado, e cada um conta uma coisa diferente sobre a peça.</p>
<ul>
<li><strong>Custo Total</strong> — quanto a peça custou para existir, incluindo falha,
embalagem e frete. É o <strong>ponto de equilíbrio</strong>: vender abaixo é prejuízo, e o
app avisa.</li>
<li><strong>Preço de Venda</strong> — o sugerido pela fórmula. Editável; a margem real é
recalculada na hora.</li>
<li><strong>Margem Real</strong> — o lucro líquido sobre o preço de venda, não sobre o custo. É
sempre menor que o markup digitado — veja o exemplo.</li>
<li><strong>Lucro por Hora</strong> — lucro líquido ÷ horas totais (impressão + pós + setup).
É a melhor métrica para decidir se um trabalho vale a pena.</li>
</ul>
<h2 id="user-content-exemplo-numérico-completo">Exemplo numérico completo</h2>
<p>Vamos consolidar a peça-exemplo usada em todos os artigos: um <strong>suporte de
celular em PLA</strong>, 180 g, 5,5 horas de impressão, 250 W de potência a R$ 0,80 o
kWh, impressora de R$ 1.800 depreciada em 36 meses a 100 h/mês, R$ 30/mês de
manutenção, R$ 450 de custos fixos a 150 h/mês, 30 minutos de mão de obra a
R$ 25/h, slicer de R$ 30/mês, STL de R$ 5, EPI de R$ 2 por peça, 10% de falha,
embalagem R$ 3, frete R$ 8, markup de 50%, 6% de impostos e 10% de marketplace.</p>
<p>Cada parcela, vinda de sua seção:</p>
<pre><code>material    0,18 kg * R$ 90/kg   =  R$ 16,20
energia     1,375 kWh * R$ 0,80  =  R$  1,10
maquina     R$ 3,80/h * 5,5 h    =  R$ 20,90
hardware    bico + mesa + pintura=  R$  3,82
maoDeObra   0,5 h * R$ 25        =  R$ 12,50
ops         software + EPI       =  R$  8,65
</code></pre>
<p>Agora a consolidação:</p>
<pre><code>custoProducao = 16,20 + 1,10 + 20,90 + 3,82 + 12,50 + 8,65 = R$ 63,17

falha (10%)   = 63,17 * 0,10                              =  R$  6,32
embalagem                                                        R$  3,00
frete                                                            R$  8,00
custoBase     = 63,17 + 6,32 + 3,00 + 8,00                 = R$ 80,49

lucroBruto    = 80,49 * 0,50                              =  R$ 40,24
precoAntesTaxas = 80,49 + 40,24                           = R$ 120,73

precoVenda    = 120,73 / (1 - 0,16)                       = R$ 143,73

imposto (6%)  = 143,73 * 0,06                             =  R$  8,62
marketplace   = 143,73 * 0,10                             =  R$ 14,37

lucroLiquido  = 143,73 - 80,49 - 8,62 - 14,37            =  R$ 40,25
margemReal    = 40,25 / 143,73                           =   28,0%
</code></pre>
<h2 id="user-content-a-lição-escondida-no-exemplo">A lição escondida no exemplo</h2>
<p>Você pediu <strong>50% de margem</strong> e acabou com <strong>28% de margem real</strong>. Nada foi
calculado errado: os 50% são uma margem <strong>sobre o custo</strong> (markup), enquanto a
margem real é sobre o <strong>preço de venda</strong> — que é maior, porque impostos e taxas
o incharam.</p>
<p>A boa notícia está no lucro: <strong>R$ 40,25</strong>, o lucro bruto de 50% do custo base
preservado na prática. Não é coincidência: a fórmula repassa impostos e taxas
para o preço, então o lucro líquido acompanha o bruto — o centavo de diferença é
só arredondamento das taxas, não de cálculo. O que muda é a porcentagem, não o
dinheiro.</p>
<p>O <strong>lucro por hora</strong> aqui é:</p>
<pre><code>horasTotais = (330 + 18 + 12) / 60 = 6,0 h
lucroPorHora = 40,25 / 6,0 = R$ 6,71/h
</code></pre>
<p>R$ 6,71 por hora é o número que decide se este trabalho vale a pena — muito
mais honesto que "50% de margem".</p>
<h2 id="user-content-modo-margem-alvo-e-preço-personalizado">Modo margem alvo e preço personalizado</h2>
<p>Nem sempre você quer derivar o preço. Às vezes o cliente diz "quero pagar R$
120" e você precisa saber se vale a pena. Para isso serve o <strong>modo margem
alvo</strong>: você digita o preço de venda desejado e a calculadora mostra a margem
real dele, descontando impostos e taxas do valor digitado.</p>
<p>Na nossa peça, um preço de R$ 120 daria:</p>
<pre><code>imposto = 7,20    marketplace = 12,00
lucro = 120 - 80,49 - 7,20 - 12,00 = R$ 20,31
margemReal = 20,31 / 120 = 16,9%
</code></pre>
<p>Se o resultado ficar abaixo do ponto de equilíbrio, a calculadora avisa na tela
— é o sinal de que é melhor recusar o trabalho do que aceitar prejuízo.</p>
<h2 id="user-content-projeção-mensal-e-lotes">Projeção mensal e lotes</h2>
<p>A seção ainda mostra uma <strong>projeção mensal</strong>: quantas peças você vende por mês e
o que isso dá em receita, custo e lucro. Na nossa peça, a 30 vendas por mês:</p>
<pre><code>receita = 143,73 * 30 = R$ 4.311,90
custo   =  80,49 * 30 = R$ 2.414,70
lucro   =  40,25 * 30 = R$ 1.207,50   (anual: R$ 14.490,00)
</code></pre>
<p>Para mais de uma unidade, o <strong>setup</strong> é diluído entre as peças — veja
<a href="#user-content-m%C3%A3o-de-obra">mão de obra</a>. O preço por unidade cai e a diferença
aparece aqui.</p>
<h2 id="user-content-como-esta-seção-se-relaciona-com-as-demais">Como esta seção se relaciona com as demais</h2>
<p>Cada parcela do resultado vem de um lugar específico:</p>
<ul>
<li><a href="#user-content-material">material</a> — o filamento consumido.</li>
<li><a href="#user-content-par%C3%A2metros-de-impress%C3%A3o">parâmetros</a> — tempo, energia e a impressora usada.</li>
<li><a href="#user-content-custos-da-m%C3%A1quina">máquina</a> — depreciação, manutenção e rateio de
<a href="#user-content-custos-fixos">custos fixos</a>.</li>
<li><a href="#user-content-desgaste-de-hardware">hardware</a> — desgaste de bico, mesa, LCD e
acabamento.</li>
<li><a href="#user-content-m%C3%A3o-de-obra">mão de obra</a> — setup e pós-processamento.</li>
<li><a href="#user-content-operacional--software">ops</a> — software, STL e EPI.</li>
<li><a href="#user-content-custos-adicionais-e-vendas">falhas e vendas</a> — risco, embalagem, frete, impostos e
margem.</li>
</ul>
<h2 id="user-content-quando-o-resultado-não-é-confiável">Quando o resultado não é confiável</h2>
<p><code>R$ 0,00</code> deixou de ser um fallback para valores desconhecidos. Quando um
número não-finito chega à interface, ela mostra <code>—</code> e sinaliza o cálculo como
inválido. Isso evita que uma falha pareça um custo real.</p>
<p>A diferença entre <strong>ausência</strong> e <strong>corrupção</strong> é importante:</p>
<ul>
<li>um snapshot legado que não tem <code>energyCostPerKwh</code> usa o default do app;</li>
<li><code>NaN</code>, valor negativo, tipo inválido ou divisão por zero gera um erro explícito
com o nome exato do campo.</li>
</ul>
<p>Essa regra é aplicada antes do cálculo em sete caminhos: carga inicial,
<code>loadHistoryItem</code>, <code>undo</code>, <code>restoreAutoSnapshot</code>, <code>loadSharedCalculation</code>,
setters e <code>setWithCompute</code>. Assim, abrir histórico, desfazer, restaurar,
compartilhar ou editar um valor não pode transformar uma falha em zero.</p>
<p>Se você vir <code>—</code>, abra o aviso de cálculo, localize o campo indicado e corrija-o.
Se o problema veio de um histórico ou de um cálculo compartilhado, carregue uma
configuração válida ou complete o campo ausente. Não substitua um valor
desconhecido por <code>0</code>: enquanto o alerta existir, o preço não deve ser usado para
fechar um orçamento.</p>
<h2 id="user-content-armadilhas-práticas">Armadilhas práticas</h2>
<p>Quatro erros de leitura do resultado, todos capazes de fazer um prejuízo parecer um bom negócio.</p>
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