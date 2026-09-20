var e=`orcamentos`,t=`pt-BR`,n={title:`Orçamentos`,order:21,tourId:`orcamentos-clientes`},r=[{depth:1,text:`Orçamentos`,slug:`user-content-orçamentos`},{depth:2,text:`Do cálculo ao documento`,slug:`user-content-do-cálculo-ao-documento`},{depth:2,text:`Os itens vêm do Histórico`,slug:`user-content-os-itens-vêm-do-histórico`},{depth:2,text:`O que o orçamento carrega`,slug:`user-content-o-que-o-orçamento-carrega`},{depth:2,text:`Descontos e totais`,slug:`user-content-descontos-e-totais`},{depth:2,text:`Os quatro estados`,slug:`user-content-os-quatro-estados`},{depth:2,text:`O orçamento é uma fotografia`,slug:`user-content-o-orçamento-é-uma-fotografia`},{depth:2,text:`Exportar o PDF`,slug:`user-content-exportar-o-pdf`},{depth:2,text:`Acompanhando a lista`,slug:`user-content-acompanhando-a-lista`},{depth:2,text:`Exemplo de ponta a ponta`,slug:`user-content-exemplo-de-ponta-a-ponta`}],i=`<h1 id="user-content-orçamentos">Orçamentos</h1>
<p>A aba <strong>Orçamentos</strong> transforma uma estimativa em um documento: com número,
cliente, validade e estado. É o que você envia, o que arquiva e o que consulta
depois para saber o que foi combinado com cada cliente.</p>
<p>Cada orçamento é gerado a partir de estimativas que já existem no app — ele
não recalcula nada, só organiza o que a <a href="#user-content-calculadora">Calculadora</a>
já produziu.</p>
<h2 id="user-content-do-cálculo-ao-documento">Do cálculo ao documento</h2>
<p>O fluxo completo:</p>
<ol>
<li>calcule a peça na aba <strong>Calculadora</strong> e salve a estimativa no <strong>Histórico</strong></li>
<li>em <strong>Orçamentos</strong>, abra <strong>Novo Orçamento</strong> e dê um título</li>
<li>adicione itens a partir do Histórico e ajuste quantidades e descontos</li>
<li>escolha o cliente, a validade e as condições de pagamento</li>
<li>salve — o orçamento nasce como <strong>Rascunho</strong>, com um número sequencial próprio</li>
</ol>
<p>O número é automático e contínuo: <code>Orçamento #001</code>, <code>#002</code>, <code>#003</code>. Não há
buraco quando você exclui um — a sequência só anda para frente.</p>
<h2 id="user-content-os-itens-vêm-do-histórico">Os itens vêm do Histórico</h2>
<p>Um orçamento não aceita digitar preço de cabeça. Você adiciona itens
diretamente das estimativas salvas no Histórico, e o <strong>preço unitário</strong> de
cada item é o preço de venda daquela estimativa.</p>
<p>A partir daí, tudo é editável: a quantidade, o preço unitário e um desconto
porcentual só para aquele item. Se a estimativa original dizia R$ 42,70 e você
fechou R$ 45,00, é só ajustar na linha — o orçamento reflete o acordado, não
a estimativa.</p>
<h2 id="user-content-o-que-o-orçamento-carrega">O que o orçamento carrega</h2>
<p>Além dos itens, o formulário guarda:</p>
<ul>
<li><strong>Título</strong>, que identifica o orçamento na lista e na busca</li>
<li><strong>Cliente</strong>, opcional — veja <a href="#user-content-clientes">Clientes</a></li>
<li><strong>Válido até</strong>, a data em que a proposta expira</li>
<li><strong>Condições de pagamento</strong>, do tipo "50% entrada, 50% na entrega"</li>
<li><strong>Previsão de entrega</strong>, em dias ou data combinada</li>
<li><strong>Observações</strong>, um texto livre no rodapé do documento</li>
<li><strong>Desconto global</strong>, uma porcentagem aplicada sobre o subtotal inteiro</li>
</ul>
<h2 id="user-content-descontos-e-totais">Descontos e totais</h2>
<p>Os números do rodapé são calculados automaticamente:</p>
<pre><code>subtotal       = soma de (quantidade * preco unitario) de cada item
desconto       = subtotal * desconto global / 100
total          = subtotal - desconto
</code></pre>
<p>O desconto pode vir de duas formas: por item (na própria linha) ou global
(sobre tudo). Os dois se acumulam, e o app sempre mostra o valor do desconto
em dinheiro, não só a porcentagem — para você sentir o tamanho do abatimento
antes de enviar.</p>
<h2 id="user-content-os-quatro-estados">Os quatro estados</h2>
<p>Cada orçamento tem um estado, visível numa etiqueta colorida e editável direto
no documento:</p>
<ul>
<li><strong>Rascunho</strong> — criado e ainda não enviado. É o estado inicial.</li>
<li><strong>Enviado</strong> — você mandou para o cliente e aguarda resposta.</li>
<li><strong>Aprovado</strong> — o cliente aceitou; é o sinal para produzir.</li>
<li><strong>Recusado</strong> — o cliente não aceitou; serve de registro para renegociar.</li>
</ul>
<p>O estado é um compromisso seu com a realidade, não um aviso automático: o app
não envia e-mail e não sabe se o cliente leu. Quando você muda o estado, está
anotando o que aconteceu.</p>
<h2 id="user-content-o-orçamento-é-uma-fotografia">O orçamento é uma fotografia</h2>
<p>No momento em que você salva, o orçamento congela três coisas: o preço de cada
item, os dados do cliente (nome, empresa, e-mail e telefone) e as condições.
Esse retrato viaja junto com o documento.</p>
<p>Por isso, recalcular a peça na calculadora <strong>não reescreve</strong> o orçamento já
salvo. Se o preço do filamento subir, a estimativa nova sai mais cara, mas o
orçamento que o cliente recebeu continua dizendo o que foi combinado.</p>
<pre><code>orcamento = estimativa + cliente + validade + estado (congelados no salvamento)
</code></pre>
<p>Isso existe de propósito. Sem o snapshot, qualquer ajuste na calculadora
reescreveria documentos já enviados, e o que o cliente tem na mão deixaria de
corresponder ao que você vê no app.</p>
<h2 id="user-content-exportar-o-pdf">Exportar o PDF</h2>
<p>Abra qualquer orçamento e use <strong>Exportar PDF</strong> para gerar o arquivo com
layout pronto para envio, já nomeado como <code>orcamento_001.pdf</code>. A exportação é
bloqueada durante uma sessão demo — o selo ao lado do botão avisa quando é o
caso.</p>
<h2 id="user-content-acompanhando-a-lista">Acompanhando a lista</h2>
<p>A aba lista todos os orçamentos com estado e totais, e a busca filtra por
título ou nome do cliente. Excluir pede confirmação, porque o número daquele
orçamento não vai ser reaproveitado.</p>
<h2 id="user-content-exemplo-de-ponta-a-ponta">Exemplo de ponta a ponta</h2>
<ol>
<li>Você calcula <strong>Suporte para motor N20</strong>: preço de venda sugerido
R$ 42,70. Salva no Histórico.</li>
<li>Calcula também <strong>Caixa para Raspberry</strong>: R$ 68,00. Salva.</li>
<li>Abre <strong>Novo Orçamento</strong>, título "Lote de peças — Centro Modelos".</li>
<li>Adiciona o suporte, quantidade 2: R$ 85,40.</li>
<li>Adiciona a caixa, quantidade 1: R$ 68,00.</li>
<li>Subtotal: <strong>R$ 153,40</strong>. Aplica desconto global de 5%: R$ 7,67.</li>
<li>Total: <strong>R$ 145,73</strong>, válido por 30 dias, pagamento em duas vezes.</li>
<li>Salva. Vira <code>Orçamento #001</code> como Rascunho.</li>
<li>Manda para o cliente e muda o estado para <strong>Enviado</strong>.</li>
<li>Cliente aceita: estado <strong>Aprovado</strong>. É só produzir.</li>
</ol>
<p>Seis meses depois, o orçamento #001 ainda mostra R$ 145,73 — mesmo que você
tenha recalculado a peça dezenas de vezes desde então.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};