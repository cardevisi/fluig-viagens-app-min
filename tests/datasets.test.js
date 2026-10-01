"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");
const datasetsDir = path.join(projectRoot, "datasets");

// Prefixo dos datasets de países da aula. Cobre qualquer sufixo de aluno
// (ds-viagens-paises-aluno01.js, -alunoNNN.js, ...) sem precisar editar nada.
const COUNTRIES_PREFIX = "datasets/ds-viagens-paises";
const COUNTRIES_COLUMNS = ["codigo", "nome", "sigla"];
const COUNTRIES_TOTAL = 20;

// ===========================================================================
// Cada teste abaixo segue a regra AAA:
//   Arrange  prepara o cenário (sandbox com os mocks do runtime do Fluig)
//   Act      executa a ação sob teste (rodar o script / chamar createDataset)
//   Assert   compara o resultado obtido com o esperado
// ===========================================================================

// ---------------------------------------------------------------------------
// Descoberta: garante que a suíte realmente encontrou o que precisa testar.
// Sem isso, um erro de caminho faria a suíte passar sem validar nada.
// ---------------------------------------------------------------------------
test("a pasta datasets contém datasets para testar", () => {
  // Arrange
  const datasetsPath = datasetsDir;

  // Act
  const datasetFiles = listDatasetFiles(datasetsPath);
  const countriesFiles = filterCountriesDatasets(datasetFiles);

  // Assert
  assert.notEqual(
    datasetFiles.length,
    0,
    "nenhum arquivo .js encontrado em datasets/",
  );
  assert.notEqual(
    countriesFiles.length,
    0,
    `nenhum dataset encontrado com o prefixo ${COUNTRIES_PREFIX}`,
  );
});

// ---------------------------------------------------------------------------
// Contrato genérico: vale para qualquer dataset da pasta datasets/.
// ---------------------------------------------------------------------------
test("todo dataset declara a função global createDataset", async (t) => {
  for (const relativePath of listDatasetFiles(datasetsDir)) {
    await t.test(relativePath, () => {
      // Arrange: contexto isolado com as globais que o Fluig injeta.
      const sandbox = createFluigSandbox();

      // Act: executa o script do dataset dentro desse contexto.
      runDatasetScript(relativePath, sandbox);

      // Assert: o Fluig chama uma createDataset global, então o script
      // precisa declará-la no nível superior para o deploy fazer sentido.
      assert.equal(
        typeof sandbox.createDataset,
        "function",
        `${relativePath} deve declarar a função global createDataset`,
      );
    });
  }
});

test("todo dataset devolve colunas e linhas consistentes", async (t) => {
  for (const relativePath of listDatasetFiles(datasetsDir)) {
    await t.test(relativePath, () => {
      // Arrange
      const createDataset = loadCreateDataset(relativePath);

      // Act: reproduz a chamada do Fluig com fields, constraints e sortFields
      // vazios, ou seja, a consulta mais simples possível.
      const dataset = createDataset([], [], []);
      const columns = dataset.getColumns();
      const rows = dataset.getRows();
      const columnNames = columns.map((column) => column.name);

      // Assert
      assert.ok(Array.isArray(columns), "getColumns deve devolver um array");
      assert.ok(Array.isArray(rows), "getRows deve devolver um array");
      assert.notEqual(columns.length, 0, "dataset sem colunas declaradas");
      assert.equal(
        new Set(columnNames).size,
        columnNames.length,
        `${relativePath} declara colunas com nome duplicado`,
      );

      for (const [index, row] of rows.entries()) {
        assert.equal(
          row.length,
          columns.length,
          `linha ${index} tem ${row.length} valores para ${columns.length} colunas`,
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Regra de negócio: específica dos datasets de países.
// ---------------------------------------------------------------------------
test("todo dataset de países expõe as colunas na ordem esperada", async (t) => {
  for (const relativePath of filterCountriesDatasets(
    listDatasetFiles(datasetsDir),
  )) {
    await t.test(relativePath, () => {
      // Arrange
      const createDataset = loadCreateDataset(relativePath);

      // Act
      const dataset = createDataset([], [], []);
      const columnNames = dataset
        .getColumns()
        .map((column) => column.name);

      // Assert: a ordem faz parte do contrato, não só os nomes. O Fluig
      // entrega cada linha como array posicional, sem chave: quem consome
      // (formulário, widget, zoom) lê row[0], row[1] e row[2]. Conferir
      // posição por posição aponta exatamente qual coluna saiu do lugar.
      assert.equal(columnNames[0], "codigo");
      assert.equal(columnNames[1], "nome");
      assert.equal(columnNames[2], "sigla");
      assert.equal(columnNames.length, COUNTRIES_COLUMNS.length);
    });
  }
});

test("todo dataset de países devolve a lista completa", async (t) => {
  for (const relativePath of filterCountriesDatasets(
    listDatasetFiles(datasetsDir),
  )) {
    await t.test(relativePath, () => {
      // Arrange
      const createDataset = loadCreateDataset(relativePath);

      // Act
      const rows = createDataset([], [], []).getRows();

      // Assert
      assert.equal(
        rows.length,
        COUNTRIES_TOTAL,
        `${relativePath} deve ter ${COUNTRIES_TOTAL} países`,
      );
    });
  }
});

test("todo dataset de países contém a linha do Brasil", async (t) => {
  for (const relativePath of filterCountriesDatasets(
    listDatasetFiles(datasetsDir),
  )) {
    await t.test(relativePath, () => {
      // Arrange
      const createDataset = loadCreateDataset(relativePath);

      // Act
      const rows = createDataset([], [], []).getRows();
      const brazil = rows.find((row) => row[0] === "BRA");

      // Assert
      assert.ok(brazil, `${relativePath} não tem a linha com código BRA`);
      assert.deepEqual(Array.from(brazil), ["BRA", "Brasil", "BR"]);
    });
  }
});

// ===========================================================================
// Helpers de Arrange e Act. Nenhum deles faz assert: preparar o cenário e
// validar o resultado são responsabilidades separadas.
// ===========================================================================

// Lista recursivamente todos os arquivos .js da pasta datasets
// para que qualquer novo recurso já entre automaticamente nos testes.
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

// Separa os datasets de países dos demais, para que as regras de negócio
// só sejam aplicadas a quem realmente precisa atendê-las.
function filterCountriesDatasets(datasetFiles) {
  return datasetFiles.filter((relativePath) =>
    relativePath.startsWith(COUNTRIES_PREFIX),
  );
}

// Arrange: monta o contexto com os mocks das globais que o Fluig fornece
// em produção. O mock implementa apenas o necessário para este projeto.
function createFluigSandbox() {
  return {
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
}

// Act de baixo nível: executa o arquivo exatamente como o Fluig faria.
// Por ser um script (e não um módulo), a declaração `function createDataset`
// no nível superior passa a ser propriedade do objeto global, que dentro
// do vm é o próprio sandbox.
function runDatasetScript(relativePath, sandbox) {
  const fullPath = path.join(projectRoot, relativePath);
  const code = fs.readFileSync(fullPath, "utf8");

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: fullPath });

  return sandbox;
}

// Arrange completo para os testes de comportamento: devolve a createDataset
// pronta para ser chamada no passo Act. Aqui é `throw`, e não `assert`,
// porque um cenário que não pode ser montado é falha de setup, não de
// expectativa. A existência da função é verificada em teste próprio.
function loadCreateDataset(relativePath) {
  const sandbox = runDatasetScript(relativePath, createFluigSandbox());

  if (typeof sandbox.createDataset !== "function") {
    throw new Error(
      `${relativePath} não declarou a função global createDataset. ` +
        `Use "function createDataset(...)" no nível superior do arquivo, ` +
        `sem module.exports, export ou IIFE.`,
    );
  }

  return sandbox.createDataset;
}
