# Plano de UX, integração e Dashboard

Data: 10/10/2026. Base auditada: `main`, `aa17103ff892`, versão local `2.0.0-beta.15`.

Status: proposta de execução, não implementação concluída. Elaborado a pedido da pessoa usuária com duas auditorias independentes de subagentes GPT-6.1 Sol: navegação/integração e Dashboard/dados. As auditorias foram somente leitura. As fontes externas abaixo foram pesquisadas na internet; as observações sobre o produto vêm do código local, não de uma nova validação da publicação.

## Resultado pretendido

Manter o que já funciona, reduzir telas e controles redundantes e completar o percurso **calcular → escolher recursos → salvar → reprecificar → orçar**. O Dashboard deve ajudar a decidir usando dados verificáveis, não apenas acrescentar cartões.

Recomendação: três grupos de tarefas — **Calcular, Oficina e Vender** — com acesso direto ao Dashboard e aos destinos frequentes. São grupos de navegação, não três telas gigantes. Não trocar o motor de cálculo, os stores ou a biblioteca visual para conseguir isso.

A primeira entrega de produto deve proteger os dados reais e preservar a migração da V1. Depois vêm a correção dos números, navegação, seletores, fluxos de retorno e composição visual. Novos modelos comerciais ficam em uma fatia posterior; frota operacional e IA permanecem fora do escopo vigente.

## Diretriz de produto: dados reais, criptografados e migráveis

Diretriz confirmada pela pessoa usuária em 10/10/2026: a V2 precisa aceitar os dados reais da oficina, criptografá-los localmente e manter um caminho claro para migrar os dados da V1. “Apenas dados sintéticos” não é o objetivo do produto.

A `beta.15` publicada continua sendo um registro do canal atual test-only; não a estou descrevendo como já alterada. Para o próximo candidato V2, a restrição test-only deixa de ser critério de produto. Antes de convidar alguém a salvar dados reais, Web e Desktop precisam ter armazenamento protegido, desbloqueio seguro, exportação/apagamento compatíveis e migração verificável. A demonstração sintética segue disponível apenas como sessão isolada, sem misturar seeds com o cadastro nem apagar/escrever por cima de dados reais.

Isso revoga, para o escopo futuro decidido aqui, a diretriz anterior de impedir que Beta leia/migre os dados V1 conhecidos ou grave conteúdo real. Não torna a implementação atual segura para isso: `beta.15` ainda tem namespace Beta em texto claro, sem migração nem exportação. SPEC-01, ADR-001/002, SPEC-02/03/04, README/matriz de privacidade, contrato de armazenamento e texto de primeira execução precisam ser revisados em uma etapa explícita antes dessa mudança de comportamento. O histórico do PR #279 continua descrevendo o que foi entregue naquele build, não o destino aprovado agora.

Requisitos do destino:

- Criptografar localmente cada valor pessoal ou conteúdo de oficina que a classificação de dados definir como sensível; nenhum caminho Stable, Beta, web ou Electron pode fazer fallback para gravação em texto claro. Preferências de interface só ficam fora da criptografia se SPEC-01 confirmar que não contêm conteúdo do usuário.
- Reavaliar e especificar a capacidade criptográfica já documentada em ADR-001, o envelope autenticado existente e as versões de exportação SPEC-03. Reutilizar formatos/parâmetros comprovados quando compatíveis; não criar um algoritmo paralelo. Web usa Web Crypto em contexto seguro e segredo mantido apenas em memória. Desktop usa keyring/`safeStorage` somente depois do gate real de segurança, com alternativa protegida por senha. Se não houver criptografia disponível, não persistir conteúdo sensível; explicar como o usuário pode recuperar o acesso.
- Manter cofre bloqueável/desbloqueável, memória desbloqueada sob controle do usuário, ausência de credencial em logs/arquivos e aviso honesto: se a senha e a cópia de recuperação forem perdidas, o app local não pode reconstruir o segredo.
- Dar meios de recuperar e retirar dados: exportação/cópia de segurança criptografada no formato compatível, importação validada e exclusão do conteúdo local administrado. Nenhuma sincronização em nuvem é necessária para esta entrega.
- Preservar abertura de um arquivo V1 mesmo após a atualização: identificar fontes de armazenamento V1 suportadas, apresentar a migração de forma visível e consentida, manter origem intacta até verificar que os dados migrados estão criptografados e reabrem, e nunca apagar/resetar silenciosamente. Após a verificação, remoção da cópia antiga ocorre como passo explícito e verificável, sem deixar texto claro abandonado.
- Continuar permitindo cálculo não sensível enquanto cofre está fechado, quando tecnicamente possível. Se ainda não houver migração ou desbloqueio, manter a origem intacta e oferecer continuar depois; não mostrar listas vazias como se a oficina tivesse sido apagada.

Escopo conhecido para a migração: fixtures da Stable Web v1.14 e perfis Desktop v1.14, incluindo configurações/cálculos, histórico e snapshots, orçamentos, clientes, produtos, catálogo/perfis, materiais e estoque, respeitando o conjunto de dados realmente presente por plataforma. A migração também protege conteúdo real salvo pelas versões 2.x antes do cofre ser reativado: fontes Stable em texto claro e, mediante escolha explícita, registros que o build Beta guardou nas três chaves de teste. A Beta não valida se o conteúdo é sintético; não presumir que esteja descartável. No Desktop, considerar chaves antigas na tabela `storage`, registros nas tabelas de domínio, o namespace `open3dcalc_pwless_*` e quaisquer stores confirmados pela auditoria. Resolver duplicatas sem duplicar entradas. Usar identificadores/versões de origem, não varredura ampla por prefixo.

O namespace Beta atual e os registros Stable/V1 compartilham a origem do navegador em algumas implantações: acesso a cada origem só acontece depois de a pessoa escolher **“Migrar meus dados locais”**, desbloquear o cofre e ver uma prévia. Usar a lista exata de formatos/chaves aprovados e copiar para o cofre; nunca abrir, converter ou substituir dados em segundo plano. Se conteúdo real e seed de demonstração estiverem misturados no mesmo registro, preservá-lo como dado do usuário e pedir confirmação; não classificá-lo pelo nome.

O fluxo V1→V2 não promete recuperar automaticamente cada sobra de um cofre V2 histórico desativado. Inventariar, em fixtures sintéticas, as versões cifradas e referências a `open3dcalc_pii_vault`; se houver formato ainda necessário para dados que pessoas usuárias salvaram, incluir um leitor de compatibilidade verificado ou reportar com clareza quais dados exigem recuperação separada. Não limpar esse cofre como efeito colateral da migração V1.

## 1. Diagnóstico: o que é duplicação e o que são entidades diferentes

| Evidência na aplicação                                                                                                                                           | Problema                                                                            | Tratamento proposto                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A web monta `StudioLayout`; o desktop monta a shell compartilhada. `StudioSidebar` declara dez destinos na Beta, enquanto o contrato compartilhado aprova cinco. | Duas fontes de navegação, visibilidade e destino ativo.                             | Um registro de destinos e as façades de navegação existentes; apresentações adaptadas à plataforma.    |
| Cadastros contém impressoras, materiais e taxas; Marketplace consulta os mesmos arrays de impressoras/materiais.                                                 | Gestão e biblioteca aparecem como módulos diferentes, com um nome que sugere venda. | Biblioteca dentro de Oficina; canais/taxas dentro de Vender. Manter entradas antigas compatíveis.      |
| Cabeçalho de Cadastros diz “Frota de Impressoras”, mas a página administra também materiais e canais.                                                            | O título não descreve o conteúdo.                                                   | Uma única definição de título, breadcrumb e descrição por destino/seção.                               |
| Impressoras já oferece Minhas impressoras/Biblioteca de modelos.                                                                                                 | Uma capacidade existente fica difícil de descobrir; não falta uma terceira lista.   | Reaproveitar o gestor atual e expor criação/uso de perfis pessoais no contexto do cálculo.             |
| Catálogo de materiais e carretéis físicos possuem contratos diferentes.                                                                                          | Parecem cadastros repetidos, mas têm funções distintas.                             | Agrupar a experiência sem fundir definição, preço de referência e saldo físico.                        |
| `filamentInventory.ts` reexporta `spoolStore`, dono de `open3dcalc_filaments`.                                                                                   | Há visões distintas, não dois estoques a migrar.                                    | Um gestor/uma política de estoque; preservar o alias de compatibilidade.                               |
| Escolher material em Classic/Bento altera o nome/tipo, sem aplicar necessariamente preço/densidade do catálogo.                                                  | A seleção aparenta aplicar um perfil completo.                                      | Comando compartilhado de aplicar perfil, com origem dos defaults e overrides explícitos.               |
| `StudioSpoolView` aplica nome/preço, mas não estabelece `selectedSpoolId`; resina recebe `costPerKg` em `costPerLiter`.                                          | Vínculo incompleto e ambiguidade de unidade.                                        | Corrigir vínculo e contrato de preço/unidade antes de anunciar integração completa com estoque.        |
| Calculadora já registra produto; `Product` não guarda receita completa e a lista não oferece retorno ao cálculo.                                                 | Percurso de ida sem volta.                                                          | Reprecificação parcial honesta para legados; receita/snapshot versionado opcional para novos produtos. |
| Histórico já permite carregar snapshot.                                                                                                                          | Reabrir cálculos funciona, mas não está bem conectado aos outros fluxos.            | Reutilizar essa ação em busca contextual, Dashboard e produtos vinculados, sem duplicar restauração.   |
| Dashboard web tem filtros e workspaces que só mudam o estilo.                                                                                                    | Controles parecem funcionais, mas o conteúdo não responde.                          | Filtrar um único conjunto de registros e montar conteúdo distinto por workspace.                       |
| Dashboard/Mini-Dash mantêm constantes fora do demo.                                                                                                              | Números de frota, estoque, metas e projeções parecem reais.                         | Remover ou substituir por métricas com fonte e fórmula; demo deve usar o dataset existente.            |

Arquivos de referência:

- [Shell web](../../src/platform/web/components/studio/StudioLayout.tsx), [sidebar](../../src/platform/web/components/studio/StudioSidebar.tsx), [contrato de abas](../../src/shared/components/AppShell/tabs.tsx), [preferências de navegação](../../src/shared/lib/navigationPrefs.ts).
- [Cadastros](../../src/shared/components/Catalog/CatalogTab.tsx), [biblioteca hoje chamada Marketplace](../../src/shared/components/Catalog/MarketplaceBrowseTab.tsx), [estoque web](../../src/platform/web/components/studio/StudioSpoolView.tsx), [store de estoque](../../src/shared/stores/spoolStore.ts), [bridge atual](../../src/shared/stores/storeBridge.ts).
- [Ação de registrar produto](../../src/shared/components/Results/ProductActionsCard.tsx), [tipo de produto](../../src/shared/types/product.ts), [lista de produtos](../../src/platform/web/components/studio/StudioProductsView.tsx), [histórico web](../../src/platform/web/components/studio/StudioHistoryView.tsx).
- [Dashboard web ativo](../../src/platform/web/components/studio/StudioDashboardView.tsx), [Mini-Dash](../../src/platform/web/components/studio/StudioMiniDashOverlay.tsx), [agregadores existentes](../../src/shared/hooks/useHistoryAggregates.ts), [rentabilidade compartilhada](../../src/shared/components/Dashboard/ProfitAnalyticsModule.tsx), [heatmap existente](../../src/shared/components/Dashboard/MaterialEfficiencyHeatmap.tsx).

Não remover arquivos apenas porque parecem antigos. `StudioPrinterView` não é montado pela shell de produção encontrada; seus presets locais não provam uma frota integrada. Há tipos/utilitários operacionais em `src/types.ts` e `src/utils/maintenanceManager.ts`, mas sem consumidor de produção encontrado e sem contrato shared equivalente. Também não planejar remoção de `historyStore.getTopPrinters/getTopMaterials`: esses métodos citados historicamente no roadmap não existem no store atual.

## 2. Referências pesquisadas e o que aproveitar

| Referência primária                                                                                                                            | Padrão observado                                                                                            | Adaptação ao Open3DCalc                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Calculadora Prusa](https://blog.prusa3d.com/3d-printing-price-calculator_38905/)                                                              | Tempo/peso ou G-code, defaults editáveis, custos opcionais e resumo.                                        | Revelação progressiva: começar com o necessário, mantendo acesso aos detalhes no mesmo fluxo.                                      |
| [Custos SimplyPrint](https://help.simplyprint.io/en/article/all-about-the-print-cost-calculations-feature-19ck72x/)                            | Defaults gerais com overrides por impressora; custo histórico preservado após mudar configurações.          | Distinguir perfil, cenário atual e fato salvo. Aplicar cadastro não deve reescrever orçamento antigo.                              |
| [Materiais Printago](https://docs.printago.io/docs/printing/materials)                                                                         | Definições/variantes separadas de estoque/carretéis; busca e criação contextual; preço ausente explicitado. | Oficina unificada com entidades distintas e seletores pesquisáveis. O recurso de inventário descrito pelo fornecedor está em Beta. |
| [Biblioteca de peças Printago](https://docs.printago.io/docs/parts/part-management)                                                            | Peças reutilizáveis vinculadas a produtos/SKUs.                                                             | Recuperar a ideia de receita reutilizável e ação contextual de carregar no cálculo; não importar fila ou automação.                |
| [Statistics SimplyPrint](https://simplyprint.io/features/statistics)                                                                           | Filtro comanda cartões/gráficos; detalhamento por impressora/material; números derivam de jobs registrados. | Um conjunto filtrado por relatório e acesso aos registros de origem. Não copiar sucesso/ocupação sem domínio de execução.          |
| [Gestão de filamento SimplyPrint](https://simplyprint.io/features/filament-management), [Spoolman oficial](https://github.com/Donkie/Spoolman) | Carretel físico identificado com material, peso e custo.                                                    | Uma visão de saldo e um cadastro de referência, ligados por ações, sem implantar serviços externos.                                |
| [Combobox WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)                                                                        | Nome acessível, busca/seleção e interação por teclado.                                                      | Seletores longos com busca; seleção explícita, Escape e retorno de foco previsíveis.                                               |
| [Estados vazios Carbon](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states)                                         | Primeiro uso, ausência de resultado e indisponibilidade têm mensagens/ações distintas.                      | Não preencher painéis vazios com números fictícios nem tratar ausência de alertas como erro.                                       |

Síntese própria: organizar por tarefas e conectar dados tem mais valor que aumentar o número de menus ou cartões. As fontes não demonstram que três grupos sejam um padrão universal, nem autorizam copiar a arquitetura cloud desses produtos. Nenhuma integração com eles faz parte deste plano.

## 3. Navegação recomendada

| Grupo/acesso             | Destinos                                                      | Ações principais                                                            |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Dashboard, acesso direto | Visão geral e quatro workspaces                               | Retomar cálculo; abrir registros; investigar margem/estoque.                |
| Calcular                 | Calculadora, Histórico; Infill em Ferramentas                 | Novo cálculo; carregar cenário; selecionar recursos da Oficina.             |
| Oficina                  | Minhas impressoras e Biblioteca; Materiais; Estoque/carretéis | Adicionar perfil; usar no cálculo; cadastrar carretel a partir de material. |
| Vender                   | Produtos, Orçamentos, Clientes, Canais e taxas                | Reprecificar; criar orçamento; escolher perfil de taxas.                    |
| Apoio                    | Aparência, visibilidade, privacidade e recursos de ajuda      | Controles globais conforme a política do canal.                             |

“Cadastros” deixa de ser um destino genérico. “Marketplace” deixa de nomear uma biblioteca de máquinas/filamentos; marketplace passa a ser um tipo de canal de venda. Não excluir cadastros, dados ou funções ao mudar seus rótulos.

O contrato aprovado em 7o.2 continua sendo cinco destinos primários. Três grupos são uma proposta de apresentação a formalizar na fatia A2; não marcar aquele critério como cumprido por trocar a sidebar. Caminho conservador: unificar primeiro os cinco destinos e usar os três grupos como organização secundária, sem mudar IDs ou preferências. A decisão deve constar explicitamente no PR de navegação, com reconciliação do roadmap e dos testes de paridade.

Manter Calculadora sempre acessível. O próximo destino V2 persiste navegação e preferências no contrato de cada canal, sem misturá-las ao cofre de conteúdo da oficina. Dashboard tem atalho direto, mas não passa automaticamente a ser a página inicial. Ocultar um atalho não deve quebrar uma ação contextual que abre seu destino.

Evitar navegação empilhada: sidebar global, navegação local apenas quando houver seções reais e cabeçalho único. Não repetir título/breadcrumb em três cartões. Preservar o modo foco e controles existentes, com uma entrada de configuração clara.

## 4. Donos dos dados e fluxo sem perda

| Conceito                      | Dono atual/direção                                                          | Não confundir com                                      |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| Cálculo editável              | `calculatorStore` e motor existentes                                        | Histórico imutável ou venda realizada.                 |
| Perfil de impressora/material | `catalogStore` e biblioteca existente                                       | Máquina física operando ou carretel possuído.          |
| Estoque de matéria-prima      | `spoolStore`; um ID por item físico                                         | Material de referência ou consumo já ocorrido.         |
| Cálculo salvo                 | `historyStore`, resultado/snapshot capturado                                | Pedido produzido, faturamento ou recebimento.          |
| Produto                       | `useProductInventory` em `productInventory.ts`, com extensão aditiva futura | Oferta em um canal ou receita completa de legado.      |
| Orçamento/cliente             | `quoteStore`/`customerStore`                                                | Pagamento ou status de produção.                       |
| Perfil de taxa                | `Marketplace` existente                                                     | Loja concreta; separar canal/oferta nas Phases 4/5/7k. |

Fluxo proposto:

1. Na calculadora, “Carregar” oferece históricos restauráveis e produtos, distinguindo receita completa de dados parciais. Exemplos usam cenários identificados, não o estoque real.
2. Selecionar impressora, material, carretel e taxas por comandos compartilhados entre Classic, Bento e Guided. Se um vínculo faltar, abrir o gestor específico com contexto e retornar ao mesmo rascunho.
3. Exibir a origem de cada default: perfil, custo do carretel ou valor manual. Reaplicar um perfil é ação explícita; editar o cadastro não deve modificar silenciosamente o cenário aberto.
4. Salvar cálculo e registrar produto são ações distintas. Para novos produtos, permitir vínculo/receita versionada segundo o contrato de snapshot aprovado; legado abre uma prévia dos campos recuperáveis antes de aplicar. Definir um dono do snapshot, evitando cópias editáveis divergentes; um vínculo deve tratar exclusão/ausência do histórico de origem sem anunciar restauração completa inexistente.
5. “Reprecificar” cria/abre um cenário editável; não marca produto como vendido, não consome estoque e não sobrescreve preço histórico. Mudança comercial posterior gera revisão ou novo orçamento.
6. Criar orçamento reutiliza a ligação existente entre item de orçamento e cálculo salvo. Cliente viaja pelo orçamento; não adicionar outro vínculo contraditório ao histórico.

`Example/` ajuda com carregar cenário/histórico e navegação contextual. O seletor de presets observado é de exemplos pré-definidos; não comprova que um roundtrip de produtos completo já existia. Não portar seus tipos ou fórmulas de lote para suprir campos ausentes.

## 5. Seletores, campos e todos os modos da calculadora

- Três níveis com diferenças visíveis e documentadas: Rápido apresenta essenciais; Detalhado apresenta custos/premissas adicionais; Completo expõe o conjunto suportado. Montar uma matriz de campos por tecnologia × nível × superfície, com ação de acesso aos detalhes ocultos.
- Nível de detalhe, apresentação Classic/Bento/Guided, densidade Simple/Studio Pro e Focus Mode são eixos diferentes. Não criar um quarto sinônimo de “Pro” nem sincronizá-los implicitamente. Trocar apresentação/visibilidade não altera entradas ou resultados; qualquer comportamento de cálculo ligado ao nível precisa ser documentado/testado, não reescrito durante o port.
- Comparar a matriz com a estável v1.14.0, usando source/tag e tarefas verificáveis. Classificar cada diferença como função disponível em outro local, regressão a restaurar ou recurso deliberadamente adiado. Não prometer paridade por contagem de controles.
- Usar select nativo estilizado para listas curtas; combobox com busca para impressoras, materiais, carretéis e históricos. Agrupar “Meus”/“Biblioteca”, mostrar custo e unidade relevantes e oferecer ação “Adicionar” sem perder o rascunho.
- Valores numéricos: label permanente, unidade fora da área editável, alinhamento estável, foco evidente e validação próxima. Preservar estados de digitação vazios/parciais e aceitar decimal localizado; não transformar vazio em zero ou `1,` em outro número enquanto se digita.
- Respeitar teclado/IME, leitores de tela e alvos de toque de pelo menos 44px. Menu aberto deve caber na viewport, rolar internamente quando necessário e fechar sem resetar a escolha ao cancelar.
- Um resumo de resultado e um conjunto de ações, sem preços/margens repetidos em vários cartões. Detalhes ficam em expansão/abas; não remover relatórios ou funções existentes permitidas pelo canal.
- Aproveitar largura disponível com colunas proporcionais, sem comprimir o formulário em telas grandes nem esticar todos os inputs indefinidamente. Resultado lateral de largura limitada; mobile em coluna única, ações acessíveis e nenhum overlay cobrindo campos/foco.

## 6. Dashboard: primeiro dados confiáveis, depois completude visual

### 6.1 Correções obrigatórias

O Dashboard web atual calcula margem como lucro/custo, mistura FDM e resina por fallback `||`, soma volume como massa e transforma histórico vazio em material rastreado. Há distribuição 70/30, frota, meta e projeções fixas fora do modo demo. O Mini-Dash também mantém números/alertas constantes.

Eliminar essas fontes paralelas. Normal e demo devem usar os mesmos seletores; o dataset demonstrativo existente deve alimentar a UI, com identificação de sessão e sem sobrescrever dados previamente persistidos. Filtro de período precisa atualizar todos os indicadores históricos, gráficos e listas. Até workspaces/projeções terem conteúdo funcional, não apresentar botões ativos sem efeito.

Efemeridade do demo é requisito a comprovar, não garantia da Beta atual. Por inspeção, `demoModeStore` ativa supressão de persistência, mas o adapter `betaPlaintextPersistStorage` escreve sem consultar esse bloqueio. Há risco de os seeds chegarem às chaves Beta; ainda não foi reproduzido em runtime nesta auditoria. Antes de integrar o demo, testar entrar/editar/sair/recarregar com bytes pré-existentes nas três chaves: o conteúdo persistido deve permanecer idêntico. Se reproduzido, corrigir o adapter em PR dedicado antes da entrega que depender disso.

### 6.2 Dicionário mínimo de indicadores

Seja `E` o conjunto de cálculos filtrado por `HistoryEntry.timestamp`, tecnologia e demais filtros aplicáveis. Os agregadores atuais somam valores unitários armazenados, **sem multiplicar por `snapshot.quantity`**; alterar isso exige uma decisão/modelo próprio, não uma revisão visual.

| Indicador                         | Fonte/fórmula                                                                                            | Significado e limite                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Cálculos salvos                   | `E.length`                                                                                               | Não chamar pedidos concluídos ou peças produzidas.                                     |
| Valor dos cálculos                | `sum(E.sellPrice)`                                                                                       | Estimativa registrada; não faturamento realizado.                                      |
| Custo/lucro estimados             | `sum(E.totalCost)` / `sum(E.profit)`                                                                     | Usar resultados capturados, sem recalcular cadastros atuais.                           |
| Margem ponderada                  | `100 × sum(profit) / sum(sellPrice)`                                                                     | Receita positiva; não confundir com markup `profit/cost` ou média de margens.          |
| Valor médio por cálculo           | `sum(sellPrice) / E.length`                                                                              | Não ticket médio de venda realizada.                                                   |
| Horas de impressão estimadas      | `sum(result.estimatedPrintTime)`                                                                         | Campo já em horas; não é execução medida.                                              |
| Horas faturáveis estimadas        | `sum(totalHoursForProfit ?? estimatedPrintTime)`                                                         | Inclui preparação/pós; separar de horas de máquina.                                    |
| Lucro estimado/h                  | `sum(V.profit) / sum(V.horasFaturáveis)`, com `V` = registros com lucro finito e horas finitas positivas | Numerador/denominador usam o mesmo subconjunto; indicar excluídos/cobertura.           |
| Massa estimada                    | `sum(result.unitWeight)`                                                                                 | Unidade g, não `resin.volumeUsedMl`; manter volumes separados quando necessários.      |
| Rentabilidade por material/modelo | `byMaterial(E)` / `byPrinter(E, t)`                                                                      | Modelos usados em cenários, não ativos operacionais.                                   |
| Histórico mensal/trimestral       | `byMonth(E, locale)` / `byQuarter(E)`, com janela adequada ao filtro                                     | Série histórica; trimestre atual identificado como parcial.                            |
| Variação histórica QoQ            | `100 × (atual − anterior) / anterior`                                                                    | Período anterior positivo e comparável; não projeção garantida.                        |
| Carteira de orçamentos            | Contagem por `Quote.status`; soma de `Quote.total` por status                                            | Valor aprovado não é valor recebido ou backlog de produção.                            |
| Saldo/valor de estoque FDM        | `weightGrams`, status `in_stock`; peso/1000 × `costPerKg`                                                | Posição atual registrada; não estoque histórico no período.                            |
| Baixo estoque                     | `isLowStockSpool` + política explícita                                                                   | Reconciliar 150g na web e 100g no shared; mostrar o limiar, não mudar silenciosamente. |

Regras de relatório:

- Sem registros, sem resultados no filtro e sem informação para determinada métrica são estados diferentes. Zero válido continua zero; denominador inválido e dado ausente aparecem como indisponíveis, nunca como crescimento/produção inventados.
- Adaptar componentes existentes que usam fallback zero em razões para distinguir “indisponível” quando necessário; não presumir que o reaproveitamento já resolve toda semântica. Buckets de calendário com `count=0` devem comunicar ausência de registros.
- Os agregadores atuais de rentabilidade somam lucro de entradas cujas horas podem virar zero. Corrigir/adaptar a razão lucro/h para o subconjunto `V`, preservando os totais financeiros globais e mostrando cobertura; não dividir lucro de todas as entradas pelas horas de apenas parte delas.
- Ordenar/agrupar datas cronologicamente; adicionar `byDay` puro se necessário. Preservar centavos até a apresentação; renderizar as séries anunciadas na legenda.
- `byMonth` hoje ancora a janela nos últimos seis meses a partir de hoje. Adaptar janela/âncora ao filtro, com data de referência injetável para testes, ou rotular explicitamente uma janela limitada distinta. “Tudo” ou um período antigo não pode aparentar ausência de dados com KPIs positivos. QoQ só compara períodos históricos completos/comparáveis, sem usar filtro truncado como crescimento real.
- Modelos/materiais ausentes permanecem identificados como desconhecidos e entram na cobertura. Não atribuir ao primeiro preset nem excluir seus valores financeiros do total global.
- Estoque é uma posição atual; não fingir que o filtro histórico o transforma em saldo de um mês passado. Orçamentos usam `createdAt` com rótulo “criados no período”; `updatedAt` não é data de aprovação/pagamento.
- Cliente vem de `Quote.customerId/customerSnapshot` e seus itens. Para a primeira entrega, agrupar **valor de orçamentos por cliente**, contando cada orçamento uma vez. Evitar duplicar receita de um cálculo reutilizado em vários orçamentos.
- `HistoryEntry`/`CalculationSnapshot` atuais não registram moeda histórica. Manter e explicar a convenção existente; não inferir conversões ou consolidar operações multimoeda como contabilidade. Moeda capturada/versionada pertence ao contrato comercial posterior de 7l.
- Estoque de resina exige reconciliação de custo por kg versus por litro antes de valorar saldo ou aplicar preço ao cálculo. Não resolver apenas trocando o sufixo; não converter g/ml sem densidade e origem verificáveis.
- Exportações/cópias de segurança/importações de dados reais devem usar o conjunto exibido e o envelope cifrado validado nos três canais. A demo sintética não entra nesses arquivos.

### 6.3 Quatro workspaces reais, sem inventar operação

| Workspace aprovado em 7o.8 | Conteúdo possível agora                                                             | Não apresentar como real                                                   |
| -------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Visão geral/Finanças       | KPIs estimados, série temporal, cálculos recentes, carteira e alertas com fonte     | Faturamento recebido, projeção anual automática, meta fixa.                |
| Rentabilidade/Precificação | `ProfitAnalyticsModule`, heatmap por material/peso, lucro/h, composição e cobertura | Recomendações de IA ou ranking baseado em produtos sem vendas registradas. |
| Operação/Qualidade         | Posição de estoque, alertas coerentes, registros incompletos e atalhos de cadastro  | Impressoras imprimindo, sucesso/falha, fila, manutenção ou ocupação.       |
| Engenharia/Fatiamento      | Resumos/atalhos das ferramentas e parâmetros efetivamente disponíveis               | Novo otimizador de slicer, telemetria ou estimativa não implementada.      |

Esqueleto visual de referência, não mockup final:

```text
Dashboard                  [período] [tecnologia] [filtros]
Visão geral | Rentabilidade | Operação | Engenharia

[indicador] [indicador] [indicador] [indicador]
[série temporal / análise principal] [alertas acionáveis]
[registros recentes com “abrir”]      [carteira / estoque]
```

Um destaque principal por workspace, métricas relacionadas agrupadas e detalhes sob demanda. No mobile, reorganizar cartões sem rolagem horizontal. Montar apenas o workspace ativo, com fronteira lazy real para gráficos; o nome `RechartsLazy` sozinho não prova carregamento sob demanda.

Mini-Dash: poucas métricas verificadas e ações de retomar/abrir Dashboard, usando a mesma camada de dados. Não repetir todos os KPIs nem permanecer cobrindo a calculadora. Em ausência de dados, oferecer ação útil ou estado discreto; nenhuma frota/alerta fictício.

## 7. Entrega em fatias revisáveis

Cada fatia deve ter branch/PR próprio. Os nomes abaixo são sugestões; este plano não declara que os PRs foram abertos. Reconciliar as dependências de 7o antes de implementar; Quick Actions continua fatia separada, não parte desta modernização.

### 7.1 Fundamentos obrigatórios para dados reais

Estas etapas vêm primeiro e bloqueiam um Beta que ofereça cadastro ou persistência de dados reais:

| Fundamento                            | Branch sugerida                       | Escopo e gate de saída                                                                                                                                                                                                                                                                                                                                                                                     | Dependências                                                                             |
| ------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| S0 — Decisão de privacidade V2        | `chore/real-data-v2-privacy-contract` | Rever a decisão 1.9 e addenda test-only como estado do build atual; registrar a diretriz nova; inventariar valores sensíveis, envelopes, chaves/tabelas por canal, desbloqueio, backup, exclusão e fontes V1/2.x. Atualizar SPEC-01..04, ADRs, matriz, disclosure e gates antes de mudar comportamento.                                                                                                    | Esta diretriz; sem ler perfis/dados pessoais reais.                                      |
| S1 — Persistência local criptografada | `feat/v2-encrypted-user-data`         | Em Web e Desktop, integrar stores classificados como dados pessoais/comerciais ao cofre autenticado; bloquear novos caminhos plaintext; oferecer criar/desbloquear/travar, backup/exportação cifrada e apagamento. Sessões novas salvam/reabrem dados reais; a demo fica isolada. Stores-fontes anteriores não são sobrescritos nesta etapa.                                                               | S0; auditoria das APIs/envelopes criptográficos existentes e compatibilidade do formato. |
| S2 — Migração explícita V1→V2         | `feat/v1-to-v2-user-data-migration`   | Importar fontes V1.14 e registros 2.x preexistentes listados por chave/tabela após ação do usuário; preservar IDs, relações, configurações e snapshots. Migração idempotente/retomável; prévia por tipo/contagem, cópia cifrada recuperável, verificação do destino e relatório por origem; manter fonte até aprovação pós-verificação. Fixtures Web/Desktop; sem varredura ampla ou sobrescrita da fonte. | S0 e S1; gate de compatibilidade v1→v2. A migração Desktop é bloqueio conhecido.         |

### 7.2 Fatias da experiência

As correções e o desenvolvimento visual podem ser preparados em branches separados. Só publicar essas melhorias no canal de dados reais depois de S1/S2.

| Fatia                              | Branch sugerida                       | Escopo e aceite específico                                                                                                                                                                                                          | Dependências                                                                  |
| ---------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A1 — Confiança no Dashboard        | `fix/dashboard-data-integrity`        | Filtro real; fórmulas/unidades/rótulos corretos; remover constantes e projeções sem fonte. Demo e sessão real usam a mesma camada de consulta, mas ficam isoladas. Registros fora do período não afetam nenhum relatório histórico. | Baseline medida e contrato dos agregadores.                                   |
| A2 — Navegação/semântica única     | `refactor/navigation-resource-groups` | Studio usa façades/registro existentes; decidir apresentação dos três grupos versus cinco primários; biblioteca sem duplicação; títulos coerentes; entradas e preferências antigas resolvidas. Nenhum destino fica inacessível.     | Formalizar a reconciliação de 7o.2; sem migrar domínio comercial.             |
| A3 — Seletores e paridade de modos | `fix/calculator-context-selectors`    | Busca acessível, aplicação explícita de perfil/carretel/taxas, vínculo do item e unidades corretas. Matriz Rápido/Detalhado/Completo × FDM/resina × superfícies coberta; sem reset ao navegar.                                      | A2 para retorno contextual; decisão de unidades antes do trecho afetado.      |
| A4 — Produto volta ao cálculo      | `feat/product-repricing-flow`         | Completar ida/volta; legados mostram campos recuperáveis/ausentes; novos produtos podem guardar vínculo/receita versionada. Reprecificar não altera original, venda ou estoque.                                                     | A3; desenho de snapshot de 7l e gate aditivo de persistência.                 |
| A5 — Dashboard funcional/visual    | `feat/dashboard-workspaces`           | Quatro conteúdos distinguíveis; reutilizar análises existentes e montar heatmap na shell ativa; série/lista com drilldown; cobertura/estados vazios; lazy mounting real.                                                            | A1, A2 e contrato 7o.8. Não depende da migração de Produto.                   |
| A6 — Mini-Dash integrado           | `fix/minidash-verified-summary`       | Dados compartilhados; nenhum hardcode; compactar/reabrir/expandir; sem cobrir campos, foco ou diálogos.                                                                                                                             | A1/A2; critérios próprios de 7o.5.                                            |
| A7 — Carteira e estoque úteis      | `feat/dashboard-business-context`     | Orçamentos por status/cliente sem dupla contagem; alertas com limiar explícito e origem; posição atual distinta do filtro histórico; atalhos abrem registros reais.                                                                 | A5; decidir política de estoque e critérios de preço/unidade.                 |
| A8 — Canais/ofertas reais          | `feat/sales-channel-calculator-flow`  | Distinguir perfil de taxas, loja/canal concreto e oferta; configurar taxas/frete e comparar cenários no cálculo; preservar preço histórico por revisão. Sem API obrigatória.                                                        | Auditar/reconciliar Phases 4/5/7k/7l, manifesto e modelos antes de codificar. |

Ordem recomendada: S0 → S1 → S2 antes de expor o novo Beta a dados reais; as correções e o desenvolvimento visual podem ser preparados em branches separados, mas a versão com dados reais não publica sem esses três gates. Em seguida A1 → A2 → A6, para corrigir Dashboard e Mini-Dash; A3; A4 e A5 em PRs independentes; A7; A8 por último. Uma migração comercial não deve bloquear a correção do Dashboard. Integrar uma fatia revisada antes de iniciar suas dependentes.

Não estimar esforço de todas as migrações como “ajuste de UX”. A4/A8 têm risco de domínio/persistência maior que reorganizar componentes; precisam desenho e fixtures próprios.

## 8. Gates e cenários de aceite

Antes de cada fatia, medir a baseline na base exata; não copiar contagens históricas de testes. Fazer RED → GREEN → REFACTOR nas regras/interações alteradas. Gate local sem regressões não substitui CI verde e revisão no SHA entregue.

- Executar `npm run test:run`, `npm run lint`, `npm run typecheck` e `npm run typecheck:electron` para entregas de código; cobertura dos componentes novos conforme o gate vigente de 7o. Registrar o que foi e não foi executado.
- Validar builds distintos: Web Stable com `VITE_BETA_CHANNEL=false npm run build:web`, Web Beta com `VITE_BETA_CHANNEL=true npm run build:web` e Desktop com `VITE_BETA_CHANNEL=false npm run build:desktop`. Manter artefatos separados e identificar qual foi aberto; o número da versão no package não define o canal. Desktop não aceita a flag Beta ativa.
- Browser na **shell web realmente montada**, tanto Stable quanto Beta em contextos descartáveis separados: desktop 1440/1600 e tela ampla, mobile ~390px, temas claro/escuro, teclado, redução de movimento e pt-BR/en-US. Sem erro de console/pageerror, horizontal overflow ou foco/ações encobertos.
- Trocar período/workspace/tecnologia com fixtures sintéticas que representem dados reais: FDM e resina, prejuízo, zero válido, histórico vazio, filtro vazio, IDs órfãos, snapshot ausente e quantidade maior que 1. Comparar todos os cartões com os mesmos registros de origem.
- Selecionar perfil pessoal/biblioteca, material com densidade/preço próprio e carretel com custo diferente; editar defaults e reaplicar explicitamente; cancelar edição contextual sem perder o cálculo.
- Digitar números parciais/decimais, abrir/fechar seletor, trocar nível/superfície, navegar e voltar: rascunho e resultados preservados conforme o contrato, sem substituição por exemplo.
- Salvar cálculo/produto, reabrir legado e novo, criar orçamento vinculado a cliente e alterar perfil depois: original e orçamento emitido não se recalculam silenciosamente. Produto antigo não recebe parâmetros inventados.
- Cada orçamento entra uma vez na carteira, mesmo com vários itens ou cálculos reutilizados; dois orçamentos distintos contribuem com seus próprios totais. Não contar cálculos vinculados como receita adicional. Status aprovado não vira pago/produzido. Selecionar carretel/reprecificar não baixa estoque.
- Demo com dados sintéticos pré-existentes: entrar, editar, sair e recarregar (inclusive recarregar durante a sessão) deixa o cofre e os bytes de dados reais idênticos; demo não chama persistência real.
- Migração V1→V2 em fixtures de Web e Desktop: dados presentes, fonte vazia, formatos antigos, entradas duplicadas entre tabela/key, falha de descriptografia, senha errada, chave indisponível, interrupção em cada etapa, retomada, alvo preexistente, quota/storage cheio e falha de verificação. Confirmar source intacto antes da aprovação, destino cifrado e reabertura exata, sem duplicata ou PII em logs.
- Em perfil real Beta, criar/reabrir registro sem cofre desbloqueado deve falhar fechado, sem plaintext; com unlock, o ciphertext não contém valores em texto claro, reload e lock/unlock preservam os dados e exportação/importação segue envelope criptografado validado. Delete apaga somente os dados próprios abrangidos e mostra o relatório.
- Stable Web, Web Beta e Desktop exercitam os mesmos fluxos de dados reais e fixtures de migração. Confirmar separação entre origens/perfis não escolhidos, sem leitura automática ao iniciar ou sobrescrever dados existentes.

### Política do canal e lançamento

O build `beta.15` publicado é test-only e hoje só persiste as três chaves Beta descritas no histórico D1. Isso é comportamento real que o código e a disclosure atual precisam mudar; não é o requisito desejado da V2. O próximo Beta candidato deve aceitar dados reais sob o cofre local criptografado, persistir os stores necessários, oferecer backup/importação cifrados, exclusão e migração explícita. Não promover esse caminho até S0/S1/S2 passarem na revisão e nas evidências.

Stable Web, Web Beta e Desktop compartilham o mesmo requisito de proteção e preservação, adaptado ao armazenamento de cada plataforma. Sem senha/cofre desbloqueado ou capacidade criptográfica, nada de dados sensíveis é gravado em texto claro. A Web continua estática/local-first; nenhum serviço ou login em nuvem é exigido. A demo não é pré-requisito para cadastrar dados reais.

O plano não declara release publicada. Antes de liberar candidato: fixtures de migração Web/Desktop, conteúdo cifrado por armazenamento, recuperação testada, backup/exportação/importação e exclusão verificados, privacidade revisada e compatibilidade v1→v2 aprovada. O beta.15 permanece uma versão histórica até um novo build cumprir estes critérios.

## 9. Limites e decisões a registrar

- 7o.2: cinco destinos continuam vigentes até reconciliar formalmente a proposta de três grupos. Não retirar opções de visibilidade/restauração nem alterar home como efeito colateral.
- 7o.3/7o.8: densidade/complexidade e quatro workspaces são decisões separadas. Aproveitar organização de `Example/`, não números, tipos paralelos ou componentes órfãos por cópia indiscriminada.
- 7f: preservar o inventário único. Não remover um store/alias ou fazer migração inexistente para “deduplicar”. Resolver explicitamente limiar 100g/150g e unidade do preço da resina.
- 7k/7l/Phases 4–5: separar loja/canal/perfil de taxas e definir snapshot imutável antes de vincular ofertas e receita completa de produtos. Auditoria dos stores existentes precede novos cadastros.
- 7q/7n: IA continua fora da V2.0 e telas de frota real continuam adiadas nesta fase. Perfis pessoais não fornecem status operacional, logs, capacidade, amortização patrimonial ou ocupação de ativos reais. O custo estimado de depreciação já existe na calculadora e deve ser preservado; não é medição de recuperação do investimento de uma máquina possuída. `usefulLife` horas/anos permanece decisão aberta; não alimentar um novo KPI com unidade ambígua.
- 1.9/PR #279: preservar o comportamento da `beta.15` como histórico. ADR-004 e SPEC-05 registram a direção aprovada e o gate de migração; a implementação ainda precisa atualizar SPEC-01..04, o manifesto, disclosure, matriz de testes e retenção/exclusão. Não tratar o manifesto plaintext da política 1.9 como criptografia local.
- Migração: usar fixtures sintéticas dos formatos V1 e relatar explicitamente as limitações de dados cifrados antigos que não tenham envelope/chave compatível. Nunca testar lendo os perfis locais reais da pessoa usuária.
- Publicação: uma feature no source não equivale a UI montada, merge ou deploy. Validar a shell ativa e o artefato do canal antes de atualizar aceites do roadmap.

Este documento acrescenta um plano de integração às decisões existentes; não marca fases como concluídas nem resolve silenciosamente decisões de domínio.
