#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const rootDir = process.env.GITHUB_WORKSPACE || process.cwd();
const configPath = path.join(rootDir, "fluig.json");

async function main() {
  const config = await loadConfig();
  validateFluigEnv();

  const resourceType =
    process.env.FLUIG_RESOURCE_TYPE ||
    config.deploy?.defaultResourceType ||
    "dataset";

  const resourceConfig = config.resources?.[resourceType];
  if (!resourceConfig?.directory) {
    throw new Error(
      `Tipo de recurso sem configuracao em fluig.json: ${resourceType}`,
    );
  }

  const cliPath = resolveCliPath(config);
  const commandTemplate =
    process.env.FLUIG_DEPLOY_COMMAND_TEMPLATE ||
    config.deploy?.commandTemplate ||
    "";

  if (!commandTemplate.trim()) {
    throw new Error(
      "FLUIG_DEPLOY_COMMAND_TEMPLATE nao definido. Configure a repo variable ou fluig.json > deploy.commandTemplate.",
    );
  }

  const resourcePaths = await resolveResourcePaths(resourceConfig);
  if (resourcePaths.length === 0) {
    console.log(`Nenhum recurso encontrado para ${resourceType}.`);
    return;
  }

  const dryRun = String(process.env.FLUIG_DRY_RUN || "false") === "true";

  console.log(`Projeto: ${config.projectName || path.basename(rootDir)}`);
  console.log(`Tipo de recurso: ${resourceType}`);
  console.log(`CLI: ${cliPath}`);
  console.log(`Arquivos selecionados: ${resourcePaths.length}`);

  for (const resourcePath of resourcePaths) {
    const absolutePath = path.join(rootDir, resourcePath);
    const resourceName = path.basename(
      resourcePath,
      path.extname(resourcePath),
    );
    const args = interpolateTemplate(commandTemplate, {
      resource: shellQuote(resourcePath),
      resourceAbsolute: shellQuote(absolutePath),
      resourceName: shellQuote(resourceName),
      resourceType: shellQuote(resourceType),
      projectRoot: shellQuote(rootDir),
    });
    const command = `${shellQuote(cliPath)} ${args}`;

    console.log(`\nDeploy: ${resourcePath}`);
    console.log(`Comando: ${command}`);

    if (dryRun) {
      continue;
    }

    await runCommand(command, rootDir);
  }
}

async function loadConfig() {
  try {
    const raw = await readFile(configPath, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") {
        return {};
      }
    }
    throw error;
  }
}

function validateFluigEnv() {
  const requiredEnv = [
    "FLUIG_BASE_URL",
    "FLUIG_CONSUMER_KEY",
    "FLUIG_CONSUMER_SECRET",
    "FLUIG_ACCESS_TOKEN",
    "FLUIG_TOKEN_SECRET",
  ];

  const missing = requiredEnv.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Secrets obrigatorios ausentes para o deploy Fluig: ${missing.join(", ")}`,
    );
  }
}

function resolveCliPath(config) {
  const cliPath =
    process.env.FLUIG_CLI_PATH ||
    path.join(rootDir, config.cli?.outputPath || ".github/bin/fluig-cli");

  return path.isAbsolute(cliPath) ? cliPath : path.join(rootDir, cliPath);
}

async function resolveResourcePaths(resourceConfig) {
  const explicitPath = process.env.FLUIG_RESOURCE_PATH?.trim();
  if (explicitPath) {
    const fullPath = path.join(rootDir, explicitPath);
    await ensureFileExists(fullPath);
    return [normalizeRelativePath(explicitPath)];
  }

  const resourceDir = path.join(rootDir, resourceConfig.directory);
  const entries = await walkFiles(resourceDir);
  const extensions = Array.isArray(resourceConfig.extensions)
    ? resourceConfig.extensions
    : [".js"];

  return entries
    .filter((entry) => extensions.includes(path.extname(entry)))
    .map((entry) => normalizeRelativePath(path.relative(rootDir, entry)))
    .sort((left, right) => left.localeCompare(right));
}

async function walkFiles(dirPath) {
  try {
    const items = await readdir(dirPath, { withFileTypes: true });
    const nested = await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          return walkFiles(itemPath);
        }
        if (item.isFile()) {
          return [itemPath];
        }
        return [];
      }),
    );
    return nested.flat();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") {
        return [];
      }
    }
    throw error;
  }
}

async function ensureFileExists(filePath) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error(`O caminho informado nao e um arquivo: ${filePath}`);
  }
}

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function interpolateTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in values)) {
      return match;
    }
    return values[key];
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

async function runCommand(command, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn("bash", ["-lc", command], {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Comando falhou com codigo ${code}`));
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
