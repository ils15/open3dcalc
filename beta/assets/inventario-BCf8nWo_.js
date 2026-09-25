var e=`inventario`,t=`pt-BR`,n={title:`Inventário`,order:20,tourId:`inventario-bobinas`},r=[{depth:1,text:`Inventário`,slug:`user-content-inventário`},{depth:2,text:`A Estante de Filamento`,slug:`user-content-a-estante-de-filamento`},{depth:2,text:`A aba Cadastros`,slug:`user-content-a-aba-cadastros`},{depth:2,text:`Como cada campo chega à estimativa`,slug:`user-content-como-cada-campo-chega-à-estimativa`},{depth:2,text:`Estimativa genérica x catálogo real`,slug:`user-content-estimativa-genérica-x-catálogo-real`},{depth:2,text:`Rolo parcial, tara e cobertura`,slug:`user-content-rolo-parcial-tara-e-cobertura`},{depth:2,text:`Armadilhas que custam dinheiro`,slug:`user-content-armadilhas-que-custam-dinheiro`},{depth:2,text:`Por que vale a pena`,slug:`user-content-por-que-vale-a-pena`}],i=`<h1 id="user-content-inventário">Inventário</h1>
<p>O <strong>Inventário</strong> é o catálogo que alimenta a calculadora. Em vez de estimar o
custo com valores genéricos, você cadastra uma vez o que comprou e o que usa —
e toda estimativa passa a sair de números reais.</p>
<p>A <strong>Estante de Filamento</strong> é uma aba única (identificada internamente como
<code>inventory</code>). A antiga aba <code>spools</code> foi removida: não existe uma segunda lista
para manter em sincronia. A aba <strong>Cadastros</strong>, que registra impressoras,
materiais e marketplaces, continua separada e é usada para preencher outros
campos da calculadora.</p>
<p>Cada dado da estante é lido por uma seção específica da calculadora. Se um
dado estiver errado, todo orçamento que o usa sai errado — por isso este
catálogo é o lugar mais barato de ganhar precisão.</p>
<h2 id="user-content-a-estante-de-filamento">A Estante de Filamento</h2>
<p>Cada entrada é um <strong>carretel</strong> físico. A estante reúne os dados que ajudam a
decidir se ele serve para a peça atual:</p>
<ul>
<li><strong>Marca</strong> e <strong>material</strong> (PLA, PETG, ABS, TPU, ASA, SILK...).</li>
<li><strong>Cor</strong> e o valor hexadecimal, para diferenciar carretéis parecidos.</li>
<li><strong>Peso bruto</strong> e <strong>peso líquido</strong>, em gramas. O peso líquido é o filamento que
ainda está disponível depois da tara.</li>
<li><strong>Tara do carretel</strong>, o peso da bobina vazia.</li>
<li><strong>Metros restantes</strong>, quando o diâmetro e a densidade permitem a conversão.</li>
<li><strong>Preço por kg</strong>, que é quanto você pagou por quilo.</li>
<li><strong>Diâmetro</strong>, em milímetros — o padrão é <code>1.75</code>.</li>
<li><strong>Status</strong>: <code>Em estoque</code>, <code>A caminho</code> ou <code>Vazio</code>.</li>
<li><strong>Onde comprou</strong> e <strong>observações</strong>, livres.</li>
</ul>
<p>A lista filtra por material e por status. Cada card mostra um swatch circular
na cor cadastrada, o percentual restante, a cobertura necessária para a peça
ativa e um aviso de estoque baixo quando <code>isLowStockSpool</code> é verdadeiro.</p>
<p>A estante também participa do fluxo da calculadora: o botão para <strong>adicionar à
estante</strong> pode receber os dados do material e da configuração atual, sem
obrigar você a cadastrar o mesmo carretel outra vez. Ao selecionar um carretel
no cálculo, os dados dele alimentam a estimativa.</p>
<h2 id="user-content-a-aba-cadastros">A aba Cadastros</h2>
<p>São três catálogos de presets:</p>
<ul>
<li><strong>Impressoras</strong>: nome, marca, <strong>potência</strong> (W), <strong>valor</strong> (R$), <strong>vida útil</strong>
em horas, <strong>manutenção por hora</strong> (R$/h) e tags livres de organização.</li>
<li><strong>Materiais</strong>: nome, <strong>tipo</strong> (<code>fdm</code> ou <code>resina</code>), <strong>densidade</strong> (g/cm³) e
<strong>preço médio</strong> (R$/kg).</li>
<li><strong>Marketplaces</strong>: nome, <strong>taxa percentual</strong>, <strong>taxa fixa</strong>, <strong>frete grátis</strong>
e a <strong>porcentagem do frete</strong>.</li>
</ul>
<p>O app já traz uma lista pronta de materiais (PLA, PETG, ABS, ASA, TPU, Nylon,
PC e as versões com fibra de carbono) e de impressoras conhecidas. Você edita
qualquer preset ou cria um personalizado.</p>
<h2 id="user-content-como-cada-campo-chega-à-estimativa">Como cada campo chega à estimativa</h2>
<p>A calculadora divide o custo em seções independentes, e o inventário alimenta
quatro delas:</p>
<ul>
<li>preço por kg, peso restante e diâmetro do rolo → seção <a href="#user-content-material">Material</a></li>
<li>valor da impressora, vida útil e manutenção mensal → seção <a href="#user-content-custos-da-m%C3%A1quina">Machine</a></li>
<li>potência da impressora e tarifa de energia → seção <a href="#user-content-par%C3%A2metros-de-impress%C3%A3o">Print</a></li>
<li>taxas e frete do marketplace → seção <a href="#user-content-custos-adicionais-e-vendas">Sales</a></li>
</ul>
<pre><code>material = (peso da peca + peso das falhas) * preco por kg / 1000
machine  = ((valor da impressora / vida util) + (manutencao mensal / horas por mes) + rateio fixo) * horas
print    = (potencia / 1000) * horas * tarifa de energia
</code></pre>
<p>O diâmetro entra antes de tudo: ele converte o volume do modelo em peso. Por
isso o padrão é <code>1.75</code> — um desvio de <code>0.05</code> mm já muda o volume em cerca de
<code>5.7%</code>, e o peso junto.</p>
<h2 id="user-content-estimativa-genérica-x-catálogo-real">Estimativa genérica x catálogo real</h2>
<p>Imagine uma peça de <strong>180 g</strong>. Com o preset genérico de PLA a R$ 90/kg:</p>
<pre><code>material = 0.180 kg * R$ 90 = R$ 16,20
</code></pre>
<p>Você pagou R$ 112/kg num PLA Silk específico. Com o catálogo atualizado:</p>
<pre><code>material = 0.180 kg * R$ 112 = R$ 20,16
</code></pre>
<p>São <strong>R$ 3,96 a mais</strong> por peça — 24% acima do que a estimativa genérica
mostrava. Num mês de 50 peças, R$ 198 de margem que sumiria sem ninguém
perceber. O catálogo não muda o preço que você paga; ele só mostra a verdade.</p>
<p>O mesmo vale para a máquina. Uma impressora de R$ 1.800 com vida útil de
2.000 horas custa <strong>R$ 0,90 por hora</strong> de uso, então uma impressão de 6 horas
embute R$ 5,40 de amortização — esse valor entra na seção Machine. A potência
cadastrada alimenta outra seção, a Print: 350 W durante 6 horas, a R$ 0,75 o
kWh, somam R$ 1,58 de energia. Sem esses campos cadastrados, a
calculadora não tem como adivinhar nenhum dos dois.</p>
<h2 id="user-content-rolo-parcial-tara-e-cobertura">Rolo parcial, tara e cobertura</h2>
<p>O <strong>peso líquido</strong> é o que torna a estante útil no dia a dia. Ele anda
junto com a calculadora: a peça ativa e a quantidade atual definem quanto
plástico a impressão vai consumir, e cada carretel responde se dá conta:</p>
<pre><code>necessario = peso unitario da peca * quantidade
cobertura  = peso restante do rolo - necessario
</code></pre>
<p>Quando falta, o app mostra <strong>"Não cobre a peça"</strong> e quantos gramas faltam.
Assim você troca o rolo antes de imprimir, e não no meio do print.</p>
<p>Para pesar um rolo parcial na balança, informe a <strong>tara</strong>. Sem ela, a leitura
inclui o carretel vazio. O app conhece as taras por marca (Bambu Lab 210 g,
Prusament 194 g, Polymaker 140 g, Anycubic 127 g) e usa a tabela
automaticamente — mas uma tara medida no rolo sempre vence a tabela, porque
variação de lote existe.</p>
<p>Exemplo: a balança mostra 400 g num rolo Bambu Lab. Descontando a tara de
210 g, restam <strong>190 g</strong> de filamento de verdade. Ignorar a tara faria a
calculadora superestimar o material em mais de 100%.</p>
<p>Além dos gramas, a estante calcula <strong>metros restantes</strong> quando o diâmetro e a
densidade do material estão preenchidos. A mesma informação pode ser usada para
planejar um lote maior: compare os metros disponíveis com a demanda estimada,
sem trocar o peso líquido por um número de catálogo.</p>
<h2 id="user-content-armadilhas-que-custam-dinheiro">Armadilhas que custam dinheiro</h2>
<p>Quatro erros de cadastro silenciosos, cada um suficiente para tirar a precisão de todas as estimativas.</p>
<ul>
<li><strong>Densidade errada</strong>: ABS é 1,04 g/cm³, PLA é 1,24. Uma peça de 100 cm³ são
104 g de ABS ou 124 g de PLA — 20 g de diferença. Quem estima por volume
com a densidade de outro material erra o peso, e o custo vai junto.</li>
<li><strong>Preço por rolo, não por kg</strong>: um rolo de 1 kg a R$ 90 é R$ 90/kg; um
"econômico" de 500 g a R$ 65 é R$ 130/kg — 44% mais caro por grama.</li>
<li><strong>Rolo parcial não contabilizado</strong>: orçar com o peso original de um rolo
pela metade faz a cobertura falhar na hora de imprimir.</li>
<li><strong>Status esquecido</strong>: um rolo marcado como <code>Em estoque</code> mas vazio engana o
filtro na hora de escolher o filamento.</li>
</ul>
<h2 id="user-content-por-que-vale-a-pena">Por que vale a pena</h2>
<p>Cadastrar é trabalho de uma vez. Cada campo preenchido é uma estimativa mais
precisa para sempre, sem comprar nada e sem mudar o processo. Não existe
outra alavanca no app que entregue tanto ganho de precisão por tão pouco
esforço — comece pela impressora e pelo material que você mais usa, e o
resto fica mais fácil.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};