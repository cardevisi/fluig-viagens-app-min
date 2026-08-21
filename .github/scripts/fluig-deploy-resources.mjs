import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export async function listResourceFilesForDeploy({
  workspaceRootDir,
  resourceSettings,
  env = process.env,
}) {
  const singleResourcePath = env.FLUIG_RESOURCE_PATH?.trim();

  if (singleResourcePath) {
    const absoluteResourcePath = path.join(
      workspaceRootDir,
      singleResourcePath,
    );
    await assertFileExists(absoluteResourcePath);
    return [toPosixRelativePath(singleResourcePath)];
  }

  const resourcesDirectory = path.join(
    workspaceRootDir,
    resourceSettings.directory,
  );
  const allowedExtensions = Array.isArray(resourceSettings.extensions)
    ? resourceSettings.extensions
    : [".js"];
  const discoveredFiles = await listFilesRecursively(resourcesDirectory);

  return discoveredFiles
    .filter((filePath) => allowedExtensions.includes(path.extname(filePath)))
    .map((filePath) =>
      toPosixRelativePath(path.relative(workspaceRootDir, filePath)),
    )
    .sort((leftPath, rightPath) => leftPath.localeCompare(rightPath));
}

export function toFluigResourceName(resourcePath) {
  // Os arquivos seguem kebab-case no repositório, mas o nome lógico do recurso
  // continua com `_` para preservar compatibilidade com o padrão já usado no Fluig.
  return path
    .basename(resourcePath, path.extname(resourcePath))
    .replace(/-/g, "_");
}

async function listFilesRecursively(directoryPath) {
  try {
    const directoryEntries = await readdir(directoryPath, {
      withFileTypes: true,
    });
    const nestedResults = await Promise.all(
      directoryEntries.map(async (directoryEntry) => {
        const entryPath = path.join(directoryPath, directoryEntry.name);

        if (directoryEntry.isDirectory()) {
          return listFilesRecursively(entryPath);
        }

        if (directoryEntry.isFile()) {
          return [entryPath];
        }

        return [];
      }),
    );

    return nestedResults.flat();
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function assertFileExists(filePath) {
  const fileStats = await stat(filePath);

  if (!fileStats.isFile()) {
    throw new Error(`O caminho informado nao e um arquivo: ${filePath}`);
  }
}

function toPosixRelativePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isMissingFileError(error) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
