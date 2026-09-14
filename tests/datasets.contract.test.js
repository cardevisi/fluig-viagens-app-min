"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");
const datasetsDir = path.join(projectRoot, "datasets");

test("todos os datasets atendem ao contrato minimo", async (t) => {
  const datasetFiles = listDatasetFiles(datasetsDir);

  assert.notEqual(datasetFiles.length, 0);

  for (const relativePath of datasetFiles) {
    await t.test(relativePath, () => {
      const dataset = loadDataset(relativePath);
      const columns = dataset.getColumns();
      const rows = dataset.getRows();

      assert.ok(Array.isArray(columns));
      assert.ok(Array.isArray(rows));
      assert.notEqual(columns.length, 0);

      const columnNames = columns.map((column) => column.name);
      assert.equal(new Set(columnNames).size, columnNames.length);

      for (const row of rows) {
        assert.equal(row.length, columns.length);
      }

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

function loadDataset(relativePath) {
  const code = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  const sandbox = {
    console,
    DatasetFieldType: { STRING: "STRING" },
    DatasetBuilder: {
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

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, {
    filename: path.join(projectRoot, relativePath),
  });

  assert.equal(typeof sandbox.createDataset, "function");
  return sandbox.createDataset();
}
