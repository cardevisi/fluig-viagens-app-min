# fluig-viagens-app-min

Exemplo mínimo para:

- testar datasets Fluig com `node --test`
- fazer deploy só dos datasets alterados
- rodar o deploy com uma imagem Docker pronta no GHCR

## O que foi simplificado

- um workflow só: [`.github/workflows/ci.yml`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/.github/workflows/ci.yml)
- um script só de deploy: [`.github/scripts/fluig-resource-deploy.mjs`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/.github/scripts/fluig-resource-deploy.mjs)
- um teste de contrato só: [`tests/datasets.contract.test.js`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/tests/datasets.contract.test.js)
- uma imagem Docker publicada no GHCR: `ghcr.io/cardevisi/fluig-cli:0.1.0`
- um Dockerfile local para gerar essa imagem quando o CLI mudar: [`.github/docker/fluig-cli/Dockerfile`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/.github/docker/fluig-cli/Dockerfile)

## Testes

Os testes seguem uma abordagem simples e atual para este caso: teste de contrato.

Em vez de criar um teste manual para cada dataset, o arquivo `tests/datasets.contract.test.js`:

- varre a pasta `datasets/`
- executa cada script em sandbox
- valida o contrato mínimo do dataset
- aplica asserts específicos quando necessário

Rodar localmente:

```bash
npm test
```

## Pipeline

Fluxo do workflow:

1. roda os testes
2. se estiver em `main` e os testes passarem, descobre quais datasets mudaram
3. faz login no GHCR e baixa a imagem pronta do Fluig CLI
4. publica apenas os datasets alterados

No `workflow_dispatch`, você pode informar manualmente uma lista de datasets, um por linha.

## Imagem do CLI

O pipeline usa a imagem:

```text
ghcr.io/cardevisi/fluig-cli:0.1.0
```

Essa imagem já contém o Fluig CLI e é baixada no deploy.

Assim, o runner não precisa:

- baixar o CLI em step separado
- buildar a imagem do CLI a cada execução
- manter binários grandes dentro do repositório

## Secrets

Configure no GitHub Actions:

- `FLUIG_BASE_URL`
- `FLUIG_USERNAME`
- `FLUIG_PASSWORD`

Opcional:

- `FLUIG_SERVER_NAME`

## Estrutura essencial

```text
datasets/
  ds-viagens-paises.js

tests/
  datasets.contract.test.js

.github/
  docker/fluig-cli/Dockerfile
  scripts/fluig-resource-deploy.mjs
  workflows/ci.yml
```
