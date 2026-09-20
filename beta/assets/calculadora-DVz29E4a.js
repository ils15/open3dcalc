var e=`calculadora`,t=`pt-BR`,n={title:`Calculadora`,order:1,tourId:`calc-basico`},r=[{depth:1,text:`Calculadora`,slug:`user-content-calculadora`},{depth:2,text:`O que ela calcula`,slug:`user-content-o-que-ela-calcula`},{depth:2,text:`Três níveis de detalhe`,slug:`user-content-três-níveis-de-detalhe`},{depth:2,text:`O mapa das dez seções`,slug:`user-content-o-mapa-das-dez-seções`},{depth:2,text:`A fórmula-mestre`,slug:`user-content-a-fórmula-mestre`},{depth:2,text:`Um exemplo completo`,slug:`user-content-um-exemplo-completo`},{depth:2,text:`Fluxo de uso`,slug:`user-content-fluxo-de-uso`},{depth:2,text:`Por onde começar`,slug:`user-content-por-onde-começar`}],i=`<h1 id="user-content-calculadora">Calculadora</h1>
<p>A <strong>Calculadora</strong> é o núcleo do Open3DCalc. Ela estima o custo de uma impressão 3D
a partir de poucos dados de entrada e divide o resultado em <strong>seções auditáveis</strong>:
você vê exatamente quanto cada parte contribui no total, sem caixas-pretas.</p>
<p>A filosofia é simples: <strong>custo é uma soma, não um palpite</strong>. Cada número que
aparece na tela tem uma origem rastreável — um campo que você preencheu e uma
fórmula conhecida. Se o preço final parece alto, a calculadora te mostra qual
seção está pesando, em vez de esconder o problema dentro de um "valor total".</p>
<h2 id="user-content-o-que-ela-calcula">O que ela calcula</h2>
<p>A calculadora responde a duas perguntas separadas, sempre na ordem:</p>
<ol>
<li><strong>Quanto esta peça custa para existir?</strong> É a soma de tudo que você consome
para produzi-la: material, energia, desgaste da máquina, mão de obra,
falhas e os custos fixos da oficina.</li>
<li><strong>Por quanto ela deve ser vendida?</strong> Sobre o custo de produção você aplica a
margem, os impostos e as taxas de marketplace — e o preço de venda aparece
ao lado do custo, nunca sozinho.</li>
</ol>
<p>Manter essas duas contas separadas é o que transforma a margem em uma <strong>escolha
consciente</strong>. Quando custo e preço de venda são apresentados lado a lado, você
decide se quer ganhar mais ajustando a margem ou reduzindo um custo real.</p>
<h2 id="user-content-três-níveis-de-detalhe">Três níveis de detalhe</h2>
<p>Nem todo orçamento precisa de todas as seções. Por isso a calculadora tem três
níveis, e cada um revela mais seções:</p>
<ul>
<li><strong>Rápido</strong> — quatro seções: <code>material</code>, <code>print</code>, <code>sales</code> e <code>results</code>. É o
suficiente para uma estimativa em 30 segundos.</li>
<li><strong>Detalhado</strong> — adiciona a seção <code>failure</code>, para quem já tem um histórico de
perdas e quer precificá-lo.</li>
<li><strong>Completo</strong> — revela todas as dez seções, incluindo <code>hardware</code>, <code>machine</code>,
<code>fixedCost</code>, <code>labor</code> e <code>ops</code>. Controle total sobre cada parâmetro.</li>
</ul>
<p>A lógica é gradual: o nível <strong>Rápido</strong> cobre o caminho do filamento ao preço de
venda; o <strong>Detalhado</strong> acende a contabilidade de falhas; o <strong>Completo</strong> abre a
planilha inteira.</p>
<p><strong>Mudar de nível não apaga nada.</strong> Os campos que você já preencheu continuam
lá, guardados no estado da calculadora — você só deixa de ver as seções que o
nível atual esconde. Pode começar no Rápido para fechar um preço rápido e subir
de nível depois, quando precisar de precisão.</p>
<h2 id="user-content-o-mapa-das-dez-seções">O mapa das dez seções</h2>
<p>Cada seção é um bloco independente que calcula uma parte do total. Esta é a
função de cada uma:</p>
<ul>
<li><a href="#user-content-material"><strong>material</strong></a> — quanto de filamento ou resina a peça
consome, e quanto isso custa.</li>
<li><a href="#user-content-print"><strong>print</strong></a> — o tempo de impressão e a energia gasta na
máquina.</li>
<li><a href="#user-content-failure"><strong>failure</strong></a> — falhas e retrabalho transformados em
custo, por percentual ou valor fixo.</li>
<li><a href="#user-content-hardware"><strong>hardware</strong></a> — desgaste do bico, da mesa de
impressão e do LCD (em resina).</li>
<li><a href="#user-content-machine"><strong>machine</strong></a> — depreciação da impressora e manutenção,
rateadas por hora de uso.</li>
<li><a href="#user-content-fixedcost"><strong>fixedCost</strong></a> — aluguel, internet e energia base da
oficina, distribuídos por hora produtiva.</li>
<li><a href="#user-content-labor"><strong>labor</strong></a> — tempo de setup e pós-processamento
multiplicado pela sua taxa horária.</li>
<li><a href="#user-content-ops"><strong>ops</strong></a> — EPI, licença do slicer, arquivo de modelo e
outros insumos operacionais.</li>
<li><a href="#user-content-sales"><strong>sales</strong></a> — embalagem, frete, impostos, marketplace e a
sua margem: é a seção que monta o preço de venda.</li>
<li><a href="#user-content-results"><strong>results</strong></a> — consolida tudo e mostra custo, lucro e
preço final lado a lado.</li>
</ul>
<p>As quatro primeiras deste mapa têm artigos próprios na Wiki, com a fórmula
completa e exemplos numéricos. As demais chegam nas próximas ondas — por
enquanto, a seção <code>results</code> já mostra a soma de todas elas.</p>
<h2 id="user-content-a-fórmula-mestre">A fórmula-mestre</h2>
<p>Tudo o que a calculadora faz cabe em três linhas. O custo de produção soma as
seções de consumo; o custo total acrescenta falhas e logística; e o preço de
venda aplica a margem e os impostos sobre essa base:</p>
<pre><code>custo de produção = material + print + hardware + machine
                  + fixedCost + labor + ops

custo total       = produção + failure + embalagem + frete

preço de venda    = custo total + margem
                  + impostos e taxas de marketplace
</code></pre>
<p>Note que <code>sales</code> é a única seção que <strong>não é custo</strong>: embalagem e frete somam
ao total, mas margem, impostos e taxas são aplicados <strong>por cima</strong> dele. Por
isso o preço de venda cresce de forma diferente do custo — e por isso a seção
<code>results</code> existe, para mostrar essa diferença com clareza.</p>
<h2 id="user-content-um-exemplo-completo">Um exemplo completo</h2>
<p>Uma peça decorativa em PLA, 50 g, 5 horas de impressão, margem de 100%:</p>
<pre><code>material    50 g a R$ 125/kg (eficiência 98%)  = R$  6,38
print       5 h a 250 W, R$ 0,80/kWh           = R$  1,00
machine + hardware + labor + ops (exemplo)    = R$  3,00
                              custo de produção = R$ 10,38
failure     10% de retrabalho                  = R$  1,04
embalagem + frete                             = R$  3,00
                                    custo total = R$ 14,42
margem      100% sobre o custo total          = R$ 14,42
impostos + marketplace (25%)                  = R$  9,61
                              preço de venda  = R$ 38,45
</code></pre>
<p>A matemática dos impostos é explicada no artigo <a href="#user-content-sales">sales</a>; o
importante aqui é ver que cada linha tem origem em uma seção. Se o cliente
acha caro, você sabe exatamente onde está o R$ 14,42 de custo e pode agir sobre
ele — e não sobre o preço às cegas.</p>
<h2 id="user-content-fluxo-de-uso">Fluxo de uso</h2>
<p>O caminho recomendado, do primeiro número ao preço final:</p>
<ol>
<li><strong>Escolha o nível</strong> e a aba (FDM ou resina). Comece no Rápido se estiver com
pressa; o nível não trava nada para depois.</li>
<li><strong>Preencha a seção <code>material</code></strong> com tipo, custo por kg e peso da peça. Se
o filamento está catalogado no inventário, selecionar o carretel preenche os
valores automaticamente.</li>
<li><strong>Preencha a seção <code>print</code></strong> com o tempo do fatiador, a potência da
impressora e o custo do kWh.</li>
<li><strong>Olhe a seção <code>results</code></strong> — ela já mostra um custo e um preço de venda
com a margem padrão.</li>
<li><strong>Ajuste a seção <code>sales</code></strong> — a margem é o seu lucro declarado. Suba ou
desça conforme o mercado; o preço de venda se atualiza na hora.</li>
<li><strong>Suba de nível</strong> se precisar: ative <code>failure</code> para incluir perdas, ou vá ao
Completo para ratear máquina, mão de obra e custos fixos.</li>
<li><strong>Salve ou exporte</strong> — a estimativa vira produto no inventário ou item de
orçamento, e o histórico guarda os números para a próxima peça.</li>
</ol>
<h2 id="user-content-por-onde-começar">Por onde começar</h2>
<p>Se você nunca usou a calculadora, faça assim: abra no nível <strong>Rápido</strong>, preencha
só <code>material</code> e <code>print</code>, e olhe o <code>results</code>. Esse já é um orçamento honesto. A
maior parte dos erros de precificação não acontece por falta de seções —
acontece por margem aplicada sem saber o custo. Comece pelo custo, deixe as
seções avançadas para quando elas passarem a fazer diferença no seu bolso.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};