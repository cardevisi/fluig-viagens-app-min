import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const REQUIRED_VARIABLES_FOR_DEPLOY = [
  "FLUIG_BASE_URL",
  "FLUIG_USERNAME",
  "FLUIG_PASSWORD",
];

export function getWorkspaceRootDir(env = process.env) {
  return env.GITHUB_WORKSPACE || process.cwd();
}

export async function readFluigProjectConfig(workspaceRootDir) {
  const fluigConfigFile = path.join(workspaceRootDir, "fluig.json");

  try {
    const fileContents = await readFile(fluigConfigFile, "utf8");
    return fileContents.trim() ? JSON.parse(fileContents) : {};
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }

    throw error;
  }
}

export function isDryRunEnabled(env = process.env) {
  return String(env.FLUIG_DRY_RUN || "false") === "true";
}

export function ensureRequiredDeployEnvironment({
  dryRunEnabled,
  env = process.env,
}) {
  const requiredVariableNames = dryRunEnabled
    ? ["FLUIG_BASE_URL"]
    : REQUIRED_VARIABLES_FOR_DEPLOY;

  const missingVariableNames = requiredVariableNames.filter(
    (variableName) => !env[variableName]?.trim(),
  );

  if (missingVariableNames.length > 0) {
    throw new Error(
      `Secrets obrigatorios ausentes para o deploy Fluig: ${missingVariableNames.join(", ")}`,
    );
  }
}

export function getSelectedResourceType({
  fluigProjectConfig,
  env = process.env,
}) {
  return (
    env.FLUIG_RESOURCE_TYPE ||
    fluigProjectConfig.deploy?.defaultResourceType ||
    "dataset"
  );
}

export function getResourceSettings({ fluigProjectConfig, resourceType }) {
  const resourceSettings = fluigProjectConfig.resources?.[resourceType];

  if (!resourceSettings?.directory) {
    throw new Error(
      `Tipo de recurso sem configuracao em fluig.json: ${resourceType}`,
    );
  }

  return resourceSettings;
}

export function resolveFluigCliBinaryPath({
  workspaceRootDir,
  fluigProjectConfig,
  env = process.env,
}) {
  const configuredCliPath =
    env.FLUIG_CLI_PATH ||
    path.join(
      workspaceRootDir,
      fluigProjectConfig.cli?.outputPath || ".github/bin/fluig-cli",
    );

  return path.isAbsolute(configuredCliPath)
    ? configuredCliPath
    : path.join(workspaceRootDir, configuredCliPath);
}

export function resolveDeployCommandTemplate({
  fluigProjectConfig,
  env = process.env,
}) {
  const deployCommandTemplate =
    env.FLUIG_DEPLOY_COMMAND_TEMPLATE ||
    fluigProjectConfig.deploy?.commandTemplate ||
    "";

  if (!deployCommandTemplate.trim()) {
    throw new Error(
      "FLUIG_DEPLOY_COMMAND_TEMPLATE nao definido. Configure a repo variable ou fluig.json > deploy.commandTemplate.",
    );
  }

  return deployCommandTemplate;
}

function isMissingFileError(error) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
