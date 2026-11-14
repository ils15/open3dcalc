# Releases e deploy

Distribuição desktop, deploy web, canal beta e notas de release.

## Aplicativo desktop

Baixe a versão desktop para Windows, Linux ou macOS na [página de releases](https://github.com/ils15/open3dcalc/releases).

| Plataforma                           | Formato        | Arquivo                          |
| ------------------------------------ | -------------- | -------------------------------- |
| Windows (x64 / arm64)                | NSIS Installer | `Open3DCalc-{version}-setup.exe` |
| Linux (x64 / arm64)                  | AppImage       | `Open3DCalc-{version}.AppImage`  |
| macOS Apple Silicon (M1 ou superior) | DMG            | `Open3DCalc-{version}-arm64.dmg` |
| macOS Intel                          | DMG            | `Open3DCalc-{version}-x64.dmg`   |

> ⚠️ **macOS:** o app ainda não é assinado com um certificado Apple Developer (assinatura ad-hoc). Na primeira abertura, o macOS vai bloqueá-lo: vá em **Ajustes do Sistema → Privacidade e Segurança** e clique em **Abrir Mesmo Assim**. Se aparecer a mensagem "o app está danificado", rode `xattr -cr /Applications/Open3DCalc.app` no Terminal. Enquanto o app não for assinado e notarizado, a instalação automática de atualizações fica desativada no macOS: o app continua avisando quando há versão nova e o botão abre a página de download da release para você baixar o novo DMG.
## Deploy

### Web — GitHub Pages

O deploy da web é **automático** via GitHub Actions (`ci-cd.yml`) a cada **tag estável** imutável (`vX.Y.Z`):

1. CI roda lint, typecheck, testes e build na tag
2. O web build é publicado na **branch `gh-pages`** (raiz) via `peaceiris/actions-gh-pages`
3. Os arquivos `404.html` e `index.html` são gerados para roteamento SPA

> A branch `gh-pages` é **branch-based** (não artifact-based) justamente para que o canal beta possa viver no subpath `/beta/` sem clobberar a raiz estável. Veja a mudança da fonte do Pages em [Canal Beta](#canal-beta-web) abaixo.

### Canal Beta (web)

O canal beta publica builds **web-only** (Electron nunca é buildado) num subpath isolado do GitHub Pages, permitindo validar mudanças antes de promover a estável.

> 🐕 **Dogfood:** o **preview 3D do G-code** (D-CL5/D-CL6) foi dogfoodado no canal beta (`v1.13.0-beta.1..3`, 3 betas / 1933 testes / paridade do oráculo legado validada) e aprovado para a release estável — agora está **ligado por padrão em todos os builds** (`VITE_TOOLPATH_PREVIEW=false` ainda desliga; veja a tabela de env vars acima). O canal beta segue como o canal de dogfood das próximas novidades.

> 🧪 **Exemplos embutidos:** a beta traz o **3DBenchy** ([CreativeTools](https://www.3dbenchy.com/), domínio público / CC0 — livre pra redistribuir) na drop zone do visualizador. Dois botões baixam o exemplo sob demanda, sem precisar do seu próprio arquivo: **Benchy (STL)** dispara o pipeline de malha (volume + peso) e **Benchy (G-code)** dispara o preview de toolpath com o slider de camadas. Os binários vivem em `public/samples/` e a URL é resolvida relativa ao deploy (funciona na raiz e no subpath `/beta/`).

|           | Estável                               | Beta                                       |
| --------- | ------------------------------------- | ------------------------------------------ |
| URL       | `https://ils15.github.io/open3dcalc/` | `https://ils15.github.io/open3dcalc/beta/` |
| Versão    | `vX.Y.Z`                              | `vX.Y.Z-beta.N`                            |
| Origem    | tag estáável (`ci-cd.yml`)            | tag beta (`beta-deploy.yml`)               |
| Build     | web + desktop                         | **web-only**                               |
| Changelog | `CHANGELOG.md` + GitHub Release       | somente no corpo da GitHub Release         |

**Cortando uma beta**

1. Vá em _Actions → Beta channel → Run workflow_
2. O workflow (`beta.yml`):
   - Calcula a próxima versão (_auto_: próximo minor da versão atual; ou a base informada no input)
   - Bumpa `package.json`, faz commit e cria a **tag anotada imutável** `vX.Y.Z-beta.N`
   - Empurra commit + tag com o PAT `BETA_RELEASE_TOKEN`
3. A tag dispara o `beta-deploy.yml`, que:
   - Builda a web com `VITE_BETA_CHANNEL=true` (selo visual de beta)
   - Publica em `gh-pages/beta/` sem tocar na raiz estáável (`keep_files: true`)
   - Cria (ou atualiza) a GitHub Release **prerelease** `Beta vX.Y.Z-beta.N`

> 🧾 **Bloqueio por disclosure:** antes de autorizar o corte, o pacote de evidências de release e o
> checklist do gate devem estar verdes — veja [`docs/privacy/BETA5-RELEASE-EVIDENCE.md`](privacy/BETA5-RELEASE-EVIDENCE.md).

> **Decisão do produto (2026-10-10):** a Beta Web aceita dados reais e usa os mesmos registros
> locais da versão Stable, em formato legível no armazenamento do navegador. Não há senha nem proteção adicional
> para salvar; scripts executados na mesma origem e pessoas com acesso ao perfil do navegador
> também podem acessar esses dados. Os antigos registros `open3dcalc_beta_test_*` são migrados
> para as chaves compartilhadas antes da hidratação. A Beta continua Web-only. Exportação e
> importação JSON de dados reais estão disponíveis; mantenha arquivos exportados em local seguro,
> pois o aplicativo não os protege com senha.

As tags beta são **imutáveis**: nunca reescreva ou delete uma tag já publicada — corte uma nova beta (`beta.N+1`) caso precise ajustar algo. O `beta-deploy.yml` é idempotente, então re-executá-lo na mesma tag apenas refresca a release.

O changelog do beta existe **somente no corpo da GitHub Release** — `CHANGELOG.md` e o changelog in-app nunca carregam betas, pois o parser de `scripts/sync-changelog.mjs` colidiria em chaves como `1.13.0` vs `1.13.0-beta.1`.

**Promover beta → estável**: o fluxo normal de release (`release.yml`) consolida **todos** os commits desde a última tag estável, então o changelog da release estável já inclui todo o período das betas. Veja [RELEASE.md](../RELEASE.md).

> 🔑 **`BETA_RELEASE_TOKEN` (obrigatório)**
>
> O GitHub **suprime** novas execuções de workflow causadas pelo `GITHUB_TOKEN` (anti-recursão). A tag beta **precisa** ser empurrada por um **Personal Access Token (classic)** com escopo `contents: write`; caso contrário a tag é criada, mas o `beta-deploy.yml` nunca dispara.
>
> Como configurar:
>
> 1. _Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token_
> 2. Escopo: **`repo`** (ou no mínimo `contents: write`); o selo `workflow` **não** é necessário
> 3. _Settings → Secrets and variables → Actions → New repository secret_ → nome `BETA_RELEASE_TOKEN`, valor = token
>
> Tanto `beta.yml` quanto `beta-deploy.yml` fazem **fail-fast** logo no início se o secret estiver vazio, explicando o problema no log.

**Mudança da fonte do Pages (cutover, já concluído)**

Como o beta vive em `gh-pages/beta/` e a raiz de `gh-pages` é a estável, a fonte do GitHub Pages foi mudada de _GitHub Actions_ para a **branch `gh-pages`**: _Settings → Pages → Build and deployment → Source: **Deploy from a branch** → branch **`gh-pages`** / pasta **`/ (root)`_**.

> ✅ **One-off concluído:** o workflow `.github/workflows/seed-gh-pages.yml` populou a raiz de `gh-pages` com um build estável durante o cutover (sem apagar `/beta/`, run `35358169749`) e foi **removido** na sequência — existia apenas para esse cutover pontual. Hoje a raiz é mantida pelo `ci-cd.yml` (build-web) a cada tag estável.

### Desktop — GitHub Releases

O release é um processo de **duas fases** (preparação + publicação), detalhado em [RELEASE.md](../RELEASE.md).

**Preparação** (GitHub Actions):

1. Em _Actions → Release preparation → Run workflow_, selecione `main` e o bump desejado
2. O workflow cria `release/vX.Y.Z`, atualiza versão com _changelogen 0.6.2_, sincroniza o changelog in-app, roda lint/typecheck/testes/build e abre um PR para `main`
3. Revise e faça o merge do PR

**Publicação** (tag local):

```bash
git fetch origin main && git switch main && git pull --ff-only origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

O workflow _Release publication_ valida a tag, cria a GitHub Release com nome `Open3DCalc vX.Y.Z` e anexa os artefatos Windows/Linux. A branch `release/vX.Y.Z` é removida após confirmação.

### Notas de release automáticas

As notas de cada GitHub Release usam um **formato canônico** renderizado por `scripts/release-notes.mjs` (`renderPublication()`) e validado por um gate _fail-closed_ antes da publicação:

```bash
npm run release:notes:validate -- --file release-notes.md --tag vX.Y.Z
```

O workflow _Release publication_ gera o corpo com `--notes-file` (em vez de `--generate-notes`) e só publica se o validador aprovar. As seções emoji têm ordem fixa: 🚀 Features, 🐛 Fixes, 🧹 Chores, 📦 Dependencies, 🤖 CI/CD e ❤️ Contributors (além de 📚 Documentation, 🔒 Security e ⚠️ Breaking Changes quando houver conteúdo).

O backfill de releases antigas é idempotente e reversível por snapshot local (`release-notes-snapshots/`):

```bash
node scripts/backfill-release-notes.mjs --dry-run --all
node scripts/backfill-release-notes.mjs --apply --all
node scripts/backfill-release-notes.mjs --restore vX.Y.Z
```
## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for the full version history.
## Links

- **Live Demo:** https://ils15.github.io/open3dcalc/
- **Repository:** https://github.com/ils15/open3dcalc
- **Issues:** https://github.com/ils15/open3dcalc/issues
- **Releases:** https://github.com/ils15/open3dcalc/releases
- **Telegram Community:** [Impressão 3D BR](https://t.me/Impressao3DBR)
