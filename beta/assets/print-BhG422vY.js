var e=`print`,t=`pt-BR`,n={title:`Parâmetros de Impressão`,order:11},r=[{depth:1,text:`Parâmetros de Impressão`,slug:`user-content-parâmetros-de-impressão`},{depth:2,text:`Os três campos básicos`,slug:`user-content-os-três-campos-básicos`},{depth:2,text:`Exemplo numérico`,slug:`user-content-exemplo-numérico`},{depth:2,text:`Seleção de impressora`,slug:`user-content-seleção-de-impressora`},{depth:2,text:`O ajuste de aquecimento`,slug:`user-content-o-ajuste-de-aquecimento`},{depth:2,text:`A fronteira com a seção machine`,slug:`user-content-a-fronteira-com-a-seção-machine`},{depth:2,text:`Armadilhas comuns`,slug:`user-content-armadilhas-comuns`}],i=`<h1 id="user-content-parâmetros-de-impressão">Parâmetros de Impressão</h1>
<p>A seção <strong>print</strong> mede o que a impressora consome enquanto a peça é feita: tempo
de máquina e energia elétrica. É a seção mais direta da calculadora — poucos
campos, sem ajustes subjetivos — mas é também onde muita gente confunde duas
contas diferentes.</p>
<p>A regra de ouro: <strong>print mede o consumo, machine mede o investimento</strong>. A
seção <code>print</code> responde "quanto tempo e quanta energia esta peça exigiu?"; a
seção <a href="#user-content-custos-da-m%C3%A1quina">machine</a> responde "quanto do preço da impressora
este tempo vale?". Uma não substitui a outra: a energia é uma conta de luz, e a
depreciação é uma conta de equipamento. As duas entram no custo, separadas.</p>
<h2 id="user-content-os-três-campos-básicos">Os três campos básicos</h2>
<ul>
<li><strong>Tempo de impressão</strong> — o total que a máquina leva, conforme o fatiador. Não
inclui o tempo de pós-processamento (que fica na seção <code>labor</code>).</li>
<li><strong>Potência da impressora</strong> — o consumo médio em watts. A maioria das FDM fica
entre 100 W e 350 W; resinas costumam consumir menos, mas têm a cura como
etapa extra.</li>
<li><strong>Custo da energia</strong> — o valor do kWh da sua conta de luz.</li>
</ul>
<p>O cálculo é uma multiplicação simples: potência vira quilowatts, vezes o tempo,
vezes o preço do kWh.</p>
<pre><code>energia (kWh)      = (potência / 1000) * horas
custo da energia   = energia (kWh) * custo por kWh
</code></pre>
<h2 id="user-content-exemplo-numérico">Exemplo numérico</h2>
<p>Uma peça que leva 5 horas numa impressora de 250 W, com energia a R$ 0,80 o
kWh:</p>
<pre><code>energia    = (250 / 1000) * 5 = 1,25 kWh
custo      = 1,25 * 0,80      = R$ 1,00
</code></pre>
<p>Cinco horas de máquina por R$ 1,00. É por isso que a energia raramente é o
problema de um orçamento — mas também é por isso que ela é a primeira conta que
a gente esquece. Em cem peças, são R$ 100 que ninguém colocou no preço.</p>
<p>Se a potência ou o tempo mudar, o custo acompanha na mesma proporção: uma peça
de 10 horas na mesma máquina custa R$ 2,00 de energia; uma máquina de 500 W
faria a mesma peça em 5 horas custar R$ 2,00 também.</p>
<h2 id="user-content-seleção-de-impressora">Seleção de impressora</h2>
<p>No nível <strong>Detalhado</strong> (e apenas na aba FDM), a seção ganha um seletor de
impressora. Ele lista as impressoras cadastradas no catálogo — cada uma com
marca, potência e valor — e, ao escolher uma, <strong>o campo de potência é
preenchido automaticamente</strong> com os dados daquela máquina.</p>
<p>A utilidade não é economizar digitação: é <strong>consistência</strong>. Se você sabe que a
Ender 3 da oficina puxa 250 W médios, basta cadastrá-la uma vez para que toda
estimativa use esse número, em vez de um valor qualquer lembrado no momento.
Quando a impressora certa está selecionada, o campo de potência passa a refletir
a realidade — e os orçamentos ficam comparáveis entre si.</p>
<h2 id="user-content-o-ajuste-de-aquecimento">O ajuste de aquecimento</h2>
<p>No nível <strong>Completo</strong> aparecem dois campos que refinam o cálculo de energia:
o tempo de aquecimento e o percentual de potência extra durante ele. A máquina
consome mais no aquecimento do que no resto do print, e esses campos somam esse
excesso à conta.</p>
<p>Para a maioria dos orçamentos a diferença é de centavos — alguns minutos de
pico de potência numa impressora de 250 W. Ele existe para quem quer a conta de
energia exata, mas não muda a estrutura do cálculo: continua sendo kWh vezes
preço do kWh.</p>
<h2 id="user-content-a-fronteira-com-a-seção-machine">A fronteira com a seção machine</h2>
<p>A separação entre <code>print</code> e <code>machine</code> é intencional e vale a pena entender:</p>
<ul>
<li><strong><code>print</code></strong> é <strong>variável por peça</strong> — depende do tempo e da potência que esta
peça específica exigiu. Peça maior, mais horas, mais energia.</li>
<li><strong><code>machine</code></strong> é <strong>fixa por hora</strong> — pega o preço da impressora, divide pelas
horas totais de vida útil e dá um custo por hora. As horas que a peça usa
multiplicam esse valor.</li>
</ul>
<p>Por isso uma peça de 5 horas tem sempre o mesmo custo de energia (se a potência
for a mesma), mas um custo de máquina que <strong>depende de quantas horas a
impressora já trabalhou no mês</strong>. Quando você liga a seção machine, a hora deixa
de ser de graça — e peças longas passam a custar proporcionalmente mais que o
dobro do tempo de máquina.</p>
<h2 id="user-content-armadilhas-comuns">Armadilhas comuns</h2>
<ul>
<li><strong>Usar a potência de pico.</strong> Uma impressora de 350 W de pico trabalha a 150 W
na maioria do tempo. O campo pede a média; usar o pico infla a energia toda.</li>
<li><strong>Confundir tempo de máquina com tempo total.</strong> O fatiador dá o tempo de
impressão; retirar da placa, lavar, curar e finalizar ficam na seção <code>labor</code>.</li>
<li><strong>Esquecer de atualizar a conta de luz.</strong> O kWh sobe; se o campo continua com
o valor antigo, todas as estimativas ficam levemente abaixo da realidade.</li>
</ul>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};