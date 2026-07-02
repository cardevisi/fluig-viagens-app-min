#!/usr/bin/env bash
# setup-standalone-cli.sh
#
# Prepara o binário standalone do Fluig CLI para ser utilizado nos workflows
# do GitHub Actions. O script:
#  1. Tenta reaproveitar um binário já presente no cache (validando o checksum SHA-256).
#  2. Se o cache não existir ou for inválido, baixa o binário:
#     a. Via GitHub CLI (gh) autenticado, para repositórios privados.
#     b. Via curl como fallback público.
#  3. Valida o checksum do arquivo baixado (quando CLI_SHA256 estiver configurado).
#  4. Exporta FLUIG_CLI_PATH para o ambiente do Actions, tornando o caminho
#     disponível nos passos seguintes do workflow.
#
# Variáveis de ambiente reconhecidas:
#  - FLUIG_CLI_DOWNLOAD_URL   URL de download do binário (override de fluig.json > cli.downloadUrl)
#  - FLUIG_CLI_SHA256         Checksum SHA-256 esperado  (override de fluig.json > cli.sha256)
#  - FLUIG_CLI_OUTPUT_PATH    Caminho de saída do binário (override de fluig.json > cli.outputPath)
#  - GITHUB_TOKEN             Token de acesso para download de releases privadas via gh CLI
#  - GITHUB_WORKSPACE         Diretório raiz do repositório (definido automaticamente pelo Actions)
#  - GITHUB_ENV               Arquivo de variáveis do Actions para exportação entre steps

# Interrompe o script imediatamente em caso de erro (-e), variável não definida (-u)
# ou falha em pipelines (-o pipefail).
set -euo pipefail

# Diretório raiz do repositório: usa o workspace do GitHub Actions ou o diretório atual.
ROOT_DIR="${GITHUB_WORKSPACE:-$(pwd)}"

# Caminho do arquivo de configuração do projeto Fluig.
CONFIG_PATH="${ROOT_DIR}/fluig.json"

# ---------------------------------------------------------------------------
# read_config_value KEY_PATH [DEFAULT]
#
# Lê um valor aninhado do fluig.json usando notação de ponto (ex.: "cli.downloadUrl").
# A leitura é delegada a um script Node.js inline para suportar JSON de forma robusta.
# Retorna o valor padrão (DEFAULT) quando o arquivo não existe ou a chave não é encontrada.
# ---------------------------------------------------------------------------
read_config_value() {
  local key_path="$1"
  local default_value="${2:-}"

  # Executa um script Node.js via heredoc, passando configPath, keyPath e defaultValue
  # como argumentos de linha de comando para evitar injeção de shell.
  node - "$CONFIG_PATH" "$key_path" "$default_value" <<'NODE'
const fs = require("fs");

const [configPath, keyPath, defaultValue] = process.argv.slice(2);

// Retorna o valor padrão se o arquivo não existir.
if (!fs.existsSync(configPath)) {
  process.stdout.write(defaultValue || "");
  process.exit(0);
}

const raw = fs.readFileSync(configPath, "utf8").trim();
// Retorna o valor padrão se o arquivo estiver vazio.
if (!raw) {
  process.stdout.write(defaultValue || "");
  process.exit(0);
}

const parsed = JSON.parse(raw);

// Navega pelo objeto usando cada segmento da chave separada por ".".
const value = keyPath.split(".").reduce((acc, key) => {
  if (acc && typeof acc === "object" && key in acc) {
    return acc[key];
  }

  return undefined;
}, parsed);

// Chave não encontrada ou nula: retorna o valor padrão.
if (value === undefined || value === null) {
  process.stdout.write(defaultValue || "");
  process.exit(0);
}

// Arrays são serializados como JSON para preservar a estrutura.
if (Array.isArray(value)) {
  process.stdout.write(JSON.stringify(value));
  process.exit(0);
}

process.stdout.write(String(value));
NODE
}

# ---------------------------------------------------------------------------
# Resolução das configurações do CLI.
# Prioridade: variável de ambiente > fluig.json > valor padrão.
# ---------------------------------------------------------------------------

# URL de download do binário do CLI.
CLI_DOWNLOAD_URL="${FLUIG_CLI_DOWNLOAD_URL:-$(read_config_value "cli.downloadUrl")}"

# Checksum SHA-256 esperado para validação do binário (opcional).
CLI_SHA256="${FLUIG_CLI_SHA256:-$(read_config_value "cli.sha256")}"

# Caminho relativo de saída do binário; padrão: ".github/bin/fluig-cli".
CLI_OUTPUT_REL="${FLUIG_CLI_OUTPUT_PATH:-$(read_config_value "cli.outputPath" ".github/bin/fluig-cli")}"

# Caminho absoluto derivado do caminho relativo.
CLI_OUTPUT_PATH="${ROOT_DIR}/${CLI_OUTPUT_REL}"

# ---------------------------------------------------------------------------
# compute_sha256 FILE
#
# Calcula o hash SHA-256 de um arquivo usando sha256sum (Linux) ou shasum (macOS).
# Imprime apenas o hash em hexadecimal, sem o nome do arquivo.
# Encerra o script com erro se nenhum utilitário estiver disponível.
# ---------------------------------------------------------------------------
compute_sha256() {
  local file_path="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    # Linux: sha256sum imprime "HASH  ARQUIVO", extraímos apenas o hash com awk.
    sha256sum "${file_path}" | awk '{print $1}'
    return 0
  fi

  if command -v shasum >/dev/null 2>&1; then
    # macOS/BSD: shasum com flag -a 256 produz saída idêntica ao sha256sum.
    shasum -a 256 "${file_path}" | awk '{print $1}'
    return 0
  fi

  echo "Nenhum comando de checksum SHA-256 disponivel (sha256sum ou shasum)." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# download_github_release_asset
#
# Tenta baixar o binário de uma release do GitHub usando o gh CLI autenticado.
# Indicado para repositórios privados onde o download direto via curl não
# funcionaria sem credenciais.
#
# Retorna 1 (falha) se:
#  - GITHUB_TOKEN não estiver definido.
#  - O gh CLI não estiver instalado.
#  - A URL não corresponder ao padrão de release asset do GitHub.
# ---------------------------------------------------------------------------
download_github_release_asset() {
  # Requer token de autenticação para acessar releases privadas.
  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    return 1
  fi

  # Requer o gh CLI instalado no runner.
  if ! command -v gh >/dev/null 2>&1; then
    return 1
  fi

  # Valida que a URL segue o padrão de release asset do GitHub e extrai os componentes.
  # Formato esperado: https://github.com/OWNER/REPO/releases/download/TAG/ASSET
  if [[ ! "${CLI_DOWNLOAD_URL}" =~ ^https://github\.com/([^/]+)/([^/]+)/releases/download/([^/]+)/([^/?#]+)$ ]]; then
    return 1
  fi

  local repo_owner="${BASH_REMATCH[1]}"
  local repo_name="${BASH_REMATCH[2]}"
  local release_tag="${BASH_REMATCH[3]}"
  local asset_name="${BASH_REMATCH[4]}"

  echo "Baixando CLI standalone da release privada ${repo_owner}/${repo_name}@${release_tag} (${asset_name})"

  # GH_TOKEN é a variável de ambiente reconhecida pelo gh CLI para autenticação.
  GH_TOKEN="${GITHUB_TOKEN}" gh release download "${release_tag}" \
    --repo "${repo_owner}/${repo_name}" \
    --pattern "${asset_name}" \
    --output "${CLI_OUTPUT_PATH}" \
    --clobber  # Sobrescreve o arquivo de destino caso já exista.
}

# ---------------------------------------------------------------------------
# download_cli
#
# Orquestra a estratégia de download:
#  1. Tenta usar o gh CLI para releases privadas do GitHub.
#  2. Em caso de falha, usa curl como método público e universal.
# ---------------------------------------------------------------------------
download_cli() {
  if download_github_release_asset; then
    return 0
  fi

  echo "Baixando CLI standalone de ${CLI_DOWNLOAD_URL}"
  # -f: falha com código de erro em resposta HTTP >= 400.
  # -s: modo silencioso (sem barra de progresso).
  # -S: exibe erros mesmo em modo silencioso.
  # -L: segue redirecionamentos.
  curl -fsSL "${CLI_DOWNLOAD_URL}" -o "${CLI_OUTPUT_PATH}"
}

# ---------------------------------------------------------------------------
# is_existing_cli_valid
#
# Verifica se o binário do CLI já existe e está íntegro:
#  - Retorna 1 se o arquivo não existir.
#  - Corrige a permissão de execução se necessário.
#  - Quando CLI_SHA256 está configurado, valida o checksum e retorna 1 se divergir.
#  - Quando CLI_SHA256 não está configurado, reusa o binário sem validação.
# ---------------------------------------------------------------------------
is_existing_cli_valid() {
  if [[ ! -f "${CLI_OUTPUT_PATH}" ]]; then
    return 1
  fi

  # Garante que o binário tenha permissão de execução.
  if [[ ! -x "${CLI_OUTPUT_PATH}" ]]; then
    chmod +x "${CLI_OUTPUT_PATH}"
  fi

  if [[ -n "${CLI_SHA256}" ]]; then
    local actual_sha256
    actual_sha256="$(compute_sha256 "${CLI_OUTPUT_PATH}")"

    if [[ "${actual_sha256}" != "${CLI_SHA256}" ]]; then
      echo "CLI existente encontrado, mas com checksum divergente. Esperado: ${CLI_SHA256} | Atual: ${actual_sha256}"
      return 1
    fi

    echo "CLI existente validado por checksum."
  else
    echo "CLI existente encontrado em ${CLI_OUTPUT_PATH}; reaproveitando binario."
  fi

  return 0
}

# ---------------------------------------------------------------------------
# Execução principal
# ---------------------------------------------------------------------------

# Cria o diretório de destino do binário, se ainda não existir.
mkdir -p "$(dirname "${CLI_OUTPUT_PATH}")"

# Se o CLI já existir e for válido, exporta o caminho e encerra com sucesso.
if is_existing_cli_valid; then
  echo "FLUIG_CLI_PATH=${CLI_OUTPUT_PATH}" >> "${GITHUB_ENV}"
  echo "CLI standalone pronto em ${CLI_OUTPUT_PATH}"
  exit 0
fi

# URL de download é obrigatória para prosseguir.
if [[ -z "${CLI_DOWNLOAD_URL}" ]]; then
  echo "FLUIG_CLI_DOWNLOAD_URL nao definido. Configure a repo variable ou fluig.json > cli.downloadUrl."
  exit 1
fi

# Realiza o download do binário.
download_cli

# Garante permissão de execução no arquivo recém-baixado.
chmod +x "${CLI_OUTPUT_PATH}"

# Valida o checksum do binário baixado quando um valor esperado estiver configurado.
if [[ -n "${CLI_SHA256}" ]]; then
  ACTUAL_SHA256="$(compute_sha256 "${CLI_OUTPUT_PATH}")"
  if [[ "${ACTUAL_SHA256}" != "${CLI_SHA256}" ]]; then
    echo "Checksum invalido para o CLI. Esperado: ${CLI_SHA256} | Atual: ${ACTUAL_SHA256}"
    exit 1
  fi
  echo "Checksum validado com sucesso."
fi

# Exporta o caminho do CLI para os próximos steps do workflow via GITHUB_ENV.
echo "FLUIG_CLI_PATH=${CLI_OUTPUT_PATH}" >> "${GITHUB_ENV}"
echo "CLI standalone pronto em ${CLI_OUTPUT_PATH}"
