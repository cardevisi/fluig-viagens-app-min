// Assinatura padrão de datasets no Fluig:
// - fields: colunas solicitadas pela consulta
// - constraints: filtros recebidos na chamada
// - sortFields: campos pedidos para ordenação
// Neste exemplo, os três parâmetros existem por compatibilidade com o contrato,
// mas o dataset devolve sempre a mesma lista fixa de países.
function createDataset(fields, constraints, sortFields) {
  void fields;
  void constraints;
  void sortFields;

  var ds = DatasetBuilder.newDataset();
  // A estrutura abaixo centraliza os dados fixos que serão expostos
  // pelo dataset para consumo em formulários e interfaces do Fluig.
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

  // Define o contrato de saída do dataset: cada linha precisa seguir
  // exatamente esta ordem para manter compatibilidade com o consumo.
  ds.addColumn("codigo", DatasetFieldType.STRING);
  ds.addColumn("nome", DatasetFieldType.STRING);
  ds.addColumn("sigla", DatasetFieldType.STRING);

  // Transforma a lista em linhas do formato esperado pelo DatasetBuilder.
  for (var i = 0; i < rows.length; i++) {
    ds.addRow(rows[i]);
  }

  // Esse log ajuda a identificar a execução do dataset durante testes locais
  // ou investigações em ambientes onde o console esteja disponível.
  console.log("Dataset successfully created.");

  return ds;
}
