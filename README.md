# open3dcalc

Calculadora de custos e precificação de impressão 3D, para quem vende peças e precisa fechar preço com margem.

[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](LICENSE)
[![Demo](https://img.shields.io/badge/demo-GitHub%20Pages-brightgreen)](https://ils15.github.io/open3dcalc/)
[![React 19](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Electron 43](https://img.shields.io/badge/Electron-43-47848f)](https://www.electronjs.org/)

## O que é

O open3dcalc estima quanto custa imprimir uma peça — material, energia, máquina, mão de obra, falhas de impressão e taxa de marketplace — e transforma esse custo em preço de venda. A estimativa parte de um STL, OBJ, 3MF ou do G-code do próprio slicer, e o painel de resultados mostra as premissas que foram usadas. Roda no navegador como PWA instalável e como aplicativo desktop (Electron + SQLite), com clientes, orçamentos e histórico salvos no próprio dispositivo. Interface em pt-BR e en-US.

## Demo

**https://ils15.github.io/open3dcalc/** — a versão publicada, que continua funcionando offline depois do primeiro carregamento.

![Tela do open3dcalc](public/app_screenshot.png)

## Instalação

Requer Node.js 22 (a versão usada no CI) e npm.

```bash
git clone https://github.com/ils15/open3dcalc.git
cd open3dcalc
npm ci
```

## Uso

```bash
npm run dev:web      # PWA em http://localhost:3000
npm run dev:desktop  # Electron + Vite com hot-reload
```

Dentro do app, envie uma peça ou informe as medidas, escolha material e impressora, ajuste a margem, e o custo e o preço saem no painel de resultados. Os orçamentos, clientes e o histórico ficam salvos no dispositivo.

Para usar sem compilar, baixe o instalador de Windows, Linux ou macOS na [página de releases](https://github.com/ils15/open3dcalc/releases).

## Estrutura

```
src/shared/     # componentes, stores Zustand, cálculo e i18n — compartilhado entre web e desktop
src/platform/   # entradas e overrides específicos de web (PWA) e desktop (Electron)
electron/       # processo main, IPC e escrita no SQLite
db/             # schema Drizzle, migrations SQL e seed dos catálogos
docs/           # documentação
```

- [docs/funcionalidades.md](docs/funcionalidades.md) — cálculo, estimativa, tours, formatos aceitos.
- [docs/arquitetura.md](docs/arquitetura.md) — stack, banco de dados, variáveis de ambiente, scripts.
- [docs/design-e-acessibilidade.md](docs/design-e-acessibilidade.md) — tema, camadas e contraste.
- [docs/privacidade.md](docs/privacidade.md) — o que fica no dispositivo e o que a exclusão cobre.
- [docs/desenvolvimento.md](docs/desenvolvimento.md) — testes e gate de pre-push.
- [docs/releases.md](docs/releases.md) — deploy web, canal beta e releases desktop.

## Licença

MIT — veja [LICENSE](LICENSE).
