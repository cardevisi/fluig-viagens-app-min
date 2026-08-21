"use strict";

/**
 * Mocks mínimos das globais injetadas pelo runtime Fluig (Rhino/GraalJS)
 * para permitir a execução e o teste dos scripts de dataset em Node.js.
 */

function createDatasetFieldTypeMock() {
  return {
    STRING: "STRING",
    INT: "INT",
    LONG: "LONG",
    DOUBLE: "DOUBLE",
    DATE: "DATE",
    BOOLEAN: "BOOLEAN",
  };
}

function createDatasetBuilderMock() {
  return {
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
  };
}

module.exports = { createDatasetBuilderMock, createDatasetFieldTypeMock };
