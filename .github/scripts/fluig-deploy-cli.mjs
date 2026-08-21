import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { toFluigResourceName } from "./fluig-deploy-resources.mjs";

export function buildFluigServerConnection({
  workspaceRootDir,
  fluigProjectConfig,
  env = process.env,
}) {
  const fluigBaseUrl = env.FLUIG_BASE_URL?.trim();
  if (!fluigBaseUrl) {
    throw new Error("FLUIG_BASE_URL nao definido.");
  }

  const parsedBaseUrl = parseFluigBaseUrl(fluigBaseUrl);
  const explicitServerName =
    env.FLUIG_SERVER_NAME?.trim() || fluigProjectConfig.cli?.serverName || "";
  const defaultServerName =
    explicitServerName ||
    fluigProjectConfig.name ||
    path.basename(workspaceRootDir) ||
    "fluig-ci";
  const runSuffix = env.GITHUB_RUN_ID ? `-${env.GITHUB_RUN_ID}` : "";

  return {
    host: parsedBaseUrl.hostname,
    port:
      parsedBaseUrl.port ||
      (parsedBaseUrl.protocol === "https:" ? String(443) : String(80)),
    ssl: parsedBaseUrl.protocol === "https:",
    serverName: sanitizeCliServerName(`${defaultServerName}${runSuffix}`),
    username: env.FLUIG_USERNAME?.trim() || "",
    password: env.FLUIG_PASSWORD?.trim() || "",
  };
}

export function printDeploySummary({
  projectName,
  resourceType,
  cliBinaryPath,
  fluigServerConnection,
  resourceFiles,
}) {
  console.log(`Projeto: ${projectName}`);
  console.log(`Tipo de recurso: ${resourceType}`);
  console.log(`CLI: ${cliBinaryPath}`);
  console.log(
    `Servidor CLI: ${fluigServerConnection.serverName} (${fluigServerConnection.host}:${fluigServerConnection.port}, ssl=${fluigServerConnection.ssl})`,
  );
  console.log(`Arquivos selecionados: ${resourceFiles.length}`);
}

export async function authenticateFluigCli({
  cliBinaryPath,
  fluigServerConnection,
  dryRunEnabled,
  workingDirectory,
  env = process.env,
}) {
  const createServerArgs = createServerRegistrationArgs(fluigServerConnection);
  const loginArgs = createLoginArgs(fluigServerConnection);

  console.log("Preparando servidor do Fluig CLI.");

  if (dryRunEnabled) {
    console.log(
      `Comando (dry-run): ${createCliCommand(cliBinaryPath, redactPasswordArgs(createServerArgs))}`,
    );
    console.log(
      `Comando (dry-run): ${createCliCommand(cliBinaryPath, redactPasswordArgs(loginArgs))}`,
    );
    return;
  }

  await executeShellCommand(
    createCliCommand(cliBinaryPath, createServerArgs),
    workingDirectory,
    env,
  );
  await executeShellCommand(
    createCliCommand(cliBinaryPath, loginArgs),
    workingDirectory,
    env,
  );
}

export function createResourceDeployCommand({
  cliBinaryPath,
  deployCommandTemplate,
  resourcePath,
  resourceType,
  workspaceRootDir,
  cliServerName,
}) {
  const absoluteResourcePath = path.join(workspaceRootDir, resourcePath);
  const fluigResourceName = toFluigResourceName(resourcePath);

  // O template é preenchido com valores já escapados para shell porque depois
  // ele é executado via `bash -lc`.
  const commandArguments = fillTemplatePlaceholders(deployCommandTemplate, {
    resource: quoteShellValue(resourcePath),
    resourceAbsolute: quoteShellValue(absoluteResourcePath),
    resourceName: quoteShellValue(fluigResourceName),
    resourceType: quoteShellValue(resourceType),
    projectRoot: quoteShellValue(workspaceRootDir),
    serverName: quoteShellValue(cliServerName),
  });

  return `${quoteShellValue(cliBinaryPath)} ${commandArguments}`;
}

export async function executeShellCommand(
  command,
  workingDirectory,
  env = process.env,
) {
  await new Promise((resolve, reject) => {
    const childProcess = spawn("bash", ["-lc", command], {
      cwd: workingDirectory,
      stdio: "inherit",
      env,
    });

    childProcess.on("error", reject);
    childProcess.on("exit", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(new Error(`Comando falhou com codigo ${exitCode}`));
    });
  });
}

function parseFluigBaseUrl(fluigBaseUrl) {
  let parsedBaseUrl;

  try {
    parsedBaseUrl = new URL(fluigBaseUrl);
  } catch {
    throw new Error(`FLUIG_BASE_URL invalido: ${fluigBaseUrl}`);
  }

  if (!parsedBaseUrl.hostname) {
    throw new Error(`FLUIG_BASE_URL sem host valido: ${fluigBaseUrl}`);
  }

  return parsedBaseUrl;
}

function createServerRegistrationArgs(fluigServerConnection) {
  const args = [
    "servers",
    "create",
    "--server-name",
    fluigServerConnection.serverName,
    "--host",
    fluigServerConnection.host,
  ];

  if (fluigServerConnection.ssl) {
    args.push("--ssl");
  }

  args.push(
    "--port",
    String(fluigServerConnection.port),
    "--username",
    fluigServerConnection.username,
    "--password",
    fluigServerConnection.password,
  );

  return args;
}

function createLoginArgs(fluigServerConnection) {
  return [
    "auth",
    "login",
    "--server-name",
    fluigServerConnection.serverName,
    "--username",
    fluigServerConnection.username,
    "--password",
    fluigServerConnection.password,
  ];
}

function sanitizeCliServerName(serverName) {
  const normalizedServerName = String(serverName)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedServerName || "fluig-ci";
}

function fillTemplatePlaceholders(template, placeholderValues) {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (originalMatch, placeholderName) => {
      if (!(placeholderName in placeholderValues)) {
        return originalMatch;
      }

      return placeholderValues[placeholderName];
    },
  );
}

function quoteShellValue(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function createCliCommand(cliBinaryPath, cliArgs) {
  return [
    quoteShellValue(cliBinaryPath),
    ...cliArgs.map((arg) => quoteShellValue(arg)),
  ].join(" ");
}

function redactPasswordArgs(cliArgs) {
  const redactedArgs = [...cliArgs];
  const passwordFlagIndex = redactedArgs.findIndex(
    (argument) => argument === "--password",
  );

  if (passwordFlagIndex >= 0 && passwordFlagIndex + 1 < redactedArgs.length) {
    redactedArgs[passwordFlagIndex + 1] = "***";
  }

  return redactedArgs;
}
