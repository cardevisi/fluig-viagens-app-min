import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";

import {
  createResourceDeployCommand,
  buildFluigServerConnection,
  ensureRequiredDeployEnvironment,
  getSelectedResourceType,
  isDryRunEnabled,
  listResourceFilesForDeploy,
  resolveDeployCommandTemplate,
  resolveFluigCliBinaryPath,
} from "../../.github/scripts/fluig-deploy-utils.mjs";

test("ensureRequiredDeployEnvironment exige credenciais fora do dry-run", () => {
  assert.throws(
    () =>
      ensureRequiredDeployEnvironment({
        dryRunEnabled: false,
        env: {
          FLUIG_BASE_URL: "https://fluig.example.com",
        },
      }),
    /FLUIG_USERNAME, FLUIG_PASSWORD/,
  );
});

test("isDryRunEnabled interpreta a env corretamente", () => {
  assert.equal(isDryRunEnabled({ FLUIG_DRY_RUN: "true" }), true);
  assert.equal(isDryRunEnabled({ FLUIG_DRY_RUN: "false" }), false);
});

test("buildFluigServerConnection deriva host, porta, ssl e nome do servidor", () => {
  const fluigServerConnection = buildFluigServerConnection({
    workspaceRootDir: "/tmp/fluig-viagens-app",
    fluigProjectConfig: {
      name: "fluig-viagens-app",
      cli: { serverName: "Servidor Aula" },
    },
    env: {
      FLUIG_BASE_URL: "https://fluig.example.com",
      FLUIG_USERNAME: "admin",
      FLUIG_PASSWORD: "123",
      GITHUB_RUN_ID: "55",
    },
  });

  assert.deepEqual(fluigServerConnection, {
    host: "fluig.example.com",
    port: "443",
    ssl: true,
    serverName: "Servidor-Aula-55",
    username: "admin",
    password: "123",
  });
});

test("resolveFluigCliBinaryPath prioriza env e normaliza caminho relativo do fluig.json", () => {
  assert.equal(
    resolveFluigCliBinaryPath({
      workspaceRootDir: "/workspace/app",
      fluigProjectConfig: { cli: { outputPath: ".github/bin/fluig-cli" } },
      env: {},
    }),
    "/workspace/app/.github/bin/fluig-cli",
  );

  assert.equal(
    resolveFluigCliBinaryPath({
      workspaceRootDir: "/workspace/app",
      fluigProjectConfig: { cli: { outputPath: ".github/bin/fluig-cli" } },
      env: { FLUIG_CLI_PATH: "/custom/fluig-cli" },
    }),
    "/custom/fluig-cli",
  );
});

test("getSelectedResourceType e resolveDeployCommandTemplate usam env antes do fluig.json", () => {
  const fluigProjectConfig = {
    deploy: {
      defaultResourceType: "dataset",
      commandTemplate: "export resource --serverName {{serverName}}",
    },
  };

  assert.equal(
    getSelectedResourceType({
      fluigProjectConfig,
      env: { FLUIG_RESOURCE_TYPE: "form" },
    }),
    "form",
  );

  assert.equal(
    resolveDeployCommandTemplate({
      fluigProjectConfig,
      env: { FLUIG_DEPLOY_COMMAND_TEMPLATE: "custom {{resourceName}}" },
    }),
    "custom {{resourceName}}",
  );
});

test("listResourceFilesForDeploy lista arquivos suportados em ordem alfabetica", async () => {
  const workspaceRootDir = await mkdtemp(path.join(os.tmpdir(), "fluig-deploy-"));
  await mkdir(path.join(workspaceRootDir, "datasets", "nested"), {
    recursive: true,
  });
  await writeFile(path.join(workspaceRootDir, "datasets", "b.js"), "");
  await writeFile(path.join(workspaceRootDir, "datasets", "a.js"), "");
  await writeFile(path.join(workspaceRootDir, "datasets", "nested", "c.js"), "");
  await writeFile(path.join(workspaceRootDir, "datasets", "ignore.txt"), "");

  const resourceFiles = await listResourceFilesForDeploy({
    workspaceRootDir,
    resourceSettings: {
      directory: "datasets",
      extensions: [".js"],
    },
    env: {},
  });

  assert.deepEqual(resourceFiles, [
    "datasets/a.js",
    "datasets/b.js",
    "datasets/nested/c.js",
  ]);
});

test("createResourceDeployCommand monta o comando do CLI com placeholders preenchidos", () => {
  const deployCommand = createResourceDeployCommand({
    cliBinaryPath: "/workspace/.github/bin/fluig-cli",
    deployCommandTemplate:
      "export resource --projectPath {{projectRoot}} --resourceType {{resourceType}} --resourceName {{resourceName}} --serverName {{serverName}}",
    resourcePath: "datasets/ds-viagens-paises.js",
    resourceType: "dataset",
    workspaceRootDir: "/workspace/app",
    cliServerName: "fluig-ci-99",
  });

  assert.equal(
    deployCommand,
    "'/workspace/.github/bin/fluig-cli' export resource --projectPath '/workspace/app' --resourceType 'dataset' --resourceName 'ds_viagens_paises' --serverName 'fluig-ci-99'",
  );
});
