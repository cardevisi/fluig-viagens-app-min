#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const workspace = process.cwd();
const cliPath = process.env.FLUIG_CLI_PATH || "/usr/local/bin/fluig";

async function main() {
  const config = await readConfig();
  const datasets = await resolveDatasets();

  if (datasets.length === 0) {
    console.log("Nenhum dataset para deploy.");
    return;
  }

  const connection = getConnection(config);

  console.log(`Datasets selecionados: ${datasets.length}`);
  for (const dataset of datasets) {
    console.log(`- ${dataset}`);
  }

  await runCli([
    "servers",
    "create",
    "--server-name",
    connection.serverName,
    "--host",
    connection.host,
    ...(connection.ssl ? ["--ssl"] : []),
    "--port",
    connection.port,
    "--username",
    connection.username,
    "--password",
    connection.password,
  ]);

  await runCli([
    "auth",
    "login",
    "--server-name",
    connection.serverName,
    "--username",
    connection.username,
    "--password",
    connection.password,
  ]);

  for (const dataset of datasets) {
    const resourceName = path.basename(dataset, ".js");
    console.log(`\nDeploy: ${dataset}`);
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
}

async function readConfig() {
  const file = await readFile(path.join(workspace, "fluig.json"), "utf8");
  return JSON.parse(file);
}

function getConnection(config) {
  const baseUrl = process.env.FLUIG_BASE_URL?.trim();
  const username = process.env.FLUIG_USERNAME?.trim();
  const password = process.env.FLUIG_PASSWORD?.trim();

  if (!baseUrl || !username || !password) {
    throw new Error("Defina FLUIG_BASE_URL, FLUIG_USERNAME e FLUIG_PASSWORD.");
  }

  const url = new URL(baseUrl);
  const baseName =
    process.env.FLUIG_SERVER_NAME?.trim() ||
    config.cli?.serverName ||
    config.name ||
    "fluig-ci";

  return {
    host: url.hostname,
    port: url.port || (url.protocol === "https:" ? "443" : "80"),
    ssl: url.protocol === "https:",
    username,
    password,
    serverName: `${sanitize(baseName)}${process.env.GITHUB_RUN_ID ? `-${process.env.GITHUB_RUN_ID}` : ""}`,
  };
}

async function resolveDatasets() {
  const selected = splitDatasetList(process.env.FLUIG_DATASET_PATHS || "");
  if (selected.length > 0) {
    return selected.sort();
  }

  return listDatasets(path.join(workspace, "datasets"));
}

async function listDatasets(dir, baseDir = dir) {
  let entries = [];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listDatasets(fullPath, baseDir)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path.relative(workspace, fullPath).split(path.sep).join("/"));
    }
  }

  return files.sort();
}

function splitDatasetList(value) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.startsWith("datasets/") && item.endsWith(".js"));
}

function sanitize(value) {
  return (
    String(value)
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-") || "fluig-ci"
  );
}

async function runCli(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(cliPath, args, {
      cwd: workspace,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Comando falhou com codigo ${code}.`));
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
