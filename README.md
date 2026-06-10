# fluig-viagens-app

Projeto Fluig com pipeline de deploy via GitHub Actions usando um CLI standalone baixado de release do GitHub.

## Estrutura

- `dataset/`: scripts de dataset a serem publicados
- `fluig.json`: configuracao do projeto, do CLI e do comando de deploy
- `.github/workflows/fluig-deploy.yml`: pipeline de deploy
- `.github/scripts/setup-standalone-cli.sh`: reutiliza ou baixa e prepara o binario standalone
- `.github/scripts/deploy-fluig-resource.mjs`: resolve os arquivos e executa o deploy

## Visao geral

O fluxo de deploy funciona assim:

1. O workflow executa o script `.github/scripts/setup-standalone-cli.sh`.
2. O script tenta reutilizar o binario local em `.github/bin/fluig-cli`.
3. Se o binario nao existir ou estiver invalido, o script baixa o asset configurado em `cli.downloadUrl`.
4. Quando `cli.sha256` estiver preenchido, o arquivo e validado antes do deploy.
5. O workflow executa o deploy com base no `commandTemplate` definido em `fluig.json`.

### Diagrama de funcionamento

```mermaid
flowchart LR
    A[Inicio do workflow] --> B[Executa setup-standalone-cli.sh]
    B --> C{CLI local existe em .github/bin/fluig-cli?}
    C -->|Sim| D{SHA-256 configurado?}
    C -->|Nao| E[Baixa CLI da release]
    D -->|Sim| F[Valida checksum]
    D -->|Nao| G[Reutiliza binario local]
    F -->|Valido| G
    F -->|Invalido| E
    E --> H[Aplica permissao de execucao]
    H --> I[Valida checksum do download]
    I --> J[Exporta FLUIG_CLI_PATH]
    G --> J
    J --> K[Executa deploy-fluig-resource.mjs]
    K --> L[Publica recurso no Fluig]
```

## Secrets obrigatorios

Configure no repositorio:

- `FLUIG_BASE_URL`
- `FLUIG_CONSUMER_KEY`
- `FLUIG_CONSUMER_SECRET`
- `FLUIG_ACCESS_TOKEN`
- `FLUIG_TOKEN_SECRET`

## Variaveis opcionais

Voce pode sobrescrever a configuracao de `fluig.json` com repo variables:

- `FLUIG_CLI_DOWNLOAD_URL`
- `FLUIG_CLI_SHA256`
- `FLUIG_DEPLOY_COMMAND_TEMPLATE`

## Comportamento do setup do CLI

O script `.github/scripts/setup-standalone-cli.sh` segue um fluxo idempotente:

- se o binario ja existir em `cli.outputPath`, ele reutiliza o arquivo
- se `cli.sha256` estiver configurado, valida o checksum antes de reutilizar
- se o arquivo existir mas estiver invalido, faz o download novamente
- `FLUIG_CLI_DOWNLOAD_URL` so e obrigatorio quando o download realmente for necessario
- o binario em `.github/bin/fluig-cli` e cache local do workspace e nao deve ser versionado

## Origem do CLI

- o binario Linux usado no pipeline e publicado como asset de release no GitHub
- a URL padrao atual aponta para `v1.0.0` do proprio repositorio
- a melhor pratica e manter `downloadUrl` e `sha256` sempre versionados juntos
- se uma nova versao do CLI for publicada, atualize os dois campos em `fluig.json` ou nas repo variables

## fluig.json

Exemplo:

```json
{
  "projectName": "fluig-viagens-app",
  "cli": {
    "mode": "standalone",
    "downloadUrl": "https://github.com/cardevisi/fluig-viagens-app/releases/download/v1.0.0/fluig-cli-linux-x64",
    "sha256": "9bcd2734138bef264b596a6d6a071a887e9b9ea988db7ccb01139a338503cbc2",
    "outputPath": ".github/bin/fluig-cli"
  },
  "resources": {
    "dataset": {
      "directory": "dataset",
      "extensions": [".js"]
    }
  },
  "deploy": {
    "defaultResourceType": "dataset",
    "commandTemplate": "dataset deploy --file {{resource}} --name {{resourceName}}"
  }
}
```

## Placeholders do comando

O `commandTemplate` aceita:

- `{{resource}}`: caminho relativo do arquivo
- `{{resourceAbsolute}}`: caminho absoluto do arquivo
- `{{resourceName}}`: nome do recurso sem extensao
- `{{resourceType}}`: tipo do recurso, como `dataset`
- `{{projectRoot}}`: raiz do repositorio

## Boas praticas

- nao versione `/.github/bin/fluig-cli`; esse arquivo deve existir apenas como cache local
- mantenha `cli.sha256` preenchido para evitar uso de binarios corrompidos ou trocados
- use `FLUIG_CLI_DOWNLOAD_URL` e `FLUIG_CLI_SHA256` apenas quando precisar sobrescrever o padrao do projeto
- prefira publicar novas versoes do CLI em releases em vez de commitar binarios grandes no repositorio

## Como usar

Deploy manual pelo GitHub Actions:

1. Abra `Actions`.
2. Execute `Fluig Deploy`.
3. Informe `resource_type=dataset`.
4. Opcionalmente informe `resource_path=dataset/ds_viagens_exemplo.js`.

Em `push` para `main`, o workflow tenta publicar todos os arquivos de `dataset/`.
