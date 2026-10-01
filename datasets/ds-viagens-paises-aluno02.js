function createDataset(fields, constraints, sortFields) {
  // Assinatura padrão de datasets no Fluig:
  // - fields: colunas solicitadas pela consulta
  // - constraints: filtros recebidos na chamada
  // - sortFields: campos pedidos para ordenação
  void fields;
  void constraints;
  void sortFields;

  var ds = DatasetBuilder.newDataset();
  var rows = [
    ["BRA", "Brasil", "BR"],
    ["USA", "Estados Unidos", "US"],
    ["ARG", "Argentina", "AR"],
    ["CHL", "Chile", "CL"],
    ["URY", "Uruguai", "UY"],
    ["PRY", "Paraguai", "PY"],
    ["BOL", "Bolívia", "BO"],
    ["PER", "Peru", "PE"],
    ["COL", "Colômbia", "CO"],
    ["VEN", "Venezuela", "VE"],
    ["MEX", "México", "MX"],
    ["DEU", "Alemanha", "DE"],
    ["ESP", "Espanha", "ES"],
    ["PRT", "Portugal", "PT"],
    ["FRA", "França", "FR"],
    ["ITA", "Itália", "IT"],
    ["GBR", "Reino Unido", "GB"],
    ["JPN", "Japão", "JP"],
    ["CHN", "China", "CN"],
    ["AUS", "Austrália", "AU"],
  ];

  ds.addColumn("codigo");
  ds.addColumn("nome");
  ds.addColumn("sigla");

  for (var i = 0; i < rows.length; i++) {
    ds.addRow(rows[i]);
  }

  return ds;
}