"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");
const datasetsDir = path.join(projectRoot, "datasets");

// Este teste funciona como uma rede de proteção genérica:
// ele percorre todos os datasets do projeto e valida um contrato mínimo
// para evitar que um script inválido siga para o pipeline.
test("todos os datasets atendem ao contrato minimo", async (t) => {
  const datasetFiles = listDatasetFiles(datasetsDir);

  assert.notEqual(datasetFiles.length, 0);

  for (const relativePath of datasetFiles) {
    await t.test(relativePath, () => {
      // Cada dataset é carregado em sandbox para simular o runtime do Fluig
      // sem depender de um servidor real durante os testes locais.
      const dataset = loadDataset(relativePath);
      const columns = dataset.getColumns();
      const rows = dataset.getRows();

      // O contrato mínimo garante que todo dataset exponha colunas e linhas válidas.
      assert.ok(Array.isArray(columns));
      assert.ok(Array.isArray(rows));
      assert.notEqual(columns.length, 0);

      const columnNames = columns.map((column) => column.name);
      assert.equal(new Set(columnNames).size, columnNames.length);

      // Cada linha precisa respeitar a mesma quantidade de colunas declaradas.
      for (const row of rows) {
        assert.equal(row.length, columns.length);
      }

      // Regras específicas ficam concentradas aqui quando um dataset
      // precisa de validações além do contrato genérico.
      if (relativePath === "datasets/ds-viagens-paises.js") {
        assert.deepEqual(columnNames, ["codigo", "nome", "sigla"]);
        assert.equal(rows.length, 20);
        assert.deepEqual(Array.from(rows.find((row) => row[0] === "BRA")), [
          "BRA",
          "Brasil",
          "BR",
        ]);
      }
    });
  }
});

// Lista recursivamente todos os arquivos .js da pasta datasets
// para que qualquer novo recurso já entre automaticamente no teste.
function listDatasetFiles(dir, root = projectRoot) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listDatasetFiles(fullPath, root);
      }

      if (entry.isFile() && entry.name.endsWith(".js")) {
        return [path.relative(root, fullPath).split(path.sep).join("/")];
      }

      return [];
    })
    .sort();
}

// Carrega o script do dataset em um contexto isolado com mocks
// das APIs globais que o Fluig fornece em produção.
function loadDataset(relativePath) {
  const code = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  const sandbox = {
    console,
    DatasetFieldType: { STRING: "STRING" },
    DatasetBuilder: {
      // Este mock implementa apenas o comportamento necessário
      // para os datasets deste projeto serem testados em Node.js.
      newDataset() {
        const columns = [];
        const rows = [];

        return {
          addColumn(name, type) {
            columns.push({ name, type });
          },
          addRow(values) {
            rows.push(values);
          },
          getColumns() {
            return columns;
          },
          getRows() {
            return rows;
          },
        };
      },
    },
  };

  // Executa o arquivo exatamente como o Fluig faria: o script popula
  // o sandbox com a função createDataset, que depois é chamada no teste.
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, {
    filename: path.join(projectRoot, relativePath),
  });

  assert.equal(typeof sandbox.createDataset, "function");
  return sandbox.createDataset([], [], []);
}
