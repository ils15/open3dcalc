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
- Uma rerun reutiliza a única branch remota `release/vX.Y.Z` existente; se mais
  de uma existir, o workflow falha sem alterar nenhuma delas.
- Nunca usar `[skip ci]`, force push ou mover uma tag já publicada.

## Preparação manual

1. Em **Actions → Release preparation → Run workflow**, selecione `main` e um
   bump (`auto`, `patch`, `minor` ou `major`).
2. O workflow cria `release/vX.Y.Z`, fixa a versão com `changelogen 0.6.2`,
   atualiza `package.json`, `package-lock.json` e `CHANGELOG.md`, executa lint,
   typecheck, testes e builds, e abre um PR para `main`.
3. Se a branch/PR já existir, um rerun reutiliza ambos sem executar outro bump,
   sem force push e sem sobrescrever o estado existente.
4. Revise e faça o merge do PR normalmente. Não crie a tag antes do merge.

Os checks obrigatórios de qualidade continuam sendo os do job oficial
`quality` da `main`. A cobertura atual (46,69%) é o baseline reportado pelo CI;
este fluxo de release não impõe um novo gate de 80% nem altera artificialmente
os números. A melhoria da cobertura é uma tarefa futura separada.

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
SHA e anexa os artefatos Windows/Linux. Uma etapa explícita confirma novamente
o SHA da tag, a existência da Release associada (não draft e com
`published_at`), e a lista completa paginada de assets. Para cada asset esperado,
confere nome/versão, exige o `digest` SHA-256 fornecido pela API e o compara ao
SHA-256 calculado localmente. Asset ausente, duplicado, sem digest ou com digest
divergente faz o job falhar e preserva a branch. Se essa confirmação falhar, o
diagnóstico é preservado e a branch não é removida. Só após confirmação da
Release e dos digests remove `release/vX.Y.Z`.

## Rerun, falhas parciais e recuperação

- Preparação: a única branch `release/vX.Y.Z` existente e seu PR são
  reutilizados. Mais de uma branch é ambígua e falha com diagnóstico, sem
  alterações.
- Publicação: tag movida, tag fora de `main` ou versão divergente falha. Uma
  Release existente para a mesma tag é validada e atualizada com segurança; só
  assets ausentes são anexados. Assets com o mesmo nome e digest diferente
  causam falha, sem overwrite ou delete.
- O build limpa os diretórios de saída antes de gerar artefatos e verifica o
  SHA-256 local; a validação posterior reconcilia esse valor com o `digest` da
  API. Assim, nenhum arquivo residual de outra tag é anexado ou aceito.
- Se o build falhar, corrija no código e faça novo PR/versionamento. Não mova a
  tag existente. Se a Release já foi publicada, preserve-a e trate a correção
  em uma nova versão.
- Se a publicação terminou mas a limpeza falhou, reexecute após conferir a
  Release; a publicação e a limpeza são idempotentes e só removem a branch
  correspondente. Em estado parcial não reparável, o job falha preservando
  manifestos/detalhes para diagnóstico e não apaga assets.
- Para recuperação de um PR ainda não publicado, feche-o/remova a branch
  manualmente somente após confirmar que não há tag ou Release correspondente.

## Rollback

Rollback é feito por um commit corretivo revertido em `main`, seguido de uma
nova versão patch. Não apagar, mover ou recriar a tag/Release anterior.

## Artefatos

| Plataforma | Formato     | Local            |
| ---------- | ----------- | ---------------- |
| Web        | PWA         | `dist-web/`      |
| Windows    | `.exe`      | `dist-electron/` |
| Linux      | `.AppImage` | `dist-electron/` |
