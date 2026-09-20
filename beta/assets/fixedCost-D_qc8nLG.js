var e=`fixedCost`,t=`pt-BR`,n={title:`Custos Fixos`,order:15},r=[{depth:1,text:`Custos Fixos`,slug:`user-content-custos-fixos`},{depth:2,text:`Por que ratear e não ignorar`,slug:`user-content-por-que-ratear-e-não-ignorar`},{depth:2,text:`Campos da seção`,slug:`user-content-campos-da-seção`},{depth:2,text:`A fórmula`,slug:`user-content-a-fórmula`},{depth:2,text:`Exemplo numérico passo a passo`,slug:`user-content-exemplo-numérico-passo-a-passo`},{depth:2,text:`A sensibilidade que assusta`,slug:`user-content-a-sensibilidade-que-assusta`},{depth:2,text:`Como esta seção se relaciona com as demais`,slug:`user-content-como-esta-seção-se-relaciona-com-as-demais`},{depth:2,text:`Armadilhas práticas`,slug:`user-content-armadilhas-práticas`}],i=`<h1 id="user-content-custos-fixos">Custos Fixos</h1>
<p>A seção <strong>Custos Fixos</strong> responde a uma pergunta incômoda: <em>o que esta peça
paga do aluguel?</em> Tudo que você gasta por mês mesmo que a impressora fique
desligada — aluguel da oficina, internet, energia da base, condomínio, taxa de
software obrigatório. Nenhuma peça usa essas coisas sozinha, mas todas precisam
delas para existir.</p>
<p>Esta seção só aparece no nível <strong>avançado</strong>. É, de longe, a seção mais
subestimada da calculadora e a que mais separa um hobby de um negócio de
verdade.</p>
<h2 id="user-content-por-que-ratear-e-não-ignorar">Por que ratear e não ignorar</h2>
<p>O argumento contra esta seção é: <em>"o aluguel eu pago de qualquer jeito"</em>. É
verdade, e é exatamente por isso que ele precisa estar no preço. Se nenhuma
peça paga o aluguel, então é o seu salário — ou a sua poupança — que está
cobrindo o aluguel do negócio. O cliente sai com uma peça barata e você sai
pagando o espaço onde ela foi feita.</p>
<p>O rateio resolve isso com uma ideia simples: o custo mensal é dividido pelas
horas produtivas do mês, e cada peça paga a parte das horas que ela usou. Peça
alguma que use mais horas, paga mais aluguel. Justo.</p>
<h2 id="user-content-campos-da-seção">Campos da seção</h2>
<p>A seção é enxuta de propósito — dois campos e um interruptor.</p>
<ul>
<li><strong>Custo Fixo Mensal</strong> — a soma de tudo que você paga por mês independente da
produção. Aluguel, internet, energia base, manutenção predial, software com
assinatura obrigatória. Veja a armadilha abaixo sobre o que não colocar aqui.</li>
<li><strong>Horas por Mês</strong> — as <strong>horas produtivas</strong> estimadas da impressora por mês,
a mesma ideia do campo <a href="#user-content-machine">uso mensal</a>. Se este campo
ficar em zero, a divisão é protegida e o rateio vira zero — o que significa
que nenhuma peça está pagando o aluguel.</li>
</ul>
<h2 id="user-content-a-fórmula">A fórmula</h2>
<p>A conta é a mais simples da calculadora, e talvez por isso seja a mais
ignorada:</p>
<pre><code>rateioPorHora = custoFixoMensal / horasProdutivasMes

fixedCost = rateioPorHora * tempoImpressaoHoras
</code></pre>
<p>O resultado não é somado como uma linha separada: ele é injetado na <strong>taxa
horária da máquina</strong>, na seção <a href="#user-content-machine">máquina</a>. Assim, o
rateio acompanha as horas de impressão de cada peça — peça longa, mais aluguel.</p>
<h2 id="user-content-exemplo-numérico-passo-a-passo">Exemplo numérico passo a passo</h2>
<p>Uma oficina pequena em um quarto transformado em estúdio:</p>
<pre><code>aluguel + condomínio     = R$ 450
internet                 = R$ 60
energia base (standby)   = R$ 40
-------------------------
custoFixoMensal          = R$ 550

horasProdutivasMes       = 150 h

rateioPorHora = 550 / 150 = R$ 3,67/h
</code></pre>
<p>Nossa peça-exemplo, o suporte de celular com <strong>5,5 horas</strong> de impressão:</p>
<pre><code>fixedCost = 3,67 * 5,5 = R$ 20,18
</code></pre>
<p>A peça carrega <strong>R$ 20,18</strong> de aluguel, internet e energia base. Compare com os
R$ 16,20 de <a href="#user-content-material">material</a>: a peça paga mais aluguel do que
filamento. É esse o momento em que muita gente descobre que o preço de venda
estava cobrando só o plástico.</p>
<h2 id="user-content-a-sensibilidade-que-assusta">A sensibilidade que assusta</h2>
<p>O rateio é uma divisão — e divisões explodem quando o denominador é pequeno.
Veja a mesma oficina com diferentes horas produtivas:</p>
<pre><code>150 h/mês → 550 / 150 = R$ 3,67/h
100 h/mês → 550 / 100 = R$ 5,50/h
 50 h/mês → 550 /  50 = R$ 11,00/h
</code></pre>
<p>Se a impressora passa a semana parada, cada peça precisa carregar o dobro ou o
quádruplo do aluguel. Isso não é um defeito do cálculo: é a realidade de uma
operação subutilizada. A saída é ou ocupar a máquina ou aceitar que peças
avulsas de fim de semana têm um preço justo mais alto.</p>
<h2 id="user-content-como-esta-seção-se-relaciona-com-as-demais">Como esta seção se relaciona com as demais</h2>
<ul>
<li>O rateio é aplicado na taxa horária da <a href="#user-content-machine">máquina</a>,
junto com a depreciação e a manutenção.</li>
<li>As horas que você usa aqui devem ser <strong>as mesmas</strong> do uso mensal da
<a href="#user-content-machine">máquina</a>. Usar 150 h aqui e 300 h lá é
autoengano: o rateio sai pela metade.</li>
<li>A <strong>energia da impressão</strong> (diferente da energia base) é contada na seção de
<a href="#user-content-print">parâmetros</a>; não a duplique aqui.</li>
<li>A <strong>manutenção do equipamento</strong> fica na <a href="#user-content-machine">máquina</a>;
aqui fica a manutenção do <strong>espaço</strong>.</li>
</ul>
<h2 id="user-content-armadilhas-práticas">Armadilhas práticas</h2>
<ol>
<li><strong>Colocar custos variáveis aqui.</strong> Filamento, agulha, isopropílico e frete
são proporcionais à produção — já têm sua própria seção. Aqui entra só o que
é fixo: se dobra ou zerou a produção, o valor não muda.</li>
<li><strong>Horas produtivas otimistas.</strong> Se a máquina fica ligada 12 horas por dia mas
só imprime 4, são 4 as horas produtivas. Superestimar este campo é a forma
mais comum de baratear artificialmente o próprio preço.</li>
<li><strong>Esquecer os custos invisíveis.</strong> Internet, software de assinatura, taxa de
cartão da maquininha, estacionamento. Ninguém lembra de cobrar R$ 60 de
internet — sobre cem peças por mês, são R$ 0,60 por peça que ninguém pagou.</li>
<li><strong>Não ratear quando imprime pouco.</strong> Quem faz duas peças por mês costuma
zerar esta seção por achar injusto cobrar R$ 40 de aluguel em uma peça. Mas
o aluguel é real: ou está no preço, ou está no seu bolso.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};