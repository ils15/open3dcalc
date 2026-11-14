# Desenvolvimento

Como rodar, testar e o que o gate de pre-push exige.

## Início rápido

### Pré-requisitos

- **Node.js 22+** (recommended: 22 LTS)
- **npm 10+**
- **Git**

### Instalação

```bash
git clone https://github.com/ils15/open3dcalc.git
cd open3dcalc
npm install
```

> **Note:** `postinstall` runs `electron-rebuild` to compile native `better-sqlite3`. It may take a few seconds.

### Desenvolvimento

```bash
# Web — servidor com hot-reload (http://localhost:3000)
npm run dev:web

# Desktop — Vite + Electron com hot-reload
npm run dev:desktop
```

### Build de produção

```bash
# Web — saída em dist-web/
npm run build:web

# Desktop — saída em dist/ + compila electron/
npm run build:desktop
npm run build:electron

# Ambos de uma vez
npm run build:all
```
## Testes

```bash
# Modo watch (desenvolvimento)
npm test

# Execução única (CI)
npm run test:run

# Com cobertura
npm run test:run -- --coverage

# Teste de isolamento de armazenamento em Chromium real — requer o Chromium do
# Playwright: `npx playwright install chromium` (no CI: `--with-deps`)
npm run test:browser

# Studio/Cadastros no browser — requer o servidor web já em execução
npm run test:studio-header:playwright

# Studio/Bento responsivo + clearance do dock — requer o servidor web em execução
npm run test:studio-layout-ux:playwright
```

Os testes de Studio requerem o app web em execução (inicie-o separadamente com `npm run dev:web`) e usam `http://127.0.0.1:3000/` por padrão; para outro servidor, defina `STUDIO_PREVIEW_URL` ao chamar o comando, por exemplo: `STUDIO_PREVIEW_URL='https://your-preview-host/' npm run test:studio-layout-ux:playwright`.

We use **Vitest** + **Testing Library** for unit and component tests. Minimum coverage for calculation logic: **80%**.

### Gate de pre-push: "não piorou", não "zero vermelho"

O `.husky/pre-push` exige **zero** falhas em `typecheck`, `lint` e `build:all`. A etapa
de testes é a exceção: ela compara com o baseline em
[`scripts/push-gate-baseline.json`](../scripts/push-gate-baseline.json) e bloqueia
**apenas regressão nova** — um arquivo de teste falhando que não está no baseline, ou
uma contagem de testes estáveis acima da do baseline. Contagem menor passa e encolhe o
baseline; um arquivo do baseline que começa a passar só gera aviso.

Isso existe porque `main` carrega vermelho herdado do refactor W6 do StudioLayout e de
dois registros de pin adiados. A medição de referência é **12 arquivos / 52 testes** em
`main@09d8947`; o reparo do Studio reduziu para **9 arquivos / 36 testes** — os três
arquivos a mais eram o guard de exportação demo e o probe criptográfico empacotado, agora removido.
Um gate que exige zero falhas nesse estado travou o repositório três vezes no mesmo dia
— um push precisou de `--no-verify` e dois merges de bypass de administrador.

**O CI continua sendo a autoridade:** o gate local é um filtro barato de "não piorou",
e o merge exige lint/typecheck/test/build verdes no CI. `SKIP_PUSH_GATE=1` pula o hook
inteiro e imprime um aviso alto — é exceção, não fluxo. Para regerar o baseline (nunca
editar à mão) e a regra completa, veja
[BRANCH-POLICY.md](../BRANCH-POLICY.md#6-local-pre-push-gate-is-did-not-get-worse-ci-is-the-authority).

`npm run test:browser` roda o teste de isolamento do perfil Beta num **Chromium real** (via Playwright), separado da suíte jsdom porque usa APIs reais do navegador. Instale o browser uma vez com `npx playwright install chromium` (no CI o job usa `npx playwright install --with-deps chromium`).
## Infraestrutura

Este projeto utiliza um **self-hosted runner CX33** para execução dos pipelines de CI/CD:

- 🚀 Zero custo de execução (vs GitHub Actions hosted)
- 💤 Runner sleep quando ocioso — zero consumo
- 🔥 Acorda automaticamente nos pushes/PRs
- 🔒 Segredos e cache locais (sem egress)
## Como contribuir

Contributions are welcome! See the full guide at [CONTRIBUTING.md](../CONTRIBUTING.md).

**Workflow summary:**

1. Fork the repository
2. Create a branch (`feature/`, `fix/`, `docs/`, etc.)
3. Commit following [Conventional Commits](https://www.conventionalcommits.org/)
4. Run `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build:all`
5. Open a Pull Request (minimum 1 approval)
