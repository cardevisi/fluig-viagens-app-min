/**
 * Dataset Fluig para listagem de países
 * Retorna uma lista padrão de países com código e nome para uso em componentes
 */
function createDataset() {
  var dataset = DatasetBuilder.newDataset();

  // Define as colunas do dataset
  dataset.addColumn("codigo", DatasetFieldType.STRING);
  dataset.addColumn("nome", DatasetFieldType.STRING);
  dataset.addColumn("sigla", DatasetFieldType.STRING);

  // Lista de países (padrão com os principais, pode ser expandida conforme necessidade)
  var paises = [
    { codigo: "BRA", nome: "Brasil", sigla: "BR" },
    { codigo: "USA", nome: "Estados Unidos", sigla: "US" },
    { codigo: "ARG", nome: "Argentina", sigla: "AR" },
    { codigo: "CHL", nome: "Chile", sigla: "CL" },
    { codigo: "URY", nome: "Uruguai", sigla: "UY" },
    { codigo: "PRY", nome: "Paraguai", sigla: "PY" },
    { codigo: "BOL", nome: "Bolívia", sigla: "BO" },
    { codigo: "PER", nome: "Peru", sigla: "PE" },
    { codigo: "COL", nome: "Colômbia", sigla: "CO" },
    { codigo: "VEN", nome: "Venezuela", sigla: "VE" },
    { codigo: "MEX", nome: "México", sigla: "MX" },
    { codigo: "DEU", nome: "Alemanha", sigla: "DE" },
    { codigo: "ESP", nome: "Espanha", sigla: "ES" },
    { codigo: "PRT", nome: "Portugal", sigla: "PT" },
    { codigo: "FRA", nome: "França", sigla: "FR" },
    { codigo: "ITA", nome: "Itália", sigla: "IT" },
    { codigo: "GBR", nome: "Reino Unido", sigla: "GB" },
    { codigo: "JPN", nome: "Japão", sigla: "JP" },
    { codigo: "CHN", nome: "China", sigla: "CN" },
    { codigo: "AUS", nome: "Austrália", sigla: "AU" },
  ];

  // Adiciona cada país como uma linha no dataset
  for (var i = 0; i < paises.length; i++) {
    var pais = paises[i];
    dataset.addRow([pais.codigo, pais.nome, pais.sigla]);
  }

  console.log("Dataset de países criado com " + paises.length + " registros.");
  console.log("Exemplo de país adicionado: " + paises[0].nome + " (" + paises[0].codigo + ")");

  return dataset;
}
