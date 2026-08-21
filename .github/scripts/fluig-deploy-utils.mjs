// Fachada de compatibilidade para o deploy Fluig.
// O fluxo principal continua importando deste arquivo, mas as responsabilidades
// agora ficam separadas em módulos menores para facilitar leitura e manutenção.

export {
  ensureRequiredDeployEnvironment,
  getResourceSettings,
  getSelectedResourceType,
  getWorkspaceRootDir,
  isDryRunEnabled,
  readFluigProjectConfig,
  resolveDeployCommandTemplate,
  resolveFluigCliBinaryPath,
} from "./fluig-deploy-config.mjs";

export {
  listResourceFilesForDeploy,
} from "./fluig-deploy-resources.mjs";

export {
  authenticateFluigCli,
  buildFluigServerConnection,
  createResourceDeployCommand,
  executeShellCommand,
  printDeploySummary,
} from "./fluig-deploy-cli.mjs";
