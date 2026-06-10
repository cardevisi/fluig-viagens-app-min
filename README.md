# fluig-viagens-app

Projeto Fluig com pipeline de deploy via GitHub Actions usando um CLI standalone.

## Estrutura

- `dataset/`: scripts de dataset a serem publicados
- `fluig.json`: configuracao do projeto, do CLI e do comando de deploy
- `.github/workflows/fluig-deploy.yml`: pipeline de deploy
- `.github/scripts/setup-standalone-cli.sh`: reutiliza ou baixa e prepara o binario standalone
- `.github/scripts/deploy-fluig-resource.mjs`: resolve os arquivos e executa o deploy

## Secrets obrigatorios

Configure no repositorio:

- `FLUIG_BASE_URL`
- `FLUIG_CONSUMER_KEY`
- `FLUIG_CONSUMER_SECRET`
- `FLUIG_ACCESS_TOKEN`
- `FLUIG_TOKEN_SECRET`

## Variables opcionais

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

## fluig.json

Exemplo:

```json
{
  "projectName": "fluig-viagens-app",
  "cli": {
    "mode": "standalone",
    "downloadUrl": "https://github.com/SEU_USUARIO/SEU_CLI/releases/download/v1.0.0/fluig-cli-linux-x64",
    "sha256": "",
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

## Como usar

Deploy manual pelo GitHub Actions:

1. Abra `Actions`.
2. Execute `Fluig Deploy`.
3. Informe `resource_type=dataset`.
4. Opcionalmente informe `resource_path=dataset/ds_viagens_exemplo.js`.

Em `push` para `main`, o workflow tenta publicar todos os arquivos de `dataset/`.
