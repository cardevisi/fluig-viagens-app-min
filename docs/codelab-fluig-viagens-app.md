summary: Reconstrua do zero o projeto fluig-viagens-app-min com dataset, teste de contrato e pipeline CI/CD simplificado.
id: reconstruindo-fluig-viagens-app
categories: Fluig, CI/CD, GitHub Actions
environments: web
tags: fluig, github-actions, nodejs, ci-cd, codelab
status: Published
authors: TOTVS - Fluig Studio
feedback link: https://github.com/cardevisi/fluig-viagens-app-min/issues

# Contribuindo com o fluig-viagens-app-min: dataset, teste de contrato e pipeline simplificado

## Visão geral
Duration: 0:03:00

Neste codelab, você vai trabalhar em uma versão enxuta do projeto **fluig-viagens-app-min**.
A proposta é ensinar o fluxo completo sem espalhar a lógica em muitos arquivos: um dataset,
um teste de contrato e um único workflow de CI/CD.

Ao final, você terá um projeto que:

- publica apenas datasets alterados;
- valida os scripts com `node --test`;
- usa uma imagem Docker pronta com o Fluig CLI no GHCR;
- executa deploy manual ou automático a partir do mesmo arquivo `ci.yml`.

> aside positive
> O projeto foi reduzido de propósito para a aula ficar mais direta. Em vez de vários helpers e
> workflows separados, você vai aprender o caminho principal que já está em uso no repositório.

### Atividades deste laboratório

- Clonar o repositório base.
- Entender a estrutura mínima do projeto.
- Conferir o dataset `ds-viagens-paises.js`.
- Validar o teste de contrato com `npm test`.
- Ler o workflow `.github/workflows/ci.yml`.
- Entender como o deploy roda dentro do container `ghcr.io/cardevisi/fluig-cli:0.1.0`.

### O que você vai aprender

- Como escrever um dataset Fluig simples.
- Como testar datasets fora do servidor com sandbox em `node:vm`.
- Como detectar datasets alterados no GitHub Actions.
- Como encapsular o Fluig CLI em Docker para manter o pipeline limpo.
- Como usar um workflow unico para teste e deploy.

### O que você vai construir

```text
fluig-viagens-app-min/
├── datasets/
│   └── ds-viagens-paises.js
├── tests/
│   └── datasets.contract.test.js
├── .github/
│   ├── docker/
│   │   └── fluig-cli/
│   │       └── Dockerfile
│   ├── scripts/
│   │   └── fluig-resource-deploy.mjs
│   └── workflows/
│       └── ci.yml
├── docs/
│   └── codelab-fluig-viagens-app.md
├── fluig.json
└── package.json
```

## Pré-requisitos
Duration: 0:03:00

Você vai precisar de:

1. **Node.js 20 ou superior**

```bash
node --version
```

2. **Git**

```bash
git --version
```

3. Uma conta no **GitHub**

4. Acesso a um ambiente Fluig apenas se quiser executar o deploy real.

> aside positive
> O pipeline foi desenhado para que a parte de teste possa ser estudada mesmo sem acesso imediato
> a um servidor Fluig.

## Clone o projeto
Duration: 0:02:00

Use a URL do repositório da turma:

```bash
git clone git@github.com:cardevisi/fluig-viagens-app-min.git
cd fluig-viagens-app-min
```

![Tela de clone do GitHub](assets/clone-github.png)

## Estrutura mínima do projeto
Duration: 0:03:00

O projeto foi reduzido para manter o foco em três blocos:

1. `datasets/`: onde ficam os datasets Fluig.
2. `tests/`: onde ficam os testes automatizados.
3. `.github/`: onde ficam Dockerfile, script de deploy e workflow.

Esse recorte é suficiente para demonstrar uma esteira completa sem depender de forms, widgets ou
workflow scripts adicionais.

## package.json: comando de teste
Duration: 0:02:00

O `package.json` atual e propositalmente simples:

```json
{
  "name": "fluig-viagens-app",
  "version": "1.0.0",
  "private": true,
  "description": "Exemplo minimo de testes e deploy de datasets Fluig",
  "scripts": {
    "test": "node --test"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Com isso, basta rodar:

```bash
npm test
```

## fluig.json: configuracao minima do projeto
Duration: 0:03:00

No modelo atual, o `fluig.json` guarda apenas o essencial para o script de deploy:

```json
{
  "name": "fluig-viagens-app",
  "cli": {
    "standaloneDir": ".tools/fluig-studio-cli-v0.1.0/standalone",
    "serverName": "fluig-ci"
  }
}
```

### O que cada campo faz

| Chave | Funcao |
|---|---|
| `name` | Nome logico do projeto |
| `cli.standaloneDir` | Pasta local onde os binarios standalone ficam armazenados no repositório |
| `cli.serverName` | Nome base usado pelo script para criar o servidor no Fluig CLI |

> aside positive
> O deploy nao baixa binario em runtime. O pipeline usa uma imagem Docker pronta, o que deixa a
> execucao mais previsivel e mais simples de explicar em sala.

## Dataset de paises
Duration: 0:06:00

Abra `datasets/ds-viagens-paises.js`. O dataset atual ja esta pronto e usa o contrato padrao do
Fluig: a funcao `createDataset()` devolve um objeto montado com `DatasetBuilder`.

```javascript
function createDataset() {
  var ds = DatasetBuilder.newDataset();
  var rows = [
    ["BRA", "Brasil", "BR"],
    ["USA", "Estados Unidos", "US"],
    ["ARG", "Argentina", "AR"],
    ["CHL", "Chile", "CL"],
    ["URY", "Uruguai", "UY"],
    ["PRY", "Paraguai", "PY"],
    ["BOL", "Bolívia", "BO"],
    ["PER", "Peru", "PE"],
    ["COL", "Colômbia", "CO"],
    ["VEN", "Venezuela", "VE"],
    ["MEX", "México", "MX"],
    ["DEU", "Alemanha", "DE"],
    ["ESP", "Espanha", "ES"],
    ["PRT", "Portugal", "PT"],
    ["FRA", "França", "FR"],
    ["ITA", "Itália", "IT"],
    ["GBR", "Reino Unido", "GB"],
    ["JPN", "Japão", "JP"],
    ["CHN", "China", "CN"],
    ["AUS", "Austrália", "AU"],
  ];

  ds.addColumn("codigo", DatasetFieldType.STRING);
  ds.addColumn("nome", DatasetFieldType.STRING);
  ds.addColumn("sigla", DatasetFieldType.STRING);

  for (var i = 0; i < rows.length; i++) {
    ds.addRow(rows[i]);
  }

  return ds;
}
```

### O que observar

- O dataset tem 3 colunas: `codigo`, `nome` e `sigla`.
- Cada linha e um array simples de strings.
- O script nao depende de `require`, porque no Fluig as globais ja existem no runtime.

## Teste de contrato
Duration: 0:07:00

Em vez de um arquivo de teste por dataset, o projeto usa um unico teste de contrato:

`tests/datasets.contract.test.js`

Ele faz quatro coisas:

1. varre a pasta `datasets/`;
2. executa cada script dentro de um sandbox;
3. injeta mocks de `DatasetBuilder` e `DatasetFieldType`;
4. valida um contrato minimo para todos os datasets.

Trecho principal:

```javascript
const dataset = loadDataset(relativePath);
const columns = dataset.getColumns();
const rows = dataset.getRows();

assert.ok(Array.isArray(columns));
assert.ok(Array.isArray(rows));
assert.notEqual(columns.length, 0);

const columnNames = columns.map((column) => column.name);
assert.equal(new Set(columnNames).size, columnNames.length);

for (const row of rows) {
  assert.equal(row.length, columns.length);
}
```

Para o dataset `ds-viagens-paises.js`, o teste ainda faz validacoes especificas:

```javascript
if (relativePath === "datasets/ds-viagens-paises.js") {
  assert.deepEqual(columnNames, ["codigo", "nome", "sigla"]);
  assert.equal(rows.length, 20);
  assert.deepEqual(Array.from(rows.find((row) => row[0] === "BRA")), [
    "BRA",
    "Brasil",
    "BR",
  ]);
}
```

### Execute localmente

```bash
npm test
```

> aside positive
> Esse formato escala bem para exemplos didaticos: quando um novo dataset entra no projeto, ele
> ja passa a ser validado pelo mesmo teste de contrato.

## Workflow unico de CI/CD
Duration: 0:08:00

O projeto agora usa apenas um workflow:

`/.github/workflows/ci.yml`

Ele responde a:

- `push`
- `pull_request`
- `workflow_dispatch`

Os caminhos monitorados sao:

```yaml
paths:
  - "datasets/**"
  - "tests/**"
  - ".github/**"
  - "fluig.json"
  - "package.json"
```

### Job de teste

O primeiro job e o `test`:

```yaml
test:
  runs-on: ubuntu-latest
  container:
    image: node:22-bookworm-slim

  steps:
    - name: Checkout
      uses: actions/checkout@v5

    - name: Rodar testes
      run: npm test
```

Esse job sempre vem antes do deploy.

### Job de deploy

O segundo job e o `deploy`, dependente do `test`:

```yaml
deploy:
  needs: test
  runs-on: ubuntu-latest
  if: >
    needs.test.result == 'success' &&
    (
      github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'push' && github.ref == 'refs/heads/main')
    )
```

Ou seja:

- em `pull_request`, o workflow testa, mas nao faz deploy;
- em `push` na `main`, ele testa e depois publica;
- em `workflow_dispatch`, o deploy pode ser disparado manualmente.

## Detectando apenas os datasets alterados
Duration: 0:05:00

O step `Descobrir datasets alterados` decide o que sera publicado.

Quando a execucao for manual, ele usa a entrada `dataset_paths`.
Quando a execucao vier de `push`, ele calcula o diff entre commits:

```bash
BASE="${{ github.event.before }}"
if [[ -z "$BASE" || "$BASE" == "0000000000000000000000000000000000000000" ]]; then
  BASE="$(git rev-list --max-parents=0 HEAD | tail -n 1)"
fi

DATASETS="$(git diff --name-only "$BASE" "${GITHUB_SHA}" | grep '^datasets/.*\.js$' || true)"
```

Depois, a lista e enviada para `GITHUB_OUTPUT` como `steps.datasets.outputs.paths`.

Isso permite:

- fazer deploy apenas do que mudou;
- ou informar manualmente uma lista de datasets, um por linha.

## Imagem Docker do Fluig CLI
Duration: 0:04:00

O deploy nao instala o Fluig CLI passo a passo no runner. Em vez disso, ele usa a imagem:

```text
ghcr.io/cardevisi/fluig-cli:0.1.0
```

O Dockerfile local que gera essa imagem fica em:

`/.github/docker/fluig-cli/Dockerfile`

Trecho principal:

```dockerfile
FROM node:22-bookworm-slim

ARG TARGETARCH

RUN case "${TARGETARCH}" in \
    "amd64") cp /tmp/fluig-standalone/fluig-cli-linux-x64 /usr/local/bin/fluig ;; \
    *) echo "Arquitetura suportada apenas para esta imagem: amd64. Recebido: ${TARGETARCH}" && exit 1 ;; \
  esac
```

### Por que isso importa

- o runner nao baixa binarios em tempo de execucao;
- o deploy fica padronizado entre ambientes;
- a compatibilidade fica explicita: a imagem publicada atende apenas `amd64`.

## Script de deploy dentro do container
Duration: 0:07:00

O container inicia executando:

```text
node .github/scripts/fluig-resource-deploy.mjs
```

Esse script:

1. le o `fluig.json`;
2. resolve a lista de datasets;
3. monta a conexao com base em `FLUIG_BASE_URL`, `FLUIG_USERNAME` e `FLUIG_PASSWORD`;
4. cria e autentica o servidor no CLI;
5. executa `export resource` para cada dataset selecionado.

Trecho do loop de deploy:

```javascript
for (const dataset of datasets) {
  const resourceName = path.basename(dataset, ".js");
  await runCli([
    "export",
    "resource",
    "--projectPath",
    workspace,
    "--resourceType",
    "dataset",
    "--resourceName",
    resourceName,
    "--serverName",
    connection.serverName,
  ]);
}
```

> aside positive
> O nome do recurso enviado ao CLI preserva o nome real do arquivo, incluindo hifens. Isso evita
> erros de localizacao do dataset no deploy.

## Secrets e variaveis
Duration: 0:04:00

Para o pipeline funcionar no GitHub, configure em **Settings > Secrets and variables > Actions**:

### Secrets obrigatorios

| Nome | Uso |
|---|---|
| `GHCR_TOKEN` | Token para autenticar no GHCR e baixar a imagem do CLI |
| `FLUIG_BASE_URL` | URL base do servidor Fluig |
| `FLUIG_USERNAME` | Usuario do Fluig |
| `FLUIG_PASSWORD` | Senha do Fluig |

### Variavel opcional

| Nome | Uso |
|---|---|
| `FLUIG_SERVER_NAME` | Sobrescreve o nome base do servidor criado no CLI |

## Fluxo completo do pipeline
Duration: 0:03:00

Em resumo, a esteira atual faz:

1. checkout do codigo;
2. `npm test` no job `test`;
3. descoberta dos datasets alterados;
4. login no GHCR;
5. `docker pull ghcr.io/cardevisi/fluig-cli:0.1.0`;
6. `docker run` com as variaveis de ambiente do Fluig;
7. deploy dos datasets selecionados.

Esse fluxo vale tanto para execucao automatica na `main` quanto para disparo manual.

## Parabens e proximos passos
Duration: 0:03:00

Voce concluiu a leitura da implementacao atual do projeto e ja sabe:

- como o dataset esta estruturado;
- como o teste de contrato protege todos os datasets;
- como o `ci.yml` concentra teste e deploy;
- como o Fluig CLI foi encapsulado em Docker para simplificar a pipeline.

### Para continuar praticando

- Adicione um novo dataset em `datasets/` e rode `npm test`.
- Dispare o workflow manual com `dataset_paths` preenchido.
- Gere uma nova imagem do CLI quando o binario mudar e atualize a tag usada no workflow.

### Referencias

- Repositorio: <https://github.com/cardevisi/fluig-viagens-app-min>
- [README.md](../README.md)
- [ci.yml](../.github/workflows/ci.yml)
- [fluig-resource-deploy.mjs](../.github/scripts/fluig-resource-deploy.mjs)
