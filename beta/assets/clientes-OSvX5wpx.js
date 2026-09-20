var e=`clientes`,t=`pt-BR`,n={title:`Clientes`,order:22},r=[{depth:1,text:`Clientes`,slug:`user-content-clientes`},{depth:2,text:`O cadastro`,slug:`user-content-o-cadastro`},{depth:2,text:`Por que manter aqui`,slug:`user-content-por-que-manter-aqui`},{depth:2,text:`Vinculando a um orçamento`,slug:`user-content-vinculando-a-um-orçamento`},{depth:2,text:`Acompanhando o histórico`,slug:`user-content-acompanhando-o-histórico`},{depth:2,text:`Importar e exportar`,slug:`user-content-importar-e-exportar`},{depth:2,text:`Exemplo: o que o histórico revela`,slug:`user-content-exemplo-o-que-o-histórico-revela`}],i=`<h1 id="user-content-clientes">Clientes</h1>
<p>A aba <strong>Clientes</strong> é o cadastro de quem recebe suas propostas. Nome, contato
e observações — pouco mais que isso, mas no lugar certo.</p>
<p>Sem ela, o histórico de orçamentos vira uma pilha de números sem dono. Com
ela, você sabe quantas propostas mandou para cada cliente, o que cada uma
valia e qual foi a resposta.</p>
<h2 id="user-content-o-cadastro">O cadastro</h2>
<p>Cada cliente tem:</p>
<ul>
<li><strong>Nome</strong> — obrigatório, é o que aparece na lista e no orçamento</li>
<li><strong>Empresa</strong> — opcional, útil quando a pessoa compra para um CNPJ</li>
<li><strong>Email</strong> — opcional, mas validado: <code>joao@empresa</code> é recusado, é preciso um
domínio completo, como <code>joao@empresa.com</code></li>
<li><strong>Telefone</strong></li>
<li><strong>Endereço</strong></li>
<li><strong>Observações</strong> — o que ajudar: preferências, kombinações, quem indicou</li>
</ul>
<p>O email é o único campo com validação. Os demais você preenche como quiser —
um cliente pode ter só o nome e o WhatsApp.</p>
<h2 id="user-content-por-que-manter-aqui">Por que manter aqui</h2>
<p>O orçamento é um documento, e documento precisa de destinatário. Quando o
cliente está cadastrado, você o escolhe num seletor em vez de digitar; quando
não está, o orçamento segue sem cliente — e some no meio da lista.</p>
<p>O cadastro também conta histórico. Cada cliente mostra <strong>quantos orçamentos</strong>
já recebeu, e a busca filtra por nome, empresa ou email. Em um minuto você
responde "quanto já propus para a Centro Modelos este ano?" sem abrir
planilha nenhuma.</p>
<h2 id="user-content-vinculando-a-um-orçamento">Vinculando a um orçamento</h2>
<p>O fluxo é simples:</p>
<ol>
<li>cadastre o cliente aqui, com nome e pelo menos um contato</li>
<li>em <a href="#user-content-or%C3%A7amentos">Orçamentos</a>, abra o orçamento e escolha o
cliente no seletor</li>
<li>salve — o orçamento grava o vínculo e uma <strong>cópia</strong> dos dados de contato</li>
<li>o contador de orçamentos do cliente sobe sozinho</li>
</ol>
<p>A cópia é proposital: se você corrigir o email do cliente amanhã, os
orçamentos antigos mantêm o contato que estava valendo quando foram enviados.
O vínculo (id) continua apontando para o cadastro atual; o que congela é o
texto do documento.</p>
<h2 id="user-content-acompanhando-o-histórico">Acompanhando o histórico</h2>
<p>A lista mostra cada cliente com seu contador de orçamentos, e a busca aceita
nome, empresa ou email. Editar e excluir estão ali mesmo — excluir pede
confirmação, porque os orçamentos já vinculados continuam existindo, só
perdem o vínculo.</p>
<h2 id="user-content-importar-e-exportar">Importar e exportar</h2>
<p>O cadastro inteiro pode ser exportado como JSON para backup, e importado de
volta em outra máquina. A exportação é bloqueada na sessão demo, como nas
outras abas — o selo avisa quando é o caso.</p>
<h2 id="user-content-exemplo-o-que-o-histórico-revela">Exemplo: o que o histórico revela</h2>
<p>Você cadastra a <strong>Centro Modelos</strong> (empresa) com a Joana como contato. Nos
dois meses seguintes gera quatro orçamentos vinculados a ela:</p>
<ul>
<li><code>#001</code> Lote de peças — <strong>R$ 145,73</strong> — Aprovado</li>
<li><code>#004</code> Caixas de proteção — <strong>R$ 320,00</strong> — Aprovado</li>
<li><code>#007</code> Suporte em lote — <strong>R$ 89,00</strong> — Enviado</li>
<li><code>#009</code> Peça única — <strong>R$ 58,00</strong> — Recusado</li>
</ul>
<p>Na aba Clientes, o contador da Centro Modelos mostra <strong>4</strong>. Somando os dois
aprovados, são <strong>R$ 465,73</strong> em pedidos confirmados com um único cliente —
informação que muda como você atende o próximo orçamento dela: cliente que
compra duas vezes merece resposta rápida e condição melhor que a de estranho.</p>
<p>É também o aviso mais barato do mundo: dos <strong>R$ 612,73</strong> propostos,
<strong>R$ 58,00</strong> voltaram como recusados e <strong>R$ 89,00</strong> ainda aguardam resposta.
Olhar por cliente mostra onde o preço está sendo recusado — antes que vire
hábito.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};