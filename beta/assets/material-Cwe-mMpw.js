var e=`material`,t=`pt-BR`,n={title:`Material`,order:10},r=[{depth:1,text:`Material`,slug:`user-content-material`},{depth:2,text:`FDM: peso, preço e eficiência`,slug:`user-content-fdm-peso-preço-e-eficiência`},{depth:2,text:`Os campos que ninguém lembra`,slug:`user-content-os-campos-que-ninguém-lembra`},{depth:2,text:`Exemplo numérico completo`,slug:`user-content-exemplo-numérico-completo`},{depth:2,text:`Resina: volume, não peso`,slug:`user-content-resina-volume-não-peso`},{depth:2,text:`Como o inventário alimenta a seção`,slug:`user-content-como-o-inventário-alimenta-a-seção`},{depth:2,text:`Armadilhas comuns`,slug:`user-content-armadilhas-comuns`}],i=`<h1 id="user-content-material">Material</h1>
<p>A seção <strong>material</strong> calcula quanto de filamento ou resina a peça consome e
converte isso em dinheiro. É a primeira seção da calculadora e, na maioria das
impressões, a que mais pesa no custo final — por isso é também a primeira onde
um erro de contexto vira erro de preço.</p>
<p>A ideia central é separar duas coisas: <strong>o que a peça pesa</strong> e <strong>o que você
realmente pagou pelo material</strong>. Uma peça de 50 g feita com um carretel de
R$ 125/kg não custa R$ 6,25 — porque o rolo nunca é usado inteiro, a purga
desperdiça plástico e a resina fica no tanque. A seção material junta essas
perdas no cálculo, em vez de fingir que não existem.</p>
<h2 id="user-content-fdm-peso-preço-e-eficiência">FDM: peso, preço e eficiência</h2>
<p>Na impressação por filamento, os campos básicos são:</p>
<ul>
<li><strong>Tipo de material</strong> — PLA, PETG, ABS e outros. Define a densidade usada nas
conversões de volume e as sugestões de preço.</li>
<li><strong>Custo por kg</strong> — o preço médio do quilo. Como referência: PLA fica em torno
de R$ 90, PETG R$ 110 e ABS R$ 100.</li>
<li><strong>Peso usado</strong> — quantos gramas a peça consome, segundo o fatiador.</li>
</ul>
<p>A fórmula básica é direta: peso convertido em quilos vezes o preço do quilo.</p>
<pre><code>custo do material = (peso usado / 1000) * custo por kg
</code></pre>
<p>Uma peça de 50 g com PLA a R$ 125/kg custa <code>(50/1000) * 125 = R$ 6,25</code>. Esse é o
custo <strong>teórico</strong>, sem perdas — e raramente é o custo real.</p>
<h2 id="user-content-os-campos-que-ninguém-lembra">Os campos que ninguém lembra</h2>
<p>Ao subir para o nível <strong>Detalhado</strong>, a seção material revela quatro campos que
corrigem a diferença entre a teoria e a impressão real:</p>
<ul>
<li><strong>Purga / perda</strong> — os gramas desperdiçados na torre de purga ou na troca de
cor. Em prints multicoloridos pode ser maior que a própria peça.</li>
<li><strong>Eficiência do carretel</strong> — ninguém usa 100% do rolo: sobras finais e trocas
reduzem o aproveitamento. O padrão sugerido é 95–98%.</li>
<li><strong>Densidade</strong> — usada para converter volume em peso. PLA ≈ 1,24, PETG ≈ 1,27,
ABS ≈ 1,04 g/cm³.</li>
<li><strong>Margem de perda</strong> — aplicada na resina, cobre o que fica no tanque, nos
suportes e na limpeza. Sugerido: 5–10%.</li>
</ul>
<p>Purga e eficiência mudam o custo de forma diferente. A <strong>purga</strong> é um peso extra
que some no lixo; a <strong>eficiência</strong> é um fator que dilui o preço do quilo em tudo
que você consome. A fórmula completa aplica os dois:</p>
<pre><code>peso total     = peso usado + purga
peso efetivo   = peso total * (100 / eficiência do rolo)
custo material = (peso efetivo / 1000) * custo por kg
</code></pre>
<p>Note a divisão: se a eficiência é 98%, o fator é <code>100/98 ≈ 1,02</code> — você paga
cerca de 2% a mais no custo de cada grama, porque parte do rolo foi para o
lixo. É pouco por peça, e muito por ano.</p>
<h2 id="user-content-exemplo-numérico-completo">Exemplo numérico completo</h2>
<p>Uma peça em PLA de 50 g, com torre de purga de 8 g, eficiência de 98% e
R$ 125/kg:</p>
<pre><code>peso total     = 50 + 8            = 58 g
fator          = 100 / 98          = 1,0204
peso efetivo   = 58 * 1,0204       = 59,18 g
custo material = 0,05918 * 125     = R$ 7,40
</code></pre>
<p>Sem esses campos o cálculo diria R$ 6,25. A diferença, R$ 1,15 por peça, é
exatamente o tipo de perda que aparece quando se faz cem unidades — R$ 115 de
lucro evaporado por esquecer a purga.</p>
<h2 id="user-content-resina-volume-não-peso">Resina: volume, não peso</h2>
<p>Na impressão por resina a lógica é outra, porque você compra líquido. Os campos
mudam:</p>
<ul>
<li><strong>Custo por litro</strong> — o preço da resina na garrafa.</li>
<li><strong>Volume usado</strong> — quantos mililitros a peça consome.</li>
<li><strong>Margem de perda</strong> — o percentual que fica no tanque e nos suportes.</li>
<li><strong>Densidade</strong> — converte o volume em peso, para o registro no inventário.</li>
</ul>
<p>A fórmula é análoga à do filamento, mas no universo dos mililitros:</p>
<pre><code>volume com perda = volume usado * (1 + margem de perda / 100)
custo do material = (volume com perda / 1000) * custo por litro
</code></pre>
<p>Uma peça de 30 ml, com 10% de margem de perda e resina a R$ 150 o litro:</p>
<pre><code>volume com perda = 30 * 1,10      = 33 ml
custo material   = 0,033 * 150    = R$ 4,95
</code></pre>
<p>A densidade não entra no preço — ela só existe para que o inventário saiba
quantos gramas a peça tem, informação usada no controle de estoque de resina.</p>
<h2 id="user-content-como-o-inventário-alimenta-a-seção">Como o inventário alimenta a seção</h2>
<p>Você não precisa digitar custo e densidade toda vez. Se o filamento está
catalogado no <strong>inventário</strong>, a calculadora oferece a lista de carretéis
cadastrados e, ao selecionar um, os valores da seção são preenchidos com os
dados daquele rolo: tipo de material, custo por kg e densidade.</p>
<p>A ligação também funciona no sentido contrário: quando uma peça usa um carretel
selecionado, o sistema mostra quanto daquele rolo ainda resta — e desconta o
peso consumido a cada impressão. Assim o preço da próxima peça é calculado com o
custo real do plástico que você tem na prateleira, e não com uma estimativa
fixa. Veja detalhes no artigo sobre o <a href="#user-content-inventario">inventário</a>.</p>
<h2 id="user-content-armadilhas-comuns">Armadilhas comuns</h2>
<ul>
<li><strong>Esquecer a purga em prints coloridos.</strong> A torre de purga de um modelo com
três cores pode pesar mais que a peça. Sem o campo, o custo fica subestimado
desde a primeira peça.</li>
<li><strong>Usar densidade errada.</strong> PLA e ABS têm densidades bem diferentes; se o
catálogo diz 1,24 e o rolo é 1,04, toda conversão de volume sai errada.</li>
<li><strong>Misturar custo do rolo com custo do quilo.</strong> Um carretel de R$ 90 com 1 kg
é R$ 90/kg; um de R$ 90 com 750 g é R$ 120/kg. O inventário guarda o preço
por quilo justamente para essa armadilha não existir.</li>
<li><strong>Manter a eficiência em 100%.</strong> É tentador, mas é mentira: o último trecho
do rolo é quase sempre desperdiçado. 98% é um valor honesto.</li>
</ul>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};