var e=`orcamentos`,t=`pt-BR`,n={title:`Orçamentos`,order:3},r=[{depth:1,text:`Orçamentos`,slug:`user-content-orçamentos`},{depth:2,text:`Criando um orçamento`,slug:`user-content-criando-um-orçamento`},{depth:2,text:`Clientes`,slug:`user-content-clientes`},{depth:2,text:`Acompanhamento`,slug:`user-content-acompanhamento`},{depth:2,text:`Relação com a calculadora`,slug:`user-content-relação-com-a-calculadora`}],i=`<h1 id="user-content-orçamentos">Orçamentos</h1>
<p>A aba <strong>Orçamentos</strong> transforma uma estimativa em um documento que pode ser
enviado a um cliente, acompanhado do histórico e do cadastro do cliente.</p>
<h2 id="user-content-criando-um-orçamento">Criando um orçamento</h2>
<p>O fluxo básico é:</p>
<ol>
<li>calcule a estimativa na aba <strong>Calculadora</strong></li>
<li>abra <strong>Orçamentos</strong> e inicie um novo orçamento a partir daquela estimativa</li>
<li>confira custos, margem e validade</li>
<li>salve e, no desktop, exporte o PDF</li>
</ol>
<h2 id="user-content-clientes">Clientes</h2>
<p>O cadastro de clientes mantém nome e contato ao lado dos orçamentos, para que o
histórico fique organizado por quem recebeu cada proposta.</p>
<h2 id="user-content-acompanhamento">Acompanhamento</h2>
<p>Cada orçamento registra seu estado, então é possível distinguir rapidamente:</p>
<ul>
<li>propostas ainda não enviadas</li>
<li>propostas aguardando resposta</li>
<li>propostas aprovadas ou recusadas</li>
</ul>
<pre><code>orcamento = estimativa + cliente + validade + estado
</code></pre>
<h2 id="user-content-relação-com-a-calculadora">Relação com a calculadora</h2>
<p>O orçamento é uma fotografia da estimativa no momento em que foi criado: editar
a calculadora depois não reescreve o orçamento já salvo. Isso garante que o
documento enviado ao cliente continue coerente com o que foi combinado.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};