#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${GITHUB_WORKSPACE:-$(pwd)}"
CONFIG_PATH="${ROOT_DIR}/fluig.json"

read_config_value() {
  local key_path="$1"
  local default_value="${2:-}"

  node - "$CONFIG_PATH" "$key_path" "$default_value" <<'NODE'
const fs = require("fs");

const [configPath, keyPath, defaultValue] = process.argv.slice(2);

if (!fs.existsSync(configPath)) {
  process.stdout.write(defaultValue || "");
  process.exit(0);
}

const raw = fs.readFileSync(configPath, "utf8").trim();
if (!raw) {
  process.stdout.write(defaultValue || "");
  process.exit(0);
}

const parsed = JSON.parse(raw);
const value = keyPath.split(".").reduce((acc, key) => {
  if (acc && typeof acc === "object" && key in acc) {
    return acc[key];
  }

  return undefined;
}, parsed);

if (value === undefined || value === null) {
  process.stdout.write(defaultValue || "");
  process.exit(0);
}

if (Array.isArray(value)) {
  process.stdout.write(JSON.stringify(value));
  process.exit(0);
}

process.stdout.write(String(value));
NODE
}

CLI_DOWNLOAD_URL="${FLUIG_CLI_DOWNLOAD_URL:-$(read_config_value "cli.downloadUrl")}"
CLI_SHA256="${FLUIG_CLI_SHA256:-$(read_config_value "cli.sha256")}"
CLI_OUTPUT_REL="${FLUIG_CLI_OUTPUT_PATH:-$(read_config_value "cli.outputPath" ".github/bin/fluig-cli")}"
CLI_OUTPUT_PATH="${ROOT_DIR}/${CLI_OUTPUT_REL}"

if [[ -z "${CLI_DOWNLOAD_URL}" ]]; then
  echo "FLUIG_CLI_DOWNLOAD_URL nao definido. Configure a repo variable ou fluig.json > cli.downloadUrl."
  exit 1
fi

mkdir -p "$(dirname "${CLI_OUTPUT_PATH}")"

echo "Baixando CLI standalone de ${CLI_DOWNLOAD_URL}"
curl -fsSL "${CLI_DOWNLOAD_URL}" -o "${CLI_OUTPUT_PATH}"
chmod +x "${CLI_OUTPUT_PATH}"

if [[ -n "${CLI_SHA256}" ]]; then
  ACTUAL_SHA256="$(sha256sum "${CLI_OUTPUT_PATH}" | awk '{print $1}')"
  if [[ "${ACTUAL_SHA256}" != "${CLI_SHA256}" ]]; then
    echo "Checksum invalido para o CLI. Esperado: ${CLI_SHA256} | Atual: ${ACTUAL_SHA256}"
    exit 1
  fi
  echo "Checksum validado com sucesso."
fi

echo "FLUIG_CLI_PATH=${CLI_OUTPUT_PATH}" >> "${GITHUB_ENV}"
echo "CLI standalone pronto em ${CLI_OUTPUT_PATH}"
