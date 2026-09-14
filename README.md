# fluig-viagens-app-min

Exemplo mínimo para:

- testar datasets Fluig com `node --test`
- fazer deploy só dos datasets alterados
- rodar o deploy dentro de uma imagem Docker com o Fluig CLI já embutido

## O que foi simplificado

- um workflow só: [`.github/workflows/ci.yml`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/.github/workflows/ci.yml)
- um script só de deploy: [`.github/scripts/fluig-resource-deploy.mjs`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/.github/scripts/fluig-resource-deploy.mjs)
- um teste de contrato só: [`tests/datasets.contract.test.js`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/tests/datasets.contract.test.js)
- uma imagem Docker para o CLI: [`.github/docker/fluig-cli/Dockerfile`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/.github/docker/fluig-cli/Dockerfile)
- binários standalone versionados em [`.tools/fluig-studio-cli-v0.1.0/standalone`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/.tools/fluig-studio-cli-v0.1.0/standalone)

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
3. faz build da imagem Docker com o Fluig CLI
4. publica apenas os datasets alterados

No `workflow_dispatch`, você pode informar manualmente uma lista de datasets, um por linha.

## Docker com CLI embutido

A imagem é montada a partir de `node:22-bookworm-slim` e copia o binário Linux direto de [`.tools/fluig-studio-cli-v0.1.0/standalone`](file:///Users/carlos.oliveira/TOTVS/fluig-viagens-app-min/.tools/fluig-studio-cli-v0.1.0/standalone).

Assim, o runner não precisa:

- baixar o CLI em step separado
- instalar Node com `setup-node` para o deploy
- manter scripts extras de bootstrap

## Secrets

Configure no GitHub Actions:

- `FLUIG_BASE_URL`
- `FLUIG_USERNAME`
- `FLUIG_PASSWORD`

Opcional:

- `FLUIG_SERVER_NAME`

## Estrutura essencial

```text
.tools/
  fluig-studio-cli-v0.1.0/standalone/

datasets/
  ds-viagens-paises.js

tests/
  datasets.contract.test.js

.github/
  docker/fluig-cli/Dockerfile
  scripts/fluig-resource-deploy.mjs
  workflows/ci.yml
```
