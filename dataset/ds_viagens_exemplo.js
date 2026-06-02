function createDataset(fields, constraints, sortFields) {
  var dataset = DatasetBuilder.newDataset();

  dataset.addColumn("destino");
  dataset.addColumn("status");

  dataset.addRow(["Sao Paulo", "ativo"]);

  return dataset;
}
