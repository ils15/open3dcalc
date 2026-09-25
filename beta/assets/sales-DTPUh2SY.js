var e=`sales`,t=`pt-BR`,n={title:`Custos Adicionais e Vendas`,order:18},r=[{depth:1,text:`Custos Adicionais e Vendas`,slug:`user-content-custos-adicionais-e-vendas`},{depth:2,text:`Os campos`,slug:`user-content-os-campos`},{depth:2,text:`Markup x margem real`,slug:`user-content-markup-x-margem-real`},{depth:2,text:`A fórmula do preço de venda`,slug:`user-content-a-fórmula-do-preço-de-venda`},{depth:2,text:`Exemplo numérico completo`,slug:`user-content-exemplo-numérico-completo`},{depth:2,text:`Os presets de markup`,slug:`user-content-os-presets-de-markup`},{depth:2,text:`Markup consciente vs. arredondamento oculto`,slug:`user-content-markup-consciente-vs-arredondamento-oculto`},{depth:2,text:`Armadilhas comuns`,slug:`user-content-armadilhas-comuns`}],i=`<h1 id="user-content-custos-adicionais-e-vendas">Custos Adicionais e Vendas</h1>
<p>A seção <strong>sales</strong> é a única da calculadora que <strong>não é um custo</strong>. Todas as
outras somam valores que você já gastou; a <code>sales</code> responde a outra pergunta:
dado o custo, <strong>por quanto esta peça deve ser vendida</strong>? É nela que a margem, os
impostos e as taxas de marketplace se encontram — e é por isso que o resultado
delas aparece no preço final, não no custo.</p>
<p>A separação é o ponto central da filosofia da calculadora: <strong>custo é fato, preço
é decisão</strong>. O custo existe independente de você vender; o preço é construído.
Quando a seção <code>results</code> coloca os dois lado a lado, a margem deixa de ser um
arredondamento oculto e vira uma alavanca visível.</p>
<h2 id="user-content-os-campos">Os campos</h2>
<p>A seção mistura logística, taxas e lucro:</p>
<ul>
<li><strong>Quantidade</strong> — quantas unidades iguais serão produzidas. O custo de setup é
diluído entre as unidades e o valor aparece na exportação do orçamento.</li>
<li><strong>Preenchimento (infill)</strong> — quanto do interior é preenchido. Auxilia a
estimar consumo de material: 15% para peças decorativas, 50% ou mais para
peças funcionais.</li>
<li><strong>Peças e extras</strong> — parafusos, colas, verniz, tintas: tudo que entra na peça
além do plástico.</li>
<li><strong>Embalagem</strong> — caixa, plástico bolha, fita.</li>
<li><strong>Frete</strong> — o custo da entrega ao cliente.</li>
<li><strong>Marketplace</strong> — a plataforma de venda, selecionada do catálogo. Cada uma tem
a sua taxa percentual, preenchida automaticamente.</li>
<li><strong>Taxas e impostos</strong> — impostos sobre o valor da venda (ICMS, ISS, Simples
Nacional).</li>
<li><strong>Markup sobre o custo</strong> — a porcentagem de lucro desejada sobre o custo total.</li>
</ul>
<h2 id="user-content-markup-x-margem-real">Markup x margem real</h2>
<p>O campo <code>profitMarginPercent</code> é o <strong>markup sobre o custo</strong>. Ele não é a mesma
coisa que a margem real:</p>
<ul>
<li><code>110%</code> de markup significa <code>custo + 110% do custo</code> = <strong>2,10× o custo</strong>;</li>
<li>com custo de <code>R$ 100,00</code>, o preço antes de impostos e taxas é <code>R$ 210,00</code>;</li>
<li>o lucro bruto é <code>R$ 110,00</code>;</li>
<li>a margem real é <code>lucro ÷ preço de venda × 100</code>.</li>
</ul>
<p>Nesse exemplo, <code>110 ÷ 210 × 100 = 52,38%</code> de margem real. Impostos e taxas
podem alterar o preço final e, portanto, o lucro líquido; por isso a margem real
deve ser lida junto com o resultado.</p>
<p>A margem real é derivada e somente-leitura. Para mudá-la, ajuste o markup ou o
preço de venda, em vez de tentar editar o valor derivado. A interface mostra a
margem real em cinco pontos para manter a comparação visível. O tooltip diz:
<strong>“Markup: lucro sobre o custo. Margem: lucro sobre o preço que o cliente
paga.”</strong></p>
<h2 id="user-content-a-fórmula-do-preço-de-venda">A fórmula do preço de venda</h2>
<p>A mecânica é menos óbvia do que parece, e vale a pena entender. Primeiro se
fecha a base: custo de produção mais falhas mais embalagem mais frete. Sobre
essa base aplica-se o markup. E só então entram impostos e taxas — mas de um
jeito especial, <strong>por divisão</strong>, para que eles não comam o seu lucro:</p>
<pre><code>custo base       = produção + falhas + embalagem + frete
lucro            = custo base * (markup / 100)
preço s/ taxas   = custo base + lucro
preço de venda   = preço s/ taxas / (1 - (impostos + taxa marketplace) / 100)
</code></pre>
<p>A divisão não é um detalhe técnico: ela é o que faz a margem ser <strong>honrada</strong>.
Como os impostos são calculados por dentro do preço final, o lucro que sobra no
fim é exatamente a porcentagem que você declarou — nem um centavo a menos.</p>
<h2 id="user-content-exemplo-numérico-completo">Exemplo numérico completo</h2>
<p>Uma peça com R$ 20,00 de custo de produção, R$ 2,00 de falha, R$ 2,00 de
embalagem e R$ 1,00 de frete, vendida numa plataforma com 10% de taxa, com 15%
de impostos e markup de 100%:</p>
<pre><code>custo base       = 20 + 2 + 2 + 1        = R$ 25,00
lucro (100%)     = 25 * 1,00             = R$ 25,00
preço s/ taxas   = 25 + 25               = R$ 50,00
taxa total       = 15 + 10               = 25%
preço de venda   = 50 / (1 - 0,25)       = R$ 66,67
</code></pre>
<p>Conferindo o que sobrou:</p>
<pre><code>impostos (15%)   = 66,67 * 0,15          = R$ 10,00
marketplace (10%)= 66,67 * 0,10          = R$  6,67
lucro líquido    = 66,67 - 25 - 10 - 6,67 = R$ 25,00
</code></pre>
<p>O lucro líquido é exatamente os R$ 25,00 da margem. Se os impostos fossem
somados de forma ingênua (R$ 50 + 25% = R$ 62,50), as taxas reais sobre essa
venda seriam de R$ 15,63 — e o lucro cairia para menos de R$ 22,00, abaixo dos
R$ 25,00 declarados. A fórmula divisiva existe para que a margem seja uma
promessa que se cumpre.</p>
<h2 id="user-content-os-presets-de-markup">Os presets de markup</h2>
<p>Ao lado do campo de margem há botões com porcentagens prontas: 100%, 150%, 200%,
250%, 300% e 500%. São os <strong>presets de markup</strong> — atalhos que preenchem a margem
com um toque, para os casos em que você quer aplicar uma marcação conhecida e
não ficar digitando valores.</p>
<p>Eles são só preenchimento: clicar em 200% é o mesmo que digitar 200 no campo de
margem, e mudar o valor depois cancela o destaque do botão. O que eles
realmente economizam é o raciocínio — em quem vende no atacado, por exemplo,
100% sobre o custo é uma marcação padrão que se repete em todo orçamento.</p>
<h2 id="user-content-markup-consciente-vs-arredondamento-oculto">Markup consciente vs. arredondamento oculto</h2>
<p>A diferença entre precificar bem e precificar mal está na ordem das contas:</p>
<ul>
<li><strong>Markup consciente</strong>: você conhece o custo, decide o markup e o preço é uma
consequência. Se o mercado reclama, você sabe se o problema é o custo ou o
markup — e pode mexer em qualquer um dos dois.</li>
<li><strong>Arredondamento oculto</strong>: você escolhe o preço que "parece certo" e o lucro é
o que sobrar. Funciona até o dia em que nada sobra, e você não sabe por quê.</li>
</ul>
<p>A calculadora foi feita para forçar o primeiro caminho: a seção <code>results</code> sempre
mostra custo, lucro e preço de venda juntos, justamente para que a margem nunca
fique escondida atrás do preço final. Quando esse trio aparece na mesma tela, é
impossível fingir que não se sabe de onde vem o dinheiro.</p>
<h2 id="user-content-armadilhas-comuns">Armadilhas comuns</h2>
<p>Quatro armadilhas moram nesta seção, e cada uma diminui o lucro sem aparecer no preço.</p>
<ul>
<li><strong>Markup baixo demais "para vender mais".</strong> Se o markup não cobre as falhas e
os custos fixos que você não rateou, vender mais só amplia o prejuízo.</li>
<li><strong>Esquecer a taxa de marketplace.</strong> Dez por cento sobre o preço é muito mais
que dez por cento sobre o custo; deixar o campo zerado é presentear a
plataforma.</li>
<li><strong>Embalagem e frete fora da base.</strong> Eles somam no custo antes da margem —
colocar R$ 3,00 de frete e não rateá-lo é lucro que some a cada venda.</li>
<li><strong>Confundir markup com margem real.</strong> O campo <code>profitMarginPercent</code> é markup
sobre o custo. <code>100%</code> significa vender pelo dobro do custo — não "lucro de
100% do preço", que seria outro número. Consulte a margem real derivada.</li>
</ul>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};