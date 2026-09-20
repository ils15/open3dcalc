var e=`ops`,t=`pt-BR`,n={title:`Operacional & Software`,order:17},r=[{depth:1,text:`Operacional & Software`,slug:`user-content-operacional--software`},{depth:2,text:`Por que "invisível" é a palavra certa`,slug:`user-content-por-que-invisível-é-a-palavra-certa`},{depth:2,text:`Bloco: Software e Arquivos`,slug:`user-content-bloco-software-e-arquivos`},{depth:2,text:`Bloco: EPIs / Consumíveis`,slug:`user-content-bloco-epis--consumíveis`},{depth:2,text:`Exemplo numérico passo a passo`,slug:`user-content-exemplo-numérico-passo-a-passo`},{depth:2,text:`Como esta seção se relaciona com as demais`,slug:`user-content-como-esta-seção-se-relaciona-com-as-demais`},{depth:2,text:`Armadilhas práticas`,slug:`user-content-armadilhas-práticas`}],i=`<h1 id="user-content-operacional--software">Operacional &#x26; Software</h1>
<p>A seção <strong>Operacional &#x26; Software</strong> responde a: <em>que custos invisíveis esta peça
carrega?</em> É onde moram as assinaturas de software, o modelo 3D que você
comprou, as luvas e o álcool — coisas que não são filamento nem máquina, e que
quase sempre ficam de fora do orçamento.</p>
<p>Esta seção só aparece no nível <strong>avançado</strong>. Ela tem dois blocos: <strong>Software e
Arquivos</strong> e <strong>EPIs / Consumíveis</strong>.</p>
<h2 id="user-content-por-que-invisível-é-a-palavra-certa">Por que "invisível" é a palavra certa</h2>
<p>Você não vê o slicer na peça. Não vê a luva. Não vê o arquivo STL pago. Mas
cada um deles é uma despesa real que existiu para que esta peça existisse. O
exemplo clássico é o slicer: uma assinatura de R$ 30 por mês parece pouco, mas
se você imprime 100 horas por mês, cada hora carrega R$ 0,30 — e em uma peça de
5,5 horas são R$ 1,65 que ninguém costuma cobrar.</p>
<p>A mesma lógica vale para o modelo. Se você pagou R$ 50 por um arquivo STL e
vende 10 peças dele, cada peça carrega R$ 5 de arquivo. Se você vende 1.000,
carrega R$ 0,05. O custo existe; o que muda é a diluição.</p>
<h2 id="user-content-bloco-software-e-arquivos">Bloco: Software e Arquivos</h2>
<ul>
<li><strong>Mensalidade Slicer</strong> — o custo mensal do software de fatiamento, se você
usa um pago. Deixe em zero se usa um slicer gratuito; mas lembre que a versão
"gratuita" de muitos slicers não é a comercial.</li>
<li><strong>Custo do Arquivo STL</strong> — quanto você pagou pelo arquivo 3D, se comprou de
terceiros. É cobrado <strong>uma vez por peça</strong>, não por hora, então peça única
carrega o valor inteiro.</li>
</ul>
<p>A mensalidade é rateada pelas horas de impressão do mês, usando o <strong>mesmo
campo de horas</strong> da seção <a href="#user-content-custos-da-m%C3%A1quina">máquina</a>:</p>
<pre><code>softwarePorHora = mensalidadeSlicer / horasPorMes

software = (softwarePorHora * tempoImpressaoHoras) + custoArquivoSTL
</code></pre>
<p>O custo do arquivo é somado inteiro, porque cada peça sai dele. Atenção aqui:
quando a quantidade é maior que 1, só a <strong>mão de obra</strong> é diluída entre as
unidades — o arquivo STL continua cobrado por inteiro em cada peça. Veja
<a href="#user-content-m%C3%A3o-de-obra">mão de obra</a> e <a href="#user-content-resultados">resultados</a>.</p>
<h2 id="user-content-bloco-epis--consumíveis">Bloco: EPIs / Consumíveis</h2>
<ul>
<li><strong>Custo EPI por Print</strong> — quanto você gasta em luvas, máscaras, papel
toalha, filtros e isopropílico por impressão. É um valor <strong>fixo por peça</strong>,
não por hora. No FDM o padrão é zero (muita gente não usa EPI); na resina o
padrão é R$ 2,50, porque manusear resina sem luva é um risco real.</li>
<li><strong>Intensidade de Carbono</strong> — gramas de CO₂ por kWh da sua rede elétrica. Não
é um custo em dinheiro: serve para a calculadora mostrar a <strong>pegada de
carbono</strong> da peça. É informativo, não entra no preço.</li>
</ul>
<p>A pegada de carbono é calculada a partir da energia consumida:</p>
<pre><code>energiaKwh = (potenciaW / 1000) * tempoImpressaoHoras

pegadaCarbonoGramas = energiaKwh * intensidadeCarbono
</code></pre>
<h2 id="user-content-exemplo-numérico-passo-a-passo">Exemplo numérico passo a passo</h2>
<p>Nossa peça-exemplo, o suporte de celular de <strong>5,5 horas</strong>. Você paga um slicer
de <strong>R$ 30 por mês</strong>, imprime <strong>100 horas por mês</strong>, comprou o STL por
<strong>R$ 5</strong>, e gasta <strong>R$ 2 por peça</strong> em luva e isopropílico.</p>
<pre><code>softwarePorHora = 30 / 100 = R$ 0,30/h

software = (0,30 * 5,5) + 5 = 1,65 + 5 = R$ 6,65

ppe = R$ 2,00

ops = 6,65 + 2,00 = R$ 8,65
</code></pre>
<p>E a pegada de carbono, com a intensidade padrão de 100 g/kWh e uma impressora
de 250 W:</p>
<pre><code>energiaKwh = (250 / 1000) * 5,5 = 1,375 kWh

pegadaCarbonoGramas = 1,375 * 100 = 137,5 g de CO2
</code></pre>
<p>Para uma peça decorativa, <strong>R$ 8,65</strong> de "invisíveis" é mais da metade do
custo do <a href="#user-content-material">material</a> — que era R$ 16,20 (0,18 kg de PLA
a R$ 90/kg).</p>
<h2 id="user-content-como-esta-seção-se-relaciona-com-as-demais">Como esta seção se relaciona com as demais</h2>
<ul>
<li>As <strong>horas por mês</strong> que rateiam a mensalidade são as horas produtivas da
oficina. Elas não precisam ser iguais às horas de uso da
<a href="#user-content-custos-da-m%C3%A1quina">máquina</a>. A máquina usa as horas da própria
impressora; o rateio usa as horas da oficina inteira. São campos independentes,
então valores diferentes estão corretos.</li>
<li>O <strong>tempo de impressão</strong> que multiplica a taxa vem de
<a href="#user-content-par%C3%A2metros-de-impress%C3%A3o">parâmetros</a>.</li>
<li>Os <strong>insumos do acabamento</strong> (lixa, tinta) moram em
<a href="#user-content-desgaste-de-hardware">desgaste de hardware</a>; aqui ficam os insumos de
segurança e limpeza.</li>
<li>O resultado é somado no bloco "Operacional &#x26; Trabalho" de
<a href="#user-content-resultados">resultados</a>.</li>
</ul>
<h2 id="user-content-armadilhas-práticas">Armadilhas práticas</h2>
<ol>
<li><strong>Slicer gratuito na vida, pago no orçamento.</strong> Se você usa a versão
gratuita de um slicer para vender peças, tecnicamente está usando uma
licença não comercial. O custo de uma licença correta é real e deveria estar
aqui — ou no preço, ou na sua consciência.</li>
<li><strong>Esquecer o STL pago na peça única.</strong> É o erro inverso da diluição: em uma
peça só, o arquivo inteiro entra. Se você vende pouco, o STL é um dos
maiores custos da peça — e justifica cobrar mais caro na primeira venda.</li>
<li><strong>Zerar o EPI na resina.</strong> A resina é tóxica e manuseada com luva. O padrão
de R$ 2,50 por peça existe porque o isopropílico e as luvas acabam. Se você
zera este campo "por generosidade", está subsidiando o cliente.</li>
<li><strong>Achar que a pegada de carbono é um custo.</strong> A intensidade de carbono é
apenas informação (g de CO₂). Ela não aumenta o preço — serve para você
responder a clientes que perguntam, e para se comparar com peças
importadas.</li>
</ol>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};