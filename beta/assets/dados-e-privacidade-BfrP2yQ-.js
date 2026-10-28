var e=`dados-e-privacidade`,t=`pt-BR`,n={title:`Dados & Privacidade`,order:25},r=[{depth:1,text:`Dados & Privacidade`,slug:`user-content-dados--privacidade`},{depth:2,text:`O que fica local`,slug:`user-content-o-que-fica-local`},{depth:2,text:`Levar e trazer seus dados`,slug:`user-content-levar-e-trazer-seus-dados`},{depth:2,text:`Importar dados do perfil de teste (Beta)`,slug:`user-content-importar-dados-do-perfil-de-teste-beta`},{depth:2,text:`Modo demo`,slug:`user-content-modo-demo`},{depth:2,text:`Apagar`,slug:`user-content-apagar`}],i=`<h1 id="user-content-dados--privacidade">Dados &#x26; Privacidade</h1>
<p>Tudo o que você cadastra e salva no Open3DCalc vive <strong>no seu dispositivo</strong> —
no perfil do navegador (web) ou no banco local do aplicativo (desktop). Nada é
enviado a servidores. A tela <strong>Privacidade</strong> documenta isso e é também o
painel de controle dos seus dados.</p>
<h2 id="user-content-o-que-fica-local">O que fica local</h2>
<ul>
<li>Cálculos salvos, clientes, orçamentos, produtos, catálogo e estoque ficam em
chaves locais legíveis — sem criptografia adicional do aplicativo. Quem
acessar o seu perfil poderá lê-los; quem não acessar, não vê nada.</li>
<li>Nenhum dado sai do dispositivo: não há login, sincronização em nuvem nem
telemetria.</li>
</ul>
<h2 id="user-content-levar-e-trazer-seus-dados">Levar e trazer seus dados</h2>
<p>Na tela <strong>Privacidade</strong>, a seção <strong>"Levar e trazer seus dados"</strong> exporta um
arquivo JSON <strong>legível</strong> com tudo (histórico, clientes, orçamentos, catálogo,
estoque, produtos, tema) e um <strong>checksum</strong> de integridade. Importar aceita
esse arquivo em dois modos:</p>
<ul>
<li><strong>Mesclar</strong> — soma os registros ao que já existe, preservando os dois;</li>
<li><strong>Substituir</strong> — apaga o atual antes de importar (pede confirmação).</li>
</ul>
<p>Isso é o seu backup: exporte periodicamente e guarde o arquivo.</p>
<h2 id="user-content-importar-dados-do-perfil-de-teste-beta">Importar dados do perfil de teste (Beta)</h2>
<p>Se você usou o canal Beta neste navegador, seus dados de teste (clientes,
orçamentos e histórico) ficaram num perfil separado. A seção <strong>"Importar dados
do perfil de teste"</strong> traz esses registros para o perfil estável com um
clique: prévia por tipo, IDs preservados, duplicatas ignoradas e a fonte de
teste <strong>sempre preservada</strong> — importar não apaga o Beta.</p>
<h2 id="user-content-modo-demo">Modo demo</h2>
<p>O <strong>modo demo</strong> carrega uma oficina de exemplo ("Estúdio Maria Print") por
cima dos seus dados, com um aviso permanente na tela e o selo <strong>[DEMO]</strong> no
título da aba. Ao sair, seus dados reais voltam byte a byte — o demo nunca
escreve neles.</p>
<h2 id="user-content-apagar">Apagar</h2>
<p>A exclusão de dados é por escopo e sempre confirmada: você apaga o que escolheu
(clientes, histórico, tudo) e recebe um relatório do que foi removido.</p>`;export{n as frontmatter,i as html,t as locale,e as slug,r as toc};