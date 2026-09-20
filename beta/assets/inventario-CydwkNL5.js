var e=`inventario`,t=`pt-BR`,n={title:`Inventário`,order:2},r=[{depth:1,text:`Inventário`,slug:`user-content-inventário`},{depth:2,text:`Filamentos`,slug:`user-content-filamentos`},{depth:2,text:`Máquinas`,slug:`user-content-máquinas`},{depth:2,text:`Como o inventário entra na estimativa`,slug:`user-content-como-o-inventário-entra-na-estimativa`}],i=`<h1 id="user-content-inventário">Inventário</h1>
<p>A aba <strong>Inventário</strong> cataloga filamentos e máquinas para que a calculadora use
valores reais em vez de estimativas genéricas. Um catálogo bem cuidado é o que
faz a diferença entre um chute e um custo confiável.</p>
<h2 id="user-content-filamentos">Filamentos</h2>
<p>Cada filamento guarda os dados que alimentam a seção <code>material</code>:</p>
<ul>
<li>diâmetro e densidade do material</li>
<li>preço pago e quantidade do rolo</li>
<li>temperatura de extrusão recomendada</li>
</ul>
<h2 id="user-content-máquinas">Máquinas</h2>
<p>Cada máquina descreve o hardware que será amortizado na seção <code>hardware</code>:</p>
<ul>
<li>custo de aquisição da impressora</li>
<li>horas de vida útil estimadas</li>
<li>consumo elétrico em Watts</li>
</ul>
<h2 id="user-content-como-o-inventário-entra-na-estimativa">Como o inventário entra na estimativa</h2>
<p>Ao selecionar um filamento e uma máquina já catalogados, a calculadora
substitui os valores padrão pelos seus:</p>
<pre><code>custo material = (peso da peca + peso das falhas) * preco por grama
custo hardware = (horas de uso / vida util) * preco da maquina
</code></pre>
<p>Manter o inventário atualizado é a forma mais barata de ganhar precisão.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};