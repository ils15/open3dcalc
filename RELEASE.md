# 🚀 Release — Open3DCalc

O release é dividido em **preparação** e **publicação**. A preparação nunca
cria tag ou GitHub Release. A publicação só aceita uma tag imutável apontando
para um commit já incorporado em `main`.

> **Regra permanente:** não inventar, criar ou publicar `v1.10.0` neste fluxo.
> Tags publicadas nunca são movidas, apagadas ou recriadas.

## Pré-requisitos

- `main` contém as mudanças desejadas e o CI está verde.
- O runner self-hosted tem as labels `cx33` e `linux`, Node.js 22, npm, GitHub
  CLI autenticado pelo token do Actions e, para builds Windows, Wine.
- A permissão de Actions permite `contents: write` e `pull-requests: write`.
- Não existe uma branch remota `release/vX.Y.Z` para a versão pretendida.
- Nunca usar `[skip ci]`, force push ou mover uma tag já publicada.

## Preparação manual

1. Em **Actions → Release preparation → Run workflow**, selecione `main` e um
   bump (`auto`, `patch`, `minor` ou `major`).
2. O workflow cria `release/vX.Y.Z`, fixa a versão com `changelogen 0.6.2`,
   atualiza `package.json`, `package-lock.json` e `CHANGELOG.md`, executa lint,
   typecheck, testes e builds, e abre um PR para `main`.
3. Se o PR já existir, um rerun o reutiliza. Se a branch já existir, a execução
   aborta sem sobrescrever estado.
4. Revise e faça o merge do PR normalmente. Não crie a tag antes do merge.

## Publicação automática

Após o merge, crie a tag localmente no commit exato de `main` e envie somente a
tag (nunca para `main`):

```bash
git fetch origin main
git switch main
git pull --ff-only origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

O workflow **Release publication** valida que a tag aponta para o commit do
evento, está na história de `main` e coincide com `package.json`. Depois roda
qualidade/build no commit/tag exato, cria a GitHub Release com `--target` desse
SHA e anexa os artefatos Windows/Linux. Só após confirmação da Release remove
`release/vX.Y.Z`.

## Rerun, falhas parciais e recuperação

- Preparação: branch existente aborta claramente; PR aberto é reutilizado.
  Corrija a causa e execute um novo bump/branch apenas quando apropriado.
- Publicação: tag movida, tag fora de `main`, versão divergente ou Release já
  existente aborta. O workflow nunca sobrescreve Release nem recria artefatos.
- Se o build falhar, corrija no código e faça novo PR/versionamento. Não mova a
  tag existente. Se a Release já foi publicada, preserve-a e trate a correção
  em uma nova versão.
- Se a publicação terminou mas a limpeza falhou, reexecute apenas após conferir
  a Release; a limpeza é idempotente e só remove a branch correspondente.
- Para recuperação de um PR ainda não publicado, feche-o/remova a branch
  manualmente somente após confirmar que não há tag ou Release correspondente.

## Rollback

Rollback é feito por um commit corretivo revertido em `main`, seguido de uma
nova versão patch. Não apagar, mover ou recriar a tag/Release anterior.

## Artefatos

| Plataforma | Formato | Local |
|------------|---------|-------|
| Web | PWA | `dist-web/` |
| Windows | `.exe` | `dist-electron/` |
| Linux | `.AppImage` | `dist-electron/` |
