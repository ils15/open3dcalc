var e=`labor`,t=`pt-BR`,n={title:`Mão de Obra`,order:16},r=[{depth:1,text:`Mão de Obra`,slug:`user-content-mão-de-obra`},{depth:2,text:`O que NÃO entra aqui: o tempo de impressão`,slug:`user-content-o-que-não-entra-aqui-o-tempo-de-impressão`},{depth:2,text:`Campos da seção`,slug:`user-content-campos-da-seção`},{depth:2,text:`A fórmula`,slug:`user-content-a-fórmula`},{depth:2,text:`Exemplo numérico passo a passo`,slug:`user-content-exemplo-numérico-passo-a-passo`},{depth:2,text:`Quanto cobrar de valor hora`,slug:`user-content-quanto-cobrar-de-valor-hora`},{depth:2,text:`Como esta seção se relaciona com as demais`,slug:`user-content-como-esta-seção-se-relaciona-com-as-demais`},{depth:2,text:`Armadilhas práticas`,slug:`user-content-armadilhas-práticas`}],i=`<h1 id="user-content-mão-de-obra">Mão de Obra</h1>
<p>A seção <strong>Mão de Obra</strong> responde a: <em>quanto vale o meu tempo nesta peça?</em> São
os minutos em que um ser humano está de fato trabalhando: preparando o arquivo,
fatiando, configurando a impressora, descolando a peça, removendo suporte,
lixando.</p>
<p>Esta seção só aparece no nível <strong>avançado</strong>. É a seção que separa quem custeia
o próprio tempo de quem trata a própria hora como de graça.</p>
<h2 id="user-content-o-que-não-entra-aqui-o-tempo-de-impressão">O que NÃO entra aqui: o tempo de impressão</h2>
<p>Este é o ponto mais importante da seção, e a fonte do erro mais comum: <strong>o
tempo que a impressora passa imprimindo não é mão de obra</strong>. Durante essas
horas a máquina trabalha sozinha e você pode estar fazendo outra coisa — ou
outro trabalho remunerado. O tempo de impressão é cobrado pela
<a href="#user-content-custos-da-m%C3%A1quina">máquina</a> (depreciação, energia, rateio), não por aqui.</p>
<p>Se você somar as 5,5 horas de impressão na mão de obra, o cliente paga o dobro:
uma vez como máquina, uma vez como gente. A mão de obra conta só os minutos em
que <strong>você</strong> é necessário.</p>
<h2 id="user-content-campos-da-seção">Campos da seção</h2>
<ul>
<li><strong>Setup (Fatiamento)</strong> — minutos gastos preparando o arquivo: ajustar o
modelo, posicionar a chapa, configurar o fatiador, exportar o gcode, nivelar
a mesa e carregar o filamento. Em uma peça simples são 5 minutos; em um
arquivo de cliente com várias revisões, podem ser 40.</li>
<li><strong>Pós-Processamento</strong> — minutos retirando a peça da mesa, removendo suportes,
lixando, colando, pintando. Esse tempo é proporcional a cada peça.</li>
<li><strong>Valor Hora</strong> — quanto você quer ganhar por <strong>hora</strong> de trabalho, em reais.
É o campo mais deixado em zero. Se estiver em zero, esta seção inteira soma
zero — e você doa o próprio tempo.</li>
</ul>
<h2 id="user-content-a-fórmula">A fórmula</h2>
<p>Minutos viram horas e multiplicam pelo valor hora:</p>
<pre><code>totalMinutos = setupMinutos + posProcessamentoMinutos

labor = (totalMinutos / 60) * valorHora
</code></pre>
<p>Quando você produz mais de uma unidade idêntica, o app dilui a mão de obra
entre as unidades — o setup é compartilhado pelo lote todo:</p>
<pre><code>laborPorUnidade = labor / quantidade
</code></pre>
<p>Veja a armadilha abaixo sobre o pós-processamento nessa diluição.</p>
<h2 id="user-content-exemplo-numérico-passo-a-passo">Exemplo numérico passo a passo</h2>
<p>Nossa peça-exemplo, o suporte de celular. Você levou 12 minutos configurando o
fatiador e 18 minutos descolando e lixando a peça, e quer ganhar <strong>R$ 25 por
hora</strong>.</p>
<pre><code>totalMinutos = 12 + 18 = 30 min

labor = (30 / 60) * 25 = 0,5 * 25 = R$ 12,50
</code></pre>
<p>Por trás do número: <strong>R$ 5,00</strong> de setup (0,2 h × 25) e <strong>R$ 7,50</strong> de
pós-processamento (0,3 h × 25). Agora o mesmo cenário com um lote de 10
unidades:</p>
<pre><code>labor = 12,50 / 10 = R$ 1,25 por unidade
</code></pre>
<p>Na prática, o setup de 12 minutos foi pago uma vez e rateado. Já os 18 minutos
de lixamento acontecem de novo em cada peça — por isso o lote merece atenção.</p>
<h2 id="user-content-quanto-cobrar-de-valor-hora">Quanto cobrar de valor hora</h2>
<p>Não existe resposta única, mas existe um piso: o seu valor hora precisa cobrir
o que a hora custa para você, não só o que ela "vale no mercado". Some o que
você gasta por mês (incluindo o que está nas seções
<a href="#user-content-custos-fixos">custos fixos</a> e <a href="#user-content-custos-da-m%C3%A1quina">máquina</a>) e
divida pelas horas que você de fato trabalha no negócio. Qualquer valor abaixo
disso é trabalho de graça.</p>
<pre><code>pisoValorHora = custoMensalTotal / horasTrabalhadasMes
</code></pre>
<p>R$ 25/h é um começo honesto para uma operação de uma só pessoa; R$ 8/h é
trabalho escravo subsidiado por outra fonte de renda.</p>
<h2 id="user-content-como-esta-seção-se-relaciona-com-as-demais">Como esta seção se relaciona com as demais</h2>
<ul>
<li>O <strong>tempo de impressão</strong> (que NÃO está aqui) vem de
<a href="#user-content-par%C3%A2metros-de-impress%C3%A3o">parâmetros</a> e alimenta <a href="#user-content-custos-da-m%C3%A1quina">máquina</a>.</li>
<li>Os <strong>insumos</strong> do pós-processamento — lixa, tinta, acetona — moram em
<a href="#user-content-desgaste-de-hardware">desgaste de hardware</a>, bloco de acabamento. Aqui
fica só o tempo; lá fica o material.</li>
<li>O <strong>rateio e a depreciação</strong> estão em <a href="#user-content-custos-da-m%C3%A1quina">máquina</a> e
<a href="#user-content-custos-fixos">custos fixos</a>, e são multiplicados pelas horas de
impressão, não pelas suas horas.</li>
<li>O lucro por hora exibido em <a href="#user-content-resultados">resultados</a> usa
exatamente esta combinação: horas de impressão + pós + setup diluído.</li>
</ul>
<h2 id="user-content-armadilhas-práticas">Armadilhas práticas</h2>
<ol>
<li><strong>Deixar o valor hora em zero.</strong> É o erro mais frequente. A calculadora
aceita e simplesmente mostra um preço mais baixo — bonito na tela, prejuízo
na vida. Se não sabe o número, comece com R$ 25 e ajuste para cima.</li>
<li><strong>Somar o tempo de impressão na mão de obra.</strong> Duplicação pura. A máquina
já está sendo cobrada por essas horas; a sua pessoa não estava lá o tempo
todo.</li>
<li><strong>Não contar o setup.</strong> "Ah, foram só 10 minutos." São 10 minutos de cada
vez que você não faturou. Em cem orçamentos, são mais de 16 horas doadas.</li>
<li><strong>Diluir o pós-processamento em lotes.</strong> O app dilui a mão de obra inteira
por unidade quando a quantidade é maior que 1, o que é justo para o setup.
Mas se cada peça é lixada individualmente, o pós é um custo por unidade, não
do lote — confira se o preço por unidade do
<a href="#user-content-resultados">resultado</a> ainda cobre o acabamento individual.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};