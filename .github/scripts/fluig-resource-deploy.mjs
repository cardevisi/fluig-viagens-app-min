#!/usr/bin/env node

import process from "node:process";
import {
  authenticateFluigCli,
  buildFluigServerConnection,
  createResourceDeployCommand,
  ensureRequiredDeployEnvironment,
  executeShellCommand,
  getResourceSettings,
  getSelectedResourceType,
  getWorkspaceRootDir,
  isDryRunEnabled,
  listResourceFilesForDeploy,
  printDeploySummary,
  readFluigProjectConfig,
  resolveDeployCommandTemplate,
  resolveFluigCliBinaryPath,
} from "./fluig-deploy-utils.mjs";

// Este arquivo existe para deixar a história principal do deploy fácil de seguir:
// 1. carregar configuração
// 2. validar ambiente
// 3. descobrir os arquivos
// 4. autenticar o CLI
// 5. publicar cada recurso
async function main() {
  const workspaceRootDir = getWorkspaceRootDir();
  const fluigProjectConfig = await readFluigProjectConfig(workspaceRootDir);
  const dryRunEnabled = isDryRunEnabled();

  ensureRequiredDeployEnvironment({ dryRunEnabled });

  const resourceType = getSelectedResourceType({ fluigProjectConfig });
  const resourceSettings = getResourceSettings({
    fluigProjectConfig,
    resourceType,
  });
  const cliBinaryPath = resolveFluigCliBinaryPath({
    workspaceRootDir,
    fluigProjectConfig,
  });
  const deployCommandTemplate = resolveDeployCommandTemplate({
    fluigProjectConfig,
  });
  const resourceFiles = await listResourceFilesForDeploy({
    workspaceRootDir,
    resourceSettings,
  });

  if (resourceFiles.length === 0) {
    console.log(`Nenhum recurso encontrado para ${resourceType}.`);
    return;
  }

  const fluigServerConnection = buildFluigServerConnection({
    workspaceRootDir,
    fluigProjectConfig,
  });

  printDeploySummary({
    projectName: fluigProjectConfig.name || "fluig-ci",
    resourceType,
    cliBinaryPath,
    fluigServerConnection,
    resourceFiles,
  });

  await authenticateFluigCli({
    cliBinaryPath,
    fluigServerConnection,
    dryRunEnabled,
    workingDirectory: workspaceRootDir,
  });

  for (const resourcePath of resourceFiles) {
    const deployCommand = createResourceDeployCommand({
      cliBinaryPath,
      deployCommandTemplate,
      resourcePath,
      resourceType,
      workspaceRootDir,
      cliServerName: fluigServerConnection.serverName,
    });

    console.log(`\nDeploy: ${resourcePath}`);
    console.log(`Comando: ${deployCommand}`);

    if (dryRunEnabled) {
      continue;
    }

    await executeShellCommand(deployCommand, workspaceRootDir);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
