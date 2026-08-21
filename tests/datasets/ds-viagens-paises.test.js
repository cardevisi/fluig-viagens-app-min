"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadDatasetScript } = require("../helpers/load-dataset-script");

test("ds-viagens-paises.js", async (t) => {
  const sandbox = loadDatasetScript("datasets/ds-viagens-paises.js");
  const dataset = sandbox.createDataset();
  const columns = dataset.getColumns();
  const rows = dataset.getRows();

  await t.test("define as colunas codigo, nome e sigla como STRING", () => {
    assert.deepEqual(
      columns.map((column) => column.name),
      ["codigo", "nome", "sigla"]
    );
    assert.equal(
      columns.every((column) => column.type === "STRING"),
      true
    );
  });

  await t.test("retorna 20 países", () => {
    assert.equal(rows.length, 20);
  });

  await t.test("cada linha possui codigo, nome e sigla preenchidos", () => {
    for (const row of rows) {
      assert.equal(row.length, 3);
      for (const value of row) {
        assert.equal(typeof value, "string");
        assert.notEqual(value.trim(), "");
      }
    }
  });

  await t.test("inclui o Brasil com os dados corretos", () => {
    const brasil = rows.find((row) => row[0] === "BRA");
    // Array.from reancora o array do sandbox (vm) no realm principal antes do deepEqual
    assert.deepEqual(Array.from(brasil), ["BRA", "Brasil", "BR"]);
  });

  await t.test("não possui códigos de país duplicados", () => {
    const codigos = rows.map((row) => row[0]);
    assert.equal(new Set(codigos).size, codigos.length);
  });
});
