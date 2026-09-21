var e=`hardware`,t=`pt-BR`,n={title:`Desgaste de Hardware`,order:13},r=[{depth:1,text:`Desgaste de Hardware`,slug:`user-content-desgaste-de-hardware`},{depth:2,text:`Por que este custo existe mesmo na peça única`,slug:`user-content-por-que-este-custo-existe-mesmo-na-peça-única`},{depth:2,text:`FDM: bico, mesa e acabamento`,slug:`user-content-fdm-bico-mesa-e-acabamento`},{depth:3,text:`Bico (Nozzle)`,slug:`user-content-bico-nozzle`},{depth:3,text:`Mesa e Adesão`,slug:`user-content-mesa-e-adesão`},{depth:3,text:`Acabamento Físico`,slug:`user-content-acabamento-físico`},{depth:2,text:`Resina: LCD, FEP, lavagem e cura`,slug:`user-content-resina-lcd-fep-lavagem-e-cura`},{depth:2,text:`A fórmula`,slug:`user-content-a-fórmula`},{depth:2,text:`Exemplo numérico passo a passo`,slug:`user-content-exemplo-numérico-passo-a-passo`},{depth:2,text:`Como esta seção se relaciona com as demais`,slug:`user-content-como-esta-seção-se-relaciona-com-as-demais`},{depth:2,text:`Armadilhas práticas`,slug:`user-content-armadilhas-práticas`}],i=`<h1 id="user-content-desgaste-de-hardware">Desgaste de Hardware</h1>
<p>A seção <strong>Desgaste de Hardware</strong> existe para responder a uma pergunta que quase
todo iniciante ignora: <em>o que desta peça se gastou além do filamento?</em> O
filamento é só a parte visível do consumo. A peça também passa pelo <strong>bico</strong>
(desgastando a abertura), pela <strong>mesa</strong> (gastando adesivo ou a folha PEI) e, na
resina, pela <strong>tela LCD</strong>, pelo <strong>filme FEP</strong> e pela <strong>câmara de cura</strong>.</p>
<p>Esta seção só aparece no nível <strong>avançado</strong> da calculadora. Se você está no
modo rápido ou detalhado, ela fica oculta — mas o custo existe do mesmo jeito,
apenas invisível.</p>
<h2 id="user-content-por-que-este-custo-existe-mesmo-na-peça-única">Por que este custo existe mesmo na peça única</h2>
<p>Existe um argumento clássico para ignorar esta seção: <em>"minha impressora já
está paga, então a peça sai de graça"</em>. O problema é que o bico não está pago
para sempre. Cada metro de filamento empurrado por um bico de 0,4 mm o alarga
um pouquinho. Um bico de latão novo custa R$ 35 e dura cerca de 20 kg de PLA.
Se a sua peça usa 180 g, ela consumiu 0,9% da vida útil desse bico — é R$ 0,32
que existe na peça única e que ninguém te pagou de volta.</p>
<p>A seção transforma esse desgaste silencioso em um valor que você pode somar e
cobrar. Sem ela, o preço cobre o filamento e doa o desgaste da máquina.</p>
<h2 id="user-content-fdm-bico-mesa-e-acabamento">FDM: bico, mesa e acabamento</h2>
<p>No <strong>FDM</strong>, a seção reúne três blocos, cada um com um interruptor próprio.</p>
<h3 id="user-content-bico-nozzle">Bico (Nozzle)</h3>
<p>O bico é rateado pelo peso da peça, e dois campos bastam para fechar a conta.</p>
<ul>
<li><strong>Custo do Bico</strong> — quanto você pagou no bico, em reais. Bico de latão é
barato; aço endurecido custa várias vezes mais.</li>
<li><strong>Vida Útil</strong> — quantos <strong>quilogramas</strong> de filamento esse bico aguenta antes
de perder a precisão. Latão com PLA: perto de 20 kg. Aço com filamento
carregado de fibra de carbono: chega a 10 kg ou menos.</li>
</ul>
<p>Deixar a <strong>Vida Útil</strong> em zero desativa o cálculo do bico (a divisão por zero
é protegida e vira zero — o bico não inflaciona o preço, mas também não é
coberto).</p>
<h3 id="user-content-mesa-e-adesão">Mesa e Adesão</h3>
<p>Um campo só, fixo por peça, porque o adesivo se gasta a cada impressão e não por hora.</p>
<ul>
<li><strong>Custo Adesivo/Print</strong> — valor estimado de spray, cola, fita ou desgaste da
folha PEI <strong>por impressão</strong>. É um valor fixo por peça, não por hora.</li>
</ul>
<h3 id="user-content-acabamento-físico">Acabamento Físico</h3>
<p>Um campo para o que você gastou em lixa, primer e tinta nesta peça específica.</p>
<ul>
<li><strong>Insumos Acabamento</strong> — o que você gasta em lixa, primer, tinta, massa
plástica ou acetona nesta peça especificamente. Se a peça é entregue sem
nenhum acabamento, deixe em zero.</li>
</ul>
<h2 id="user-content-resina-lcd-fep-lavagem-e-cura">Resina: LCD, FEP, lavagem e cura</h2>
<p>Na aba de resina a mesma seção ganha outros desgastes, porque uma impressora
SLA tem partes que se gastam por <strong>hora</strong> e por <strong>peça</strong>.</p>
<ul>
<li><strong>Custo Tela LCD</strong> e <strong>Vida Útil LCD</strong> — a tela da resina perde potência com
o uso. A vida útil é contada em <strong>horas</strong> de exposição.</li>
<li><strong>Custo Filme FEP</strong> e <strong>Durabilidade FEP</strong> — o filme do fundo do tanque é
riscado a cada peça descolada. A durabilidade é contada em <strong>impressões</strong>.</li>
<li><strong>Lavagem (Álcool)</strong> — custo do litro de isopropílico e volume consumido por
ciclo. Resina <strong>lavável em água</strong> zera este bloco automaticamente, porque a
peça é limpa sob a torneira.</li>
<li><strong>Cura UV</strong> — tempo de cura e potência da lâmpada, que também se gasta.</li>
</ul>
<h2 id="user-content-a-fórmula">A fórmula</h2>
<p>Para o FDM, a conta é direta: o bico é rateado pelo peso da peça, a mesa e o
acabamento são fixos por peça.</p>
<pre><code>pesoKg = pesoDaPeca / 1000

desgasteBico = (pesoKg / vidaUtilKg) * custoBico
desgasteMesa = custoAdesivo
acabamento   = insumosAcabamento

hardware = desgasteBico + desgasteMesa + acabamento
</code></pre>
<p>Na resina, LCD é rateado por hora e FEP por impressão:</p>
<pre><code>desgasteLCD = (tempoExposicaoH / vidaUtilLCDH) * custoLCD
desgasteFEP = (1 / durabilidadeFEP) * custoFEP
</code></pre>
<h2 id="user-content-exemplo-numérico-passo-a-passo">Exemplo numérico passo a passo</h2>
<p>Imagine um <strong>suporte de celular</strong> em PLA, com <strong>180 g</strong> de filamento, saindo
com lixamento leve e pintura.</p>
<p>Passo a passo pelo FDM:</p>
<pre><code>pesoKg = 180 / 1000 = 0,18 kg

desgasteBico = (0,18 / 20) * 35 = 0,009 * 35 = R$ 0,32
desgasteMesa = R$ 1,50
acabamento   = R$ 2,00

hardware = 0,32 + 1,50 + 2,00 = R$ 3,82
</code></pre>
<p>A peça acabou de ficar <strong>R$ 3,82</strong> mais cara do que o "só o filamento". São
R$ 0,32 de bico que ninguém lembra de cobrar — em cem peças iguais, são
R$ 32 só de bico, o suficiente para um bico novo e mais um café.</p>
<h2 id="user-content-como-esta-seção-se-relaciona-com-as-demais">Como esta seção se relaciona com as demais</h2>
<p>A seção se conecta com cinco outras, e cada fronteira evita uma duplicação de custo.</p>
<ul>
<li>O <strong>peso</strong> que entra na fórmula do bico vem da seção de
<a href="#user-content-material">material</a> — preencha-a primeiro.</li>
<li>O <strong>tempo de exposição</strong> do LCD vem do tempo de impressão, na seção de
<a href="#user-content-par%C3%A2metros-de-impress%C3%A3o">parâmetros</a>.</li>
<li>A depreciação da impressora <strong>inteira</strong> (o bem, não as partes) mora na seção
<a href="#user-content-custos-da-m%C3%A1quina">máquina</a>. Hardware é a parte que se gasta; máquina é
o todo que se deprecia.</li>
<li>O <strong>tempo</strong> que você gasta lixando e pintando é cobrado à parte, em
<a href="#user-content-m%C3%A3o-de-obra">mão de obra</a> — aqui ficam só os insumos.</li>
<li>O resultado de tudo isto é somado em <a href="#user-content-resultados">resultados</a>.</li>
</ul>
<h2 id="user-content-armadilhas-práticas">Armadilhas práticas</h2>
<p>Quatro erros no preenchimento, e todos eles deixam o desgaste de fora do preço.</p>
<ol>
<li><strong>Subestimar a vida útil do bico com filamento abrasivo.</strong> Fibra de carbono
e glitter comem bico de latão em poucos quilos. Se você imprime com esses
materiais, ou a vida útil baixa para 10 kg ou o bico sobe para aço.</li>
<li><strong>Esquecer o acabamento.</strong> É o campo mais deixado em zero — e o que mais
difere uma peça "de protótipo" de uma peça "de produto". Lixa e tinta não
são de graça.</li>
<li><strong>Confundir desgaste com depreciação.</strong> Se você colocar o preço da impressora
aqui, o custo sai duplicado: a impressora inteira já está sendo depreciada na
seção <a href="#user-content-custos-da-m%C3%A1quina">máquina</a>. Aqui entram só as partes
consumíveis.</li>
<li><strong>Medir a vida útil do bico em peças, não em quilos.</strong> O bico se desgasta
pela quantidade de material extrudado, não pela quantidade de arquivos. Uma
peça oca de 800 g gasta oito vezes mais bico que um charuto de 100 g.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};