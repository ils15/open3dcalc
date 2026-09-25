var e=`calculadora`,t=`pt-BR`,n={title:`Calculadora`,order:1,tourId:`calc-basico`},r=[{depth:1,text:`Calculadora`,slug:`user-content-calculadora`},{depth:2,text:`O que ela calcula`,slug:`user-content-o-que-ela-calcula`},{depth:2,text:`Layouts disponíveis`,slug:`user-content-layouts-disponíveis`},{depth:2,text:`Nível de detalhe: Rápido, Detalhado e Completo`,slug:`user-content-nível-de-detalhe-rápido-detalhado-e-completo`},{depth:2,text:`O mapa das dez seções`,slug:`user-content-o-mapa-das-dez-seções`},{depth:2,text:`A fórmula-mestre`,slug:`user-content-a-fórmula-mestre`},{depth:2,text:`Regras que evitam números enganosos`,slug:`user-content-regras-que-evitam-números-enganosos`},{depth:3,text:`Margem real x markup`,slug:`user-content-margem-real-x-markup`},{depth:3,text:`Ausência não é zero`,slug:`user-content-ausência-não-é-zero`},{depth:3,text:`Presets de demonstração removidos`,slug:`user-content-presets-de-demonstração-removidos`},{depth:3,text:`Multi-material temporariamente desativado`,slug:`user-content-multi-material-temporariamente-desativado`},{depth:2,text:`Controles e apresentação`,slug:`user-content-controles-e-apresentação`},{depth:2,text:`Um exemplo completo`,slug:`user-content-um-exemplo-completo`},{depth:2,text:`Fluxo de uso`,slug:`user-content-fluxo-de-uso`},{depth:2,text:`Armadilhas comuns`,slug:`user-content-armadilhas-comuns`},{depth:2,text:`Por onde começar`,slug:`user-content-por-onde-começar`}],i=`<h1 id="user-content-calculadora">Calculadora</h1>
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
<li><strong>Por quanto ela deve ser vendida?</strong> Sobre o custo de produção você aplica o
markup, os impostos e as taxas de marketplace — e o preço de venda aparece
ao lado do custo, nunca sozinho.</li>
</ol>
<p>Manter essas duas contas separadas é o que transforma a margem em uma <strong>escolha
consciente</strong>. Quando custo e preço de venda são apresentados lado a lado, você
decide se quer ganhar mais ajustando a margem ou reduzindo um custo real.</p>
<h2 id="user-content-layouts-disponíveis">Layouts disponíveis</h2>
<p>A beta 3 oferece três layouts implementados para a mesma calculadora:</p>
<ul>
<li><strong>Clássico</strong> — a calculadora organizada em seções, com navegação e controle de
nível no topo. Escolha este layout para acessar as seções diretamente e seguir
um fluxo de trabalho familiar.</li>
<li><strong>Guided (Fluxo Guiado)</strong> — um layout passo a passo para quem está começando e
para uso no celular. Ele apresenta a estimativa como uma sequência de perguntas,
em vez de exibir todas as seções de uma vez.</li>
<li><strong>Bento Grid</strong> — cinco cards organizados em uma grade responsiva. Ele não é mais
um painel somente informativo: agora é uma calculadora editável, com os mesmos
campos do Classic, e os cards alimentam o cálculo real.</li>
</ul>
<p>O seletor de layout fica no cabeçalho e a preferência é lembrada pelo aplicativo.
O modo Farm está no roadmap e não está disponível nesta beta; não há um quarto
layout para usar.</p>
<h2 id="user-content-nível-de-detalhe-rápido-detalhado-e-completo">Nível de detalhe: Rápido, Detalhado e Completo</h2>
<p>O seletor <strong>Rápido / Detalhado / Completo</strong> aparece no topo do Classic e do
Bento. É o mesmo componente e o mesmo estado nos dois layouts: mudar o nível em
um deles reflete imediatamente no outro.</p>
<ul>
<li><strong>Rápido</strong> — mostra <code>material</code>, <code>print</code>, <code>sales</code> e <code>results</code>, o caminho mínimo
para uma estimativa rápida.</li>
<li><strong>Detalhado</strong> — acrescenta a seção <code>failure</code>, para quem quer incluir perdas e
retrabalho.</li>
<li><strong>Completo</strong> — libera todas as dez seções, incluindo <code>hardware</code>, <code>machine</code>,
<code>fixedCost</code>, <code>labor</code> e <code>ops</code>.</li>
</ul>
<p>A visibilidade é regida pelo contrato
<code>isFieldVisibleForLevel(calcLevel, hiddenFields, sectionId, fieldId)</code>. Ele é
compartilhado pelo Classic e pelo Bento e também respeita <code>hiddenFields</code>, ou
seja, as escolhas de campos ocultos não são descartadas ao trocar de layout.</p>
<p><strong>Mudar de nível não apaga valores.</strong> Os campos preenchidos continuam guardados;
apenas as seções ou os campos que o nível atual oculta deixam de aparecer. Você
pode começar no Rápido e aumentar o detalhe quando precisar.</p>
<h2 id="user-content-o-mapa-das-dez-seções">O mapa das dez seções</h2>
<p>Cada seção é um bloco independente que calcula uma parte do total. Esta é a
função de cada uma:</p>
<ul>
<li><a href="#user-content-material"><strong>material</strong></a> — quanto de filamento ou resina a peça
consome, e quanto isso custa.</li>
<li><a href="#user-content-par%C3%A2metros-de-impress%C3%A3o"><strong>print</strong></a> — o tempo de impressão e a energia gasta na
máquina.</li>
<li><a href="#user-content-risco-e-falhas"><strong>failure</strong></a> — falhas e retrabalho transformados em
custo, por percentual ou valor fixo.</li>
<li><a href="#user-content-desgaste-de-hardware"><strong>hardware</strong></a> — desgaste do bico, da mesa de
impressão e do LCD (em resina).</li>
<li><a href="#user-content-custos-da-m%C3%A1quina"><strong>machine</strong></a> — depreciação da impressora e manutenção,
rateadas por hora de uso.</li>
<li><a href="#user-content-custos-fixos"><strong>fixedCost</strong></a> — aluguel, internet e energia base da
oficina, distribuídos por hora produtiva.</li>
<li><a href="#user-content-m%C3%A3o-de-obra"><strong>labor</strong></a> — tempo de setup e pós-processamento
multiplicado pela sua taxa horária.</li>
<li><a href="#user-content-operacional--software"><strong>ops</strong></a> — EPI, licença do slicer, arquivo de modelo e
outros insumos operacionais.</li>
<li><a href="#user-content-custos-adicionais-e-vendas"><strong>sales</strong></a> — embalagem, frete, impostos, marketplace e a
sua margem: é a seção que monta o preço de venda.</li>
<li><a href="#user-content-resultados"><strong>results</strong></a> — consolida tudo e mostra custo, lucro e
preço final lado a lado.</li>
</ul>
<p>Todas as dez seções deste mapa têm artigo próprio na Wiki, com a fórmula
completa e exemplos numéricos — é só seguir os links acima. E a seção
<a href="#user-content-resultados">results</a> mostra a soma de todas elas lado a lado.</p>
<h2 id="user-content-a-fórmula-mestre">A fórmula-mestre</h2>
<p>Tudo o que a calculadora faz cabe em três linhas. O custo de produção soma as
seções de consumo; o custo total acrescenta falhas e logística; e o preço de
venda aplica a margem e os impostos sobre essa base:</p>
<pre><code>custo de produção = material + print + hardware + machine
                  + fixedCost + labor + ops

custo total       = produção + failure + embalagem + frete

preço de venda    = custo total + markup
                  + impostos e taxas de marketplace
</code></pre>
<p>Note que <code>sales</code> é a única seção que <strong>não é custo</strong>: embalagem e frete somam
ao total, mas margem, impostos e taxas são aplicados <strong>por cima</strong> dele. Por
isso o preço de venda cresce de forma diferente do custo — e por isso a seção
<code>results</code> existe, para mostrar essa diferença com clareza.</p>
<h2 id="user-content-regras-que-evitam-números-enganosos">Regras que evitam números enganosos</h2>
<h3 id="user-content-margem-real-x-markup">Margem real x markup</h3>
<p>O campo <code>profitMarginPercent</code> representa <strong>markup sobre o custo</strong>, não a
percentagem final do lucro sobre o preço. Por exemplo, <code>110%</code> de markup significa
que o preço deve ser <code>2,10 ×</code> o custo: um custo de <code>R$ 100,00</code> vira
<code>R$ 210,00</code>, com <code>R$ 110,00</code> de lucro.</p>
<p>A <strong>margem real</strong> é derivada e somente-leitura:</p>
<pre><code>margem real = lucro ÷ preço de venda × 100
</code></pre>
<p>Nesse exemplo, <code>R$ 110,00 ÷ R$ 210,00 = 52,38%</code>. O valor aparece em cinco pontos
da interface para ficar visível perto do preço. O tooltip da interface resume a
diferença: “Markup: lucro sobre o custo. Margem: lucro sobre o preço que o
cliente paga.” Consulte também <a href="#user-content-custos-adicionais-e-vendas">Vendas</a>
e <a href="#user-content-resultados">Resultados</a>.</p>
<h3 id="user-content-ausência-não-é-zero">Ausência não é zero</h3>
<p>Na beta 3, <code>R$ 0,00</code> nunca mais significa que o cálculo terminou em zero. Um
valor não-finito é mostrado como <code>—</code>, e não como uma quantia inventada.</p>
<p>Isso corrige um caso real: ao restaurar um cálculo antigo, o campo
<code>energyCostPerKwh</code> podia estar ausente. O <code>NaN</code> percorria a cadeia de
cálculo e a tela acabava mostrando <code>R$ 0,00</code>, parecendo um custo válido. Agora a
regra é:</p>
<ul>
<li><strong>Ausência em um snapshot legado:</strong> o app usa o default da aplicação para o
campo que falta e tenta concluir o cálculo.</li>
<li><strong>Corrupção ou valor inválido:</strong> <code>NaN</code>, negativo, tipo errado ou divisão por
zero geram um erro explícito, com o caminho do campo exato.</li>
<li><strong>Resultado não-finito:</strong> a interface exibe <code>—</code> e o aviso de cálculo
inválido; não transforma o problema em zero.</li>
</ul>
<p>A validação acontece antes do cálculo em sete caminhos: carga inicial,
<code>loadHistoryItem</code>, <code>undo</code>, <code>restoreAutoSnapshot</code>, <code>loadSharedCalculation</code>,
setters e <code>setWithCompute</code>. Isso mantém a regra para abrir, desfazer, restaurar,
compartilhar e editar valores.</p>
<p>Quando aparecer <code>—</code>, leia o nome do campo indicado no alerta e corrija esse
campo. Se o erro veio de um histórico ou de um cálculo compartilhado, restaure
uma configuração válida ou preencha o valor ausente antes de usar o resultado.
Não compense um valor desconhecido com <code>0</code>: nesse caso o app ainda não tem um número
confiável para a peça.</p>
<h3 id="user-content-presets-de-demonstração-removidos">Presets de demonstração removidos</h3>
<p>Os três presets de demonstração — <strong>Vaso</strong>, <strong>Suporte GoPro</strong> e <strong>Estatueta</strong> —
foram removidos. Eles preenchiam peso e tempo inventados; esses dados são
propriedade do modelo e não do fluxo de cálculo, portanto um preset não deve
fingir que conhece a peça.</p>
<p>Para ver o funcionamento, use o <strong>Modo Demo</strong>, que é explicitamente uma
demonstração. Para trabalhar com uma configuração real, calcule a peça e
carregue-a do <strong>Histórico</strong>.</p>
<h3 id="user-content-multi-material-temporariamente-desativado">Multi-material temporariamente desativado</h3>
<p>O suporte a múltiplos materiais está desativado nesta beta. O toggle continua
visível, mas fica indisponível e explica que o modelo completo virá em uma fase
própria. O motivo é objetivo: o custo dos slots substituía apenas
<code>materialCost</code>; <code>subtotal</code>, <code>totalCost</code>, <code>sellPrice</code> e <code>profit</code> não recebiam
essa parcela, deixando o preço subestimado em silêncio.</p>
<p>Não use um valor parcial de multi-material para fechar um orçamento. O campo
<code>fdmAmsSlots</code> é preservado para essa fase futura, mas não representa hoje um
modelo de custo completo.</p>
<h2 id="user-content-controles-e-apresentação">Controles e apresentação</h2>
<p>O controle de personalização de campos agora aparece uma única vez, no
componente <code>FieldCustomizer</code>. Antes o mesmo ajuste era repetido de duas a
quatro vezes em seções diferentes. <code>SectionHeader</code> é apenas apresentacional;
ele não mantém uma segunda cópia do estado. O nível de detalhe e
<code>hiddenFields</code> continuam sendo a fonte única de verdade para o Classic e o
Bento.</p>
<p>A interface usa <strong>Plus Jakarta Sans auto-hospedada</strong> em WOFF2, sob a licença
OFL 1.1. A fonte anterior do Google era bloqueada pela CSP, então o app não
depende dela para exibir a Wiki. O arquivo <code>tokens.css</code> é a fonte única dos
tokens visuais, com os mesmos valores semânticos para os temas claro e escuro.</p>
<p>A Wiki também preserva a acessibilidade ao navegar entre artigos: o destino é
rolado e recebe foco antes da interação seguinte. A correção usa
<code>useLayoutEffect</code> no lugar de <code>useEffect</code>, evitando que o foco seja aplicado
antes da montagem do título.</p>
<h2 id="user-content-um-exemplo-completo">Um exemplo completo</h2>
<p>Uma peça decorativa em PLA, 50 g, 5 horas de impressão, markup de 100%:</p>
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
<p>A matemática dos impostos é explicada no artigo <a href="#user-content-custos-adicionais-e-vendas">sales</a>; o
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
<li><strong>Ajuste a seção <code>sales</code></strong> — o markup é o lucro declarado sobre o custo. Suba ou
desça conforme o mercado; o preço de venda se atualiza na hora.</li>
<li><strong>Suba de nível</strong> se precisar: ative <code>failure</code> para incluir perdas, ou vá ao
Completo para ratear máquina, mão de obra e custos fixos.</li>
<li><strong>Salve ou exporte</strong> — a estimativa vira produto no inventário ou item de
orçamento, e o histórico guarda os números para a próxima peça.</li>
</ol>
<h2 id="user-content-armadilhas-comuns">Armadilhas comuns</h2>
<p>Quatro erros cercam quem está começando com a calculadora, e todos eles se disfarçam de pressa.</p>
<ul>
<li><strong>Aplicar markup sem saber o custo.</strong> O preço de venda se atualiza na hora quando você
mexe na porcentagem, o que convida ao ajuste às cegas. Sem olhar o <code>results</code> lado a lado,
100% de markup parece 100% de lucro — e não é.</li>
<li><strong>Somar a margem e esquecer o que vem por cima.</strong> Custo total mais margem dá R$ 28,84 no
exemplo; o preço de venda é R$ 38,45. Os R$ 9,61 de diferença são impostos e marketplace,
aplicados por cima do total, e não são lucro.</li>
<li><strong>Começar no nível Completo.</strong> O Rápido cobre o caminho do filamento ao preço de venda com
quatro seções, e mudar de nível depois não apaga nada. Quem abre as dez seções de uma vez se
afoga em campos antes de fechar o primeiro preço.</li>
<li><strong>Tratar <code>sales</code> como mais um custo.</strong> Embalagem e frete somam ao total; margem, impostos e
taxas são aplicados por cima dele. Confundir soma com aplicação faz o preço crescer na
proporção errada.</li>
</ul>
<h2 id="user-content-por-onde-começar">Por onde começar</h2>
<p>Se você nunca usou a calculadora, faça assim: abra no nível <strong>Rápido</strong>, preencha
só <code>material</code> e <code>print</code>, e olhe o <code>results</code>. Esse já é um orçamento honesto. A
maior parte dos erros de precificação não acontece por falta de seções —
acontece por margem aplicada sem saber o custo. Comece pelo custo, deixe as
seções avançadas para quando elas passarem a fazer diferença no seu bolso.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};