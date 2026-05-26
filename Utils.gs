

function toDirectLink(url) {
  if (!url) return "";
  const strUrl = url.toString().trim();
  
  // 1. Si es un link de Google Drive, creamos el thumbnail seguro
  const match = strUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w1000";
  }
  
  // 2. VALIDACIÓN DE SEGURIDAD (Lista Blanca de Protocolos)
  // Solo permitimos URLs estándar. Bloqueamos javascript:, vbscript:, data:, etc.
  const isSafeUrl = strUrl.startsWith("http://") || strUrl.startsWith("https://");
  
  if (isSafeUrl) {
    return strUrl;
  }
  
  // 3. Si es un enlace malicioso o no reconocido, devolvemos un marcador inofensivo
  console.log("⚠️ Enlace bloqueado por seguridad: " + strUrl);
  return "#"; 
}

function saveChunkedCache(key, stringValue) {
  const props = PropertiesService.getScriptProperties();
  
  // 1. Limpiamos versiones viejas de esta memoria
  let i = 0;
  while (props.getProperty(key + '_' + i)) {
    props.deleteProperty(key + '_' + i);
    i++;
  }
  
  // 2. Cortamos y guardamos en bloques seguros de 8000 caracteres
  const chunkSize = 8000;
  for (let j = 0; j < stringValue.length; j += chunkSize) {
    props.setProperty(key + '_' + (j / chunkSize), stringValue.substring(j, j + chunkSize));
  }
}

function readChunkedCache(key) {
  const props = PropertiesService.getScriptProperties();
  let result = '';
  let i = 0;
  let chunk = props.getProperty(key + '_' + i);
  
  if (!chunk) return null; // Si no existe, devuelve nulo
  
  // Pegamos los bloques
  while (chunk) {
    result += chunk;
    i++;
    chunk = props.getProperty(key + '_' + i);
  }
  return result;
}

function logContradiction(query, details) {
  const sheet = SpreadsheetApp.openById(DATABASES.KNOWLEDGE_DB.id).getSheetByName("CONTRADICTIONS_LOG");
  if (sheet) {
    sheet.appendRow([new Date(), query, details, "Automatically logged by Gemini"]);
  }
}