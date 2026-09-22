var e=`machine`,t=`pt-BR`,n={title:`Custos da Máquina`,order:14},r=[{depth:1,text:`Custos da Máquina`,slug:`user-content-custos-da-máquina`},{depth:2,text:`Máquina, energia e hardware: três coisas diferentes`,slug:`user-content-máquina-energia-e-hardware-três-coisas-diferentes`},{depth:2,text:`Campos da seção`,slug:`user-content-campos-da-seção`},{depth:2,text:`A fórmula`,slug:`user-content-a-fórmula`},{depth:2,text:`Exemplo numérico passo a passo`,slug:`user-content-exemplo-numérico-passo-a-passo`},{depth:2,text:`Sensibilidade: o que muda a taxa`,slug:`user-content-sensibilidade-o-que-muda-a-taxa`},{depth:2,text:`Como esta seção se relaciona com as demais`,slug:`user-content-como-esta-seção-se-relaciona-com-as-demais`},{depth:2,text:`Armadilhas práticas`,slug:`user-content-armadilhas-práticas`}],i=`<h1 id="user-content-custos-da-máquina">Custos da Máquina</h1>
<p>A seção <strong>Custos da Máquina</strong> responde a: <em>quanto desta peça é o desgaste da
impressora?</em> É a depreciação do equipamento: o preço que você pagou pela
impressora, dividido pela vida útil dela, cobrado por hora de trabalho. É a
seção que faz o preço de uma peça incluir, fatia por fatia, o dinheiro que você
gastou para comprar a máquina.</p>
<p>Esta seção só aparece no nível <strong>avançado</strong>. No modo rápido ou detalhado ela é
omitida — a depreciação fica embutida mas não é mostrada.</p>
<h2 id="user-content-máquina-energia-e-hardware-três-coisas-diferentes">Máquina, energia e hardware: três coisas diferentes</h2>
<p>Estas três seções se confundem facilmente. A distinção é esta:</p>
<ul>
<li><strong>Parâmetros de impressão</strong> mede a <strong>energia</strong> — quantos kWh a impressora
consumiu nesta peça. É conta de luz.</li>
<li><strong>Máquina</strong> mede a <strong>depreciação da impressora inteira</strong> — o bem se pagando
ao longo da vida útil.</li>
<li><strong>Desgaste de hardware</strong> mede as <strong>partes consumíveis</strong> — bico, mesa, LCD,
FEP. Veja <a href="#user-content-desgaste-de-hardware">hardware</a>.</li>
</ul>
<p>Se você colocar o preço da impressora em dois desses três lugares, o cliente
paga a máquina duas vezes.</p>
<h2 id="user-content-campos-da-seção">Campos da seção</h2>
<p>Cada campo aqui é uma peça da taxa horária. O interruptor no topo da seção
liga ou desliga a depreciação inteira.</p>
<ul>
<li><strong>Custo da Impressora</strong> — quanto você pagou pela máquina, em reais. Inclua
frete e impostos se possível, porque é o que saiu do seu bolso. Deixar em
zero desativa a depreciação (a máquina "de graça", o que raramente é
verdade).</li>
<li><strong>Depreciação</strong> — em <strong>quantos meses</strong> a impressora se paga. O padrão do
mercado é 36 meses para equipamentos. Um prazo curto (12 meses) gera uma taxa
horária alta; um prazo longo (60 meses) barateia cada peça, mas a máquina
provavelmente vai morrer antes de terminar.</li>
<li><strong>Uso Mensal</strong> — <strong>quantas horas por mês</strong> a impressora fica de fato
imprimindo. É o campo mais perigoso da seção, e tem uma armadilha abaixo.</li>
<li><strong>Manutenção</strong> (interruptor) — ativa o bloco de manutenção.</li>
<li><strong>Custo Mensal Manutenção</strong> — quanto você gasta por mês em bicos de
reposição, correias, rolamentos, lubrificação e peças sobressalentes.</li>
</ul>
<h2 id="user-content-a-fórmula">A fórmula</h2>
<p>A vida útil total é a multiplicação dos meses pelas horas mensais. A taxa
horária é o preço dividido por essa vida.</p>
<pre><code>vidaUtilHoras = depreciacaoMeses * horasPorMes

depreciacaoPorHora = custoImpressora / vidaUtilHoras
manutencaoPorHora  = custoManutencao / horasPorMes

taxaHoraria = depreciacaoPorHora + manutencaoPorHora + rateioFixo

machine = taxaHoraria * tempoImpressaoHoras
</code></pre>
<p>O <code>rateioFixo</code> vem da seção <a href="#user-content-custos-fixos">custos fixos</a> e é
adicionado aqui, na taxa horária da máquina, porque é na máquina que as horas
produtivas acontecem. Se os custos fixos estão desligados, essa parcela é
zero.</p>
<p>O cálculo é protegido contra divisão por zero: <code>vidaUtilHoras</code> ou
<code>horasPorMes</code> iguais a zero zeram a parcela correspondente em vez de estourar.</p>
<h2 id="user-content-exemplo-numérico-passo-a-passo">Exemplo numérico passo a passo</h2>
<p>Uma <strong>Ender 3</strong> custou <strong>R$ 1.800</strong>. Você usa há 3 anos, imprime cerca de
<strong>100 horas por mês</strong> e gasta <strong>R$ 30 por mês</strong> com manutenção. Vamos montar a
peça-exemplo: um suporte de celular com <strong>5,5 horas</strong> de impressão.</p>
<pre><code>vidaUtilHoras = 36 * 100 = 3.600 h

depreciacaoPorHora = 1.800 / 3.600 = R$ 0,50/h
manutencaoPorHora  = 30 / 100      = R$ 0,30/h
rateioFixo          = R$ 3,00/h   (de custos fixos)

taxaHoraria = 0,50 + 0,30 + 3,00 = R$ 3,80/h

machine = 3,80 * 5,5 = R$ 20,90
</code></pre>
<p>A peça carrega <strong>R$ 20,90</strong> de máquina. Desse total, R$ 2,75 são de depreciação
pura (0,50 × 5,5), R$ 1,65 são de manutenção e R$ 16,50 são de rateio de custos
fixos. Note quem domina: o rateio fixo. É por isso que a seção
<a href="#user-content-custos-fixos">custos fixos</a> é a que mais separa hobby de negócio.</p>
<p>Uma observação sobre os números. Este exemplo usa <strong>100 horas por mês</strong>, que é o
uso real <strong>desta impressora</strong>. É a base da depreciação e da manutenção. A seção de
<a href="#user-content-custos-fixos">custos fixos</a> trabalha com <strong>150 horas por mês</strong>, que
são as horas produtivas da oficina inteira. Esses campos são independentes no
aplicativo, e os valores diferentes estão corretos: um mede o desgaste de uma
máquina, o outro rateia o custo do espaço.</p>
<h2 id="user-content-sensibilidade-o-que-muda-a-taxa">Sensibilidade: o que muda a taxa</h2>
<p>A taxa horária é uma fração com dois denominadores. Pequenas mudanças nos
campos têm efeito grande no preço final:</p>
<pre><code>Uso mensal de 200 h em vez de 100 h:
  depreciacaoPorHora = 1.800 / 7.200 = R$ 0,25/h   (metade!)

Depreciação de 12 meses em vez de 36:
  depreciacaoPorHora = 1.800 / 1.200 = R$ 1,50/h   (tríplice!)
</code></pre>
<p>Se você imprime pouco, a depreciação por peça é alta — e isso é correto, não
erro da calculadora. O remédio não é mentir as horas, é imprimir mais ou aceitar
que peças avulsas em uma máquina parada são caras de verdade.</p>
<h2 id="user-content-como-esta-seção-se-relaciona-com-as-demais">Como esta seção se relaciona com as demais</h2>
<p>Cada pedaço da taxa horária vem de um lugar, e as fronteiras evitam cobrar a máquina duas vezes.</p>
<ul>
<li>O <strong>tempo</strong> que multiplica a taxa horária é o tempo de impressão da seção de
<a href="#user-content-par%C3%A2metros-de-impress%C3%A3o">parâmetros</a>, não o tempo de mão de obra.</li>
<li>O <strong>rateio</strong> que entra na taxa vem de
<a href="#user-content-custos-fixos">custos fixos</a>.</li>
<li>As <strong>partes</strong> gastas (bico, mesa) estão em <a href="#user-content-desgaste-de-hardware">hardware</a>
e são somadas à parte.</li>
<li>A depreciação entra no bloco "Equipamento &#x26; Desgaste" do
<a href="#user-content-resultados">resultado</a>.</li>
</ul>
<h2 id="user-content-armadilhas-práticas">Armadilhas práticas</h2>
<p>Quatro erros na taxa horária, e todos eles fazem a peça sair mais barata do que custa.</p>
<ol>
<li><strong>Superestimar o uso mensal.</strong> É a armadilha número um. Se você coloca 200
h/mês mas a impressora só roda 40 h, a depreciação fica cinco vezes mais
baixa que a real e toda peça sai subprecificada. Coloque a média honesta dos
últimos três meses.</li>
<li><strong>Esquecer a manutenção.</strong> Impressora 3D é um aparelho com peças móveis
que se desgastam. Se você não liga a manutenção, em oito meses chega a conta real
de correias e bicos que nenhuma peça pagou.</li>
<li><strong>Depreciação longa demais.</strong> 60 meses faz a taxa horária parecer
irresistível, mas uma Ender 3 dificilmente sobrevive 3.600 horas úteis sem
a precisão degradar. 24 a 36 meses é o intervalo realista.</li>
<li><strong>Contar horas de impressora ligada como horas imprimindo.</strong> Aquecimento,
nivelamento e troca de filamento não imprimem nada. O campo é "horas por mês
imprimindo" — o tempo de chapa de fato se movendo.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};