"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  createDatasetBuilderMock,
  createDatasetFieldTypeMock,
} = require("./fluig-mocks");

const projectRoot = path.join(__dirname, "..", "..");

/**
 * Carrega e executa um script de dataset Fluig em um sandbox isolado,
 * injetando as globais (DatasetBuilder, DatasetFieldType, console) que
 * o runtime Fluig normalmente disponibiliza.
 *
 * @param {string} relativePath Caminho relativo ao projeto (ex.: "datasets/ds-viagens-paises.js")
 * @returns {vm.Context} sandbox contendo as funções/variáveis declaradas pelo script
 */
function loadDatasetScript(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  const code = fs.readFileSync(absolutePath, "utf8");

  const sandbox = {
    DatasetBuilder: createDatasetBuilderMock(),
    DatasetFieldType: createDatasetFieldTypeMock(),
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: absolutePath });

  return sandbox;
}

module.exports = { loadDatasetScript };
