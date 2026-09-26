# fluig-viagens-app-min

Projeto-base usado no codelab para demonstrar um fluxo simples de desenvolvimento com Fluig,
teste automatizado de dataset e pipeline de CI/CD no GitHub Actions.

## Para quem este projeto foi montado

Este repositório foi organizado pensando no aluno que vai acompanhar o codelab e entender, passo a
passo, como:

- criar ou evoluir um dataset Fluig;
- validar o recurso com teste automatizado;
- versionar o projeto no GitHub;
- usar um workflow para testar e publicar alterações.

## O que você encontra aqui

- um dataset de exemplo em `datasets/`;
- um teste automatizado em `tests/`;
- um workflow de CI/CD em `.github/workflows/fluig-deploy.yml`;
- um script de deploy em `.github/scripts/fluig-resource-deploy.mjs`;
- um codelab em `docs/codelab-fluig-viagens-app.md`.

## Estrutura atual do projeto

```text
fluig-viagens-app-min/
├── datasets/
│   └── ds-viagens-paises.js
├── tests/
│   └── datasets.contract.test.js
├── .github/
│   ├── scripts/
│   │   └── fluig-resource-deploy.mjs
│   └── workflows/
│       └── fluig-deploy.yml
├── docs/
│   ├── assets/
│   ├── build-codelab.mjs
│   ├── codelab-fluig-viagens-app.md
│   └── serve-codelab.mjs
├── fluig.json
├── package.json
└── README.md
```

## Arquivos principais

### `datasets/ds-viagens-paises.js`

Dataset de exemplo usado ao longo da aula. Ele devolve uma lista fixa de países e serve como base
para explicar a estrutura de um dataset Fluig.

### `tests/datasets.contract.test.js`

Teste automatizado que executa o dataset em sandbox e valida uma base reaproveitável de regras,
como:

- criação do dataset;
- existência de colunas;
- consistência entre colunas e linhas.

Além disso, o arquivo também pode conter asserts específicos para datasets concretos.

### `.github/workflows/fluig-deploy.yml`

Workflow principal do projeto. Ele:

1. roda os testes;
2. identifica os datasets alterados;
3. baixa a imagem do Fluig CLI no GHCR;
4. executa o deploy apenas do que foi selecionado.

### `.github/scripts/fluig-resource-deploy.mjs`

Script executado dentro do container para autenticar no Fluig CLI e publicar os datasets.

### `docs/codelab-fluig-viagens-app.md`

Material-base do codelab. É esse arquivo que explica o projeto para o aluno e gera a versão HTML
publicada em `docs/reconstruindo-fluig-viagens-app/`.

## Como acompanhar o codelab localmente

Instale as dependências do projeto:

```bash
npm install
```

Para abrir o codelab localmente:

```bash
npm run codelab
```

Se quiser apenas gerar os arquivos do codelab:

```bash
npm run codelab:build
```

## Como rodar os testes

O projeto usa o runner nativo de testes do Node.js:

```bash
npm test
```

## Como funciona o pipeline

O workflow responde a três tipos principais de execução:

- `push`
- `pull_request`
- `workflow_dispatch`

Na prática:

- em `pull_request`, o projeto executa os testes;
- em `push` para `main`, testa e pode fazer deploy;
- em `workflow_dispatch`, permite disparo manual com lista opcional de datasets.

## Deploy e imagem do CLI

O deploy usa a imagem:

```text
ghcr.io/cardevisi/fluig-cli:0.1.0
```

Essa abordagem simplifica a aula porque evita instalar o CLI manualmente em cada execução do
workflow.

## Configurações e secrets

Para executar o deploy real no GitHub Actions, configure:

### Secrets obrigatórios

- `GHCR_TOKEN`
- `FLUIG_BASE_URL`
- `FLUIG_USERNAME`
- `FLUIG_PASSWORD`

### Variável opcional

- `FLUIG_SERVER_NAME`

## Arquivo `fluig.json`

O `fluig.json` concentra as informações principais do projeto Fluig. Neste repositório, ele guarda
os metadados básicos e o nome-base usado pelo CLI durante o deploy.

## Referências úteis

- Codelab: `docs/codelab-fluig-viagens-app.md`
- Workflow: `.github/workflows/fluig-deploy.yml`
- Script de deploy: `.github/scripts/fluig-resource-deploy.mjs`
