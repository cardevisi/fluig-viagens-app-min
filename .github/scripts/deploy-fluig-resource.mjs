#!/usr/bin/env node

/**
 * deploy-fluig-resource.mjs
 *
 * Script de deploy automatizado de recursos Fluig via GitHub Actions.
 *
 * Funcionamento geral:
 *  1. Lê as configurações do projeto em fluig.json.
 *  2. Valida as variáveis de ambiente obrigatórias (URL, credenciais).
 *  3. Descobre quais arquivos de recurso devem ser publicados (datasets, formulários, etc.).
 *  4. Registra e autentica o servidor no Fluig CLI.
 *  5. Para cada arquivo encontrado, executa o comando de deploy configurado pelo template.
 *
 * Variáveis de ambiente reconhecidas:
 *  - FLUIG_BASE_URL              URL base do servidor Fluig (obrigatória)
 *  - FLUIG_USERNAME              Usuário de autenticação (obrigatória, exceto em dry-run)
 *  - FLUIG_PASSWORD              Senha de autenticação (obrigatória, exceto em dry-run)
 *  - FLUIG_RESOURCE_TYPE         Tipo de recurso a publicar (padrão: "dataset")
 *  - FLUIG_RESOURCE_PATH         Caminho de um único arquivo a publicar (opcional)
 *  - FLUIG_DEPLOY_COMMAND_TEMPLATE Template do comando de deploy com placeholders {{variavel}}
 *  - FLUIG_CLI_PATH              Caminho para o binário do Fluig CLI (opcional)
 *  - FLUIG_SERVER_NAME           Nome do servidor no CLI (opcional)
 *  - FLUIG_DRY_RUN               Se "true", apenas exibe os comandos sem executá-los
 *  - GITHUB_WORKSPACE            Diretório raiz do repositório (definido automaticamente pelo Actions)
 *  - GITHUB_RUN_ID               ID da execução do workflow (usado como sufixo no nome do servidor)
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

// Diretório raiz: usa o workspace do GitHub Actions ou o diretório de trabalho atual.
const rootDir = process.env.GITHUB_WORKSPACE || process.cwd();

// Caminho esperado para o arquivo de configuração do projeto Fluig.
const configPath = path.join(rootDir, "fluig.json");

/**
 * Orquestra todo o processo de deploy:
 * carrega config → valida env → resolve arquivos → autentica CLI → executa deploy de cada arquivo.
 */
async function main() {
  // Lê o fluig.json do projeto (ou retorna objeto vazio se não existir).
  const config = await loadConfig();

  // Modo de simulação: apenas exibe os comandos sem executá-los de verdade.
  const dryRun = String(process.env.FLUIG_DRY_RUN || "false") === "true";

  // Garante que as variáveis de ambiente mínimas estão presentes.
  validateFluigEnv(dryRun);

  // Tipo de recurso a publicar: env > fluig.json > padrão "dataset".
  const resourceType =
    process.env.FLUIG_RESOURCE_TYPE ||
    config.deploy?.defaultResourceType ||
    "dataset";

  // Obtém a configuração do tipo de recurso (diretório, extensões, etc.) do fluig.json.
  const resourceConfig = config.resources?.[resourceType];
  if (!resourceConfig?.directory) {
    throw new Error(
      `Tipo de recurso sem configuracao em fluig.json: ${resourceType}`,
    );
  }

  // Resolve o caminho absoluto do binário do Fluig CLI.
  const cliPath = resolveCliPath(config);

  // Template do comando de deploy com placeholders, ex.: "dataset export {{resource}}".
  // Pode ser definido via env ou fluig.json.
  const commandTemplate =
    process.env.FLUIG_DEPLOY_COMMAND_TEMPLATE ||
    config.deploy?.commandTemplate ||
    "";

  if (!commandTemplate.trim()) {
    throw new Error(
      "FLUIG_DEPLOY_COMMAND_TEMPLATE nao definido. Configure a repo variable ou fluig.json > deploy.commandTemplate.",
    );
  }

  // Descobre todos os arquivos a publicar (um path explícito ou todos do diretório configurado).
  const resourcePaths = await resolveResourcePaths(resourceConfig);
  if (resourcePaths.length === 0) {
    console.log(`Nenhum recurso encontrado para ${resourceType}.`);
    return;
  }

  // Monta as configurações de conexão com o servidor Fluig a partir das envs.
  const serverConfig = resolveServerConfig(config);

  // Exibe resumo da execução antes de iniciar o deploy.
  console.log(`Projeto: ${config.name || path.basename(rootDir)}`);
  console.log(`Tipo de recurso: ${resourceType}`);
  console.log(`CLI: ${cliPath}`);
  console.log(
    `Servidor CLI: ${serverConfig.serverName} (${serverConfig.host}:${serverConfig.port}, ssl=${serverConfig.ssl})`,
  );
  console.log(`Arquivos selecionados: ${resourcePaths.length}`);

  // Registra o servidor e faz login no Fluig CLI antes de iniciar os deploys.
  await ensureCliAuthenticated(cliPath, serverConfig, dryRun);

  // Itera sobre cada arquivo de recurso e executa o comando de deploy.
  for (const resourcePath of resourcePaths) {
    const absolutePath = path.join(rootDir, resourcePath);

    // Nome do arquivo sem extensão, usado como identificador do recurso no Fluig.
    const resourceName = path.basename(
      resourcePath,
      path.extname(resourcePath),
    );

    // Substitui os placeholders {{variavel}} no template pelo valor real com escape de shell.
    const args = interpolateTemplate(commandTemplate, {
      resource: shellQuote(resourcePath),
      resourceAbsolute: shellQuote(absolutePath),
      resourceName: shellQuote(resourceName),
      resourceType: shellQuote(resourceType),
      projectRoot: shellQuote(rootDir),
      serverName: shellQuote(serverConfig.serverName),
    });
    const command = `${shellQuote(cliPath)} ${args}`;

    console.log(`\nDeploy: ${resourcePath}`);
    console.log(`Comando: ${command}`);

    // Em dry-run, apenas loga o comando sem executá-lo.
    if (dryRun) {
      continue;
    }

    // Executa o comando via bash e aguarda o término.
    await runCommand(command, rootDir);
  }
}

/**
 * Lê e faz o parse do fluig.json.
 * Retorna um objeto vazio se o arquivo não existir (ENOENT).
 * Lança erro para qualquer outro problema de leitura ou JSON inválido.
 */
async function loadConfig() {
  try {
    const raw = await readFile(configPath, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") {
        // Arquivo não encontrado: prossegue com configuração vazia.
        return {};
      }
    }
    throw error;
  }
}

/**
 * Verifica se as variáveis de ambiente obrigatórias estão definidas.
 * Em modo dry-run, as credenciais (username/password) não são exigidas,
 * pois nenhum comando real será executado.
 */
function validateFluigEnv(dryRun) {
  const requiredEnv = ["FLUIG_BASE_URL"];
  if (!dryRun) {
    requiredEnv.push("FLUIG_USERNAME", "FLUIG_PASSWORD");
  }

  const missing = requiredEnv.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Secrets obrigatorios ausentes para o deploy Fluig: ${missing.join(", ")}`,
    );
  }
}

/**
 * Resolve o caminho absoluto do binário do Fluig CLI.
 * Prioridade: env FLUIG_CLI_PATH > fluig.json (cli.outputPath) > padrão ".github/bin/fluig-cli".
 * Garante sempre um caminho absoluto, mesmo que a config forneça um relativo.
 */
function resolveCliPath(config) {
  const cliPath =
    process.env.FLUIG_CLI_PATH ||
    path.join(rootDir, config.cli?.outputPath || ".github/bin/fluig-cli");

  return path.isAbsolute(cliPath) ? cliPath : path.join(rootDir, cliPath);
}

/**
 * Monta o objeto de configuração do servidor Fluig a partir das variáveis de ambiente.
 *
 * - Extrai host, porta e protocolo (ssl) da FLUIG_BASE_URL.
 * - Constrói o nome do servidor: env FLUIG_SERVER_NAME > fluig.json > nome do projeto > "fluig-ci".
 * - Adiciona o GITHUB_RUN_ID como sufixo para garantir unicidade entre execuções paralelas.
 */
function resolveServerConfig(config) {
  const baseUrl = process.env.FLUIG_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("FLUIG_BASE_URL nao definido.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error(`FLUIG_BASE_URL invalido: ${baseUrl}`);
  }

  if (!parsedUrl.hostname) {
    throw new Error(`FLUIG_BASE_URL sem host valido: ${baseUrl}`);
  }

  const explicitServerName =
    process.env.FLUIG_SERVER_NAME?.trim() || config.cli?.serverName || "";
  const baseServerName =
    explicitServerName ||
    config.name ||
    path.basename(rootDir) ||
    "fluig-ci";

  // Sufixo com o ID da run do GitHub Actions para evitar colisões entre deploys simultâneos.
  const runSuffix = process.env.GITHUB_RUN_ID
    ? `-${process.env.GITHUB_RUN_ID}`
    : "";

  return {
    host: parsedUrl.hostname,
    // Usa a porta da URL, ou 443/80 como padrão conforme o protocolo.
    port:
      parsedUrl.port ||
      (parsedUrl.protocol === "https:" ? String(443) : String(80)),
    ssl: parsedUrl.protocol === "https:",
    serverName: sanitizeServerName(`${baseServerName}${runSuffix}`),
    username: process.env.FLUIG_USERNAME?.trim() || "",
    password: process.env.FLUIG_PASSWORD?.trim() || "",
  };
}

/**
 * Normaliza o nome do servidor para uso no Fluig CLI.
 * Remove caracteres não permitidos, substituindo-os por hífens,
 * e elimina hífens nas extremidades. Retorna "fluig-ci" se o resultado estiver vazio.
 */
function sanitizeServerName(value) {
  const normalized = String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "fluig-ci";
}

/**
 * Registra o servidor no Fluig CLI e realiza o login antes dos deploys.
 *
 * Executa dois comandos do CLI:
 *  1. `servers create` — cadastra o servidor com host, porta e credenciais.
 *  2. `auth login`     — autentica na sessão do servidor recém-criado.
 *
 * Em dry-run, apenas imprime os comandos (com a senha ocultada) sem executá-los.
 * A flag --ssl é inserida condicionalmente quando o servidor usa HTTPS.
 */
async function ensureCliAuthenticated(cliPath, serverConfig, dryRun) {
  const createServerArgs = [
    "servers",
    "create",
    "--server-name",
    serverConfig.serverName,
    "--host",
    serverConfig.host,
    "--port",
    String(serverConfig.port),
    "--username",
    serverConfig.username,
    "--password",
    serverConfig.password,
  ];

  // Insere --ssl na posição correta quando o protocolo for HTTPS.
  if (serverConfig.ssl) {
    createServerArgs.splice(6, 0, "--ssl");
  }

  const loginArgs = [
    "auth",
    "login",
    "--server-name",
    serverConfig.serverName,
    "--username",
    serverConfig.username,
    "--password",
    serverConfig.password,
  ];

  console.log("Preparando servidor do Fluig CLI.");
  if (dryRun) {
    // Exibe os comandos sem executar; a senha é substituída por "***" para não vazar no log.
    console.log(
      `Comando (dry-run): ${buildCliCommand(cliPath, redactArgs(createServerArgs))}`,
    );
    console.log(
      `Comando (dry-run): ${buildCliCommand(cliPath, redactArgs(loginArgs))}`,
    );
    return;
  }

  await runCommand(buildCliCommand(cliPath, createServerArgs), rootDir);
  await runCommand(buildCliCommand(cliPath, loginArgs), rootDir);
}

/**
 * Resolve a lista de caminhos relativos dos arquivos a publicar.
 *
 * Se FLUIG_RESOURCE_PATH estiver definida, publica apenas esse único arquivo.
 * Caso contrário, varre recursivamente o diretório configurado (resourceConfig.directory)
 * e filtra os arquivos pelas extensões permitidas (padrão: [".js"]).
 * A lista retornada é ordenada alfabeticamente.
 */
async function resolveResourcePaths(resourceConfig) {
  const explicitPath = process.env.FLUIG_RESOURCE_PATH?.trim();
  if (explicitPath) {
    // Publica apenas o arquivo especificado; verifica se ele existe antes de continuar.
    const fullPath = path.join(rootDir, explicitPath);
    await ensureFileExists(fullPath);
    return [normalizeRelativePath(explicitPath)];
  }

  // Varre todo o diretório de recursos recursivamente.
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

/**
 * Percorre recursivamente um diretório e retorna os caminhos absolutos de todos os arquivos.
 * Retorna array vazio se o diretório não existir (ENOENT), evitando erro em projetos
 * que ainda não possuem o diretório de recursos.
 */
async function walkFiles(dirPath) {
  try {
    const items = await readdir(dirPath, { withFileTypes: true });
    const nested = await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          // Desce recursivamente em subdiretórios.
          return walkFiles(itemPath);
        }
        if (item.isFile()) {
          return [itemPath];
        }
        // Ignora links simbólicos e outros tipos de entrada.
        return [];
      }),
    );
    return nested.flat();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") {
        // Diretório não encontrado: retorna lista vazia em vez de falhar.
        return [];
      }
    }
    throw error;
  }
}

/**
 * Garante que o caminho informado existe e é um arquivo regular.
 * Lança erro descritivo se não for encontrado ou se for um diretório.
 */
async function ensureFileExists(filePath) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error(`O caminho informado nao e um arquivo: ${filePath}`);
  }
}

/**
 * Normaliza separadores de caminho para "/" independentemente do SO.
 * Necessário para garantir consistência nos argumentos do CLI no Windows.
 */
function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join("/");
}

/**
 * Substitui placeholders no formato {{nome}} pelo valor correspondente do objeto `values`.
 * Placeholders sem correspondência são mantidos inalterados no template.
 *
 * Exemplo: interpolateTemplate("export {{resource}}", { resource: "datasets/foo.js" })
 *          → "export datasets/foo.js"
 */
function interpolateTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in values)) {
      return match;
    }
    return values[key];
  });
}

/**
 * Envolve um valor entre aspas simples e escapa aspas simples internas
 * usando a técnica de concatenação de strings shell: ' → '"'"'
 * Isso garante que qualquer valor possa ser passado com segurança como argumento de shell.
 */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

/**
 * Monta o comando completo do CLI concatenando o binário e todos os argumentos,
 * cada um devidamente escapado com shellQuote.
 */
function buildCliCommand(cliPath, args) {
  return [shellQuote(cliPath), ...args.map((arg) => shellQuote(arg))].join(" ");
}

/**
 * Retorna uma cópia dos argumentos com o valor logo após "--password" substituído por "***".
 * Usado para exibir comandos no log sem expor a senha.
 */
function redactArgs(args) {
  const redactedArgs = [...args];
  const passwordIndex = redactedArgs.findIndex((arg) => arg === "--password");
  if (passwordIndex >= 0 && passwordIndex + 1 < redactedArgs.length) {
    redactedArgs[passwordIndex + 1] = "***";
  }
  return redactedArgs;
}

/**
 * Executa um comando shell via `bash -lc` de forma assíncrona.
 * Herda stdio do processo pai (output visível no log do Actions).
 * Rejeita a Promise se o processo encerrar com código diferente de zero.
 */
async function runCommand(command, cwd) {
  await new Promise((resolve, reject) => {
    // Usa bash com -l (login shell) para garantir que o PATH do ambiente esteja disponível.
    const child = spawn("bash", ["-lc", command], {
      cwd,
      stdio: "inherit",   // Redireciona stdout/stderr para o processo pai.
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

// Ponto de entrada: executa main() e encerra o processo com código 1 em caso de erro.
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
