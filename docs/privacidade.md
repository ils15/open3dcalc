# Privacidade e dados

Onde os dados ficam, o que é legível e o que a exclusão cobre. Os contratos técnicos estão em [`docs/privacy/`](privacy/README.md).

## Privacidade e seus dados

**Política atual (1.9):** no Stable, os dados de clientes, orçamentos e histórico são gravados
diretamente em texto legível no armazenamento local do navegador e do Desktop. Não é necessária
senha ou consentimento para salvar; use apenas dispositivos e perfis sob
seu controle. A base legal `contract_performance` é provisória e aguarda revisão jurídica
qualificada — não é uma conclusão legal. No código proposto nesta branch, a Beta Web usa as
mesmas chaves e os mesmos dados locais da versão Stable; não é um perfil separado nem exige
senha para salvar. Os registros legados da
namespace `open3dcalc_beta_test_*` são copiados/mesclados para as chaves compartilhadas antes da
hidratação. Dados históricos do antigo armazenamento protegido `open3dcalc_pii_vault` são
inertes: não são abertos, lidos, convertidos nem incluídos na exclusão atual; seus bytes podem
permanecer no perfil e não podem ser recuperados por esta versão.

**Próxima Beta (trabalho em andamento, ainda não disponível):** o destino aprovado é aceitar
dados reais em armazenamento local legível, sem criptografia, senhas ou chaves do aplicativo,
com migração V1→V2 visível e validada. Qualquer pessoa com acesso ao perfil do navegador/Desktop
ou ao JSON exportado poderá ler os dados. A Beta publicada `v2.0.0-beta.15` mantém o contrato
test-only antigo; não use essa versão com dados reais. A decisão, o inventário e os critérios
estão em [ADR-004](privacy/ADR-004-real-data-v2.md),
[SPEC-01 V2 Candidate](privacy/SPEC-01-v2-candidate.md) e
[SPEC-05](privacy/SPEC-05-v1-to-v2-migration.md). Só anunciaremos suporte no novo candidato
depois que migração, exportação/importação, exclusão e disclosure forem verificados em Web/PWA
e Desktop.

O Open3DCalc é **local-first** para os dados de cálculo salvos no dispositivo, mas não é correto afirmar que o aplicativo nunca acessa a rede: a versão web/PWA busca recursos e atualizações no serviço de hospedagem, o desktop verifica atualizações publicadas no GitHub Releases e o link do WhatsApp só abre quando acionado pelo usuário — nesse caso, o texto da proposta é enviado ao serviço do WhatsApp. Esses fluxos são separados do assistente local descrito abaixo. A partir da v1.12, a política de privacidade (LGPD) é executada pelo próprio aplicativo:

- **Assistente local (Copilot)** — as dicas por material usam heurísticas locais, a proposta de venda é um template local e os números vêm da calculadora. Não há geração por IA, chamada a provedor de IA, leitura/armazenamento de chave de API nem transferência de dados do projeto ou chaves para serviços de IA. Uma chave eventualmente salva por uma versão beta antiga é ignorada pelo assistente atual. Ao abrir a proposta pelo link do WhatsApp, o texto é compartilhado com o WhatsApp por escolha do usuário.

- **Aba 🔒 Privacidade** — um só lugar para ver e agir sobre seus dados:
  - **Dados locais**: gravação direta de clientes, orçamentos e histórico, sem senha nem consentimento como pré-requisito;
  - **Recibos antigos**: permanecem como registros históricos; sob a política 1.9 são avaliados como `policy_mismatch` e não gateiam gravações;
  - **Excluir dados atuais**: a ação abrange somente dados atuais que o aplicativo possui e consegue acessar; não promete remover bytes históricos e inertes do antigo armazenamento protegido.
- **Exportação local em JSON legível**: os arquivos `.open3dcalc` incluem clientes, orçamentos, histórico e demais dados locais sem senha. Qualquer pessoa com acesso ao arquivo pode lê-lo; guarde-o em um local seguro. Exportação e importação permitem usar dados reais e migrar backups JSON legíveis entre versões. Backups antigos protegidos por senha não são mais importáveis.
- **Backup bruto deixou de ser recurso de usuário**: a cópia bruta do banco SQLite agora é um artefato de diagnóstico interno, bloqueado por padrão (gate de desenvolvimento), com modo de redação de dados pessoais e retenção máxima de 14 dias. Para levar seus dados a outra máquina, use a exportação local JSON.
- **Dados históricos protegidos:** os bytes antigos de `open3dcalc_pii_vault` ficam inertes. Nenhum fluxo atual os abre, lê, converte, recupera ou remove; eles não pertencem ao escopo de exclusão de dados atuais e não podem ser recuperados por esta versão.

> Detalhes técnicos e escopo de exclusão: `docs/privacy/`. O armazenamento e as exportações atuais são legíveis; formatos protegidos antigos estão documentados apenas como histórico.
>
> 📦 **Beta 5 (web):** evidências de release e a disclosure obrigatória estão em [`docs/privacy/BETA5-RELEASE-EVIDENCE.md`](privacy/BETA5-RELEASE-EVIDENCE.md).
