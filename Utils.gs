

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

/**
 * Abre AHMG Credentialing Grid, lee MD Summary y APN Summary.
 * Retorna { payers: [], mdStatus: {}, apnStatus: {} }
 */
function buildCredentialingIndex() {
  const CACHE_KEY = 'CREDENTIALING_INDEX_CACHE';
  
  // 1. Intentar leer de caché usando tu patrón existente
  let cachedData = readChunkedCache(CACHE_KEY);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  // 2. Si no hay caché, construir el índice
  const ssId = PropertiesService.getScriptProperties().getProperty('CREDENTIALING_GRID_ID');
  if (!ssId) throw new Error("CREDENTIALING_GRID_ID no configurado.");
  
  const ss = SpreadsheetApp.openById(ssId);
  const sheetsToProcess = [
    { name: 'MD Summary', targetObj: 'mdStatus' },
    { name: 'APN Summary', targetObj: 'apnStatus' }
  ];

  let result = {
    payers: [],
    mdStatus: {},
    apnStatus: {}
  };

  let uniquePayersSet = new Set();

  sheetsToProcess.forEach(config => {
    const sheet = ss.getSheetByName(config.name);
    if (!sheet) return; // Si la hoja no existe, saltar

    const data = sheet.getDataRange().getValues();
    let payersRowIndex = -1;
    let actionItemRowIndex = -1;

    // Buscar "Payers" y "Action Item" en la columna A
    for (let i = 0; i < data.length; i++) {
      let cellValue = String(data[i][0]).trim().toLowerCase();
      if (cellValue === 'payers') {
        payersRowIndex = i;
      } else if (cellValue === 'action item') {
        actionItemRowIndex = i;
        if (payersRowIndex !== -1) break; 
      }
    }

    // Si no encuentra Action Item, tomamos hasta el final de los datos
    if (actionItemRowIndex === -1) actionItemRowIndex = data.length;

    if (payersRowIndex !== -1) {
      const headers = data[payersRowIndex]; // Nombres de los Providers

      // Iterar por los seguros (filas)
      for (let r = payersRowIndex + 1; r < actionItemRowIndex; r++) {
        let payerName = String(data[r][0]).trim();
        if (!payerName) continue; // Omitir filas vacías

        uniquePayersSet.add(payerName);

        // Iterar por los providers (columnas) empezando en la columna B (índice 1)
        for (let c = 1; c < headers.length; c++) {
          let providerName = String(headers[c]).trim();
          if (!providerName) continue;

          let status = String(data[r][c]).trim() || 'Undefined';

          // Inicializar objeto para el provider si no existe
          if (!result[config.targetObj][providerName]) {
            result[config.targetObj][providerName] = {};
          }
          
          // Asignar el status al seguro
          result[config.targetObj][providerName][payerName] = status;
        }
      }
    }
  });

  result.payers = Array.from(uniquePayersSet).sort(); // Lista única y ordenada

  // 3. Guardar en caché
  saveChunkedCache(CACHE_KEY, JSON.stringify(result));

  return result;
}

/**
 * Lee la nueva hoja de cálculo dedicada a los logos de los seguros
 * Retorna [{ name: "Aetna", logo: "http..." }, ...]
 */
function getNetworkPayers() {
  const CACHE_KEY = 'PAYER_LOGOS_CACHE';
  
  let cachedData = readChunkedCache(CACHE_KEY);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  const ssId = PropertiesService.getScriptProperties().getProperty('PAYER_LOGOS_ID');
  if (!ssId) throw new Error("PAYER_LOGOS_ID no configurado.");

  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheets()[0]; // Lee la primera pestaña
  const data = sheet.getDataRange().getValues();

  let payerLogos = [];

  // Asumiendo que la fila 0 es encabezado (Payer, Logo URL)
  for (let i = 1; i < data.length; i++) {
    let payerName = String(data[i][0]).trim();
    let logoUrl = String(data[i][1]).trim();
    
    if (payerName) {
      payerLogos.push({
        name: payerName,
        logo: logoUrl
      });
    }
  }

  saveChunkedCache(CACHE_KEY, JSON.stringify(payerLogos));

  return payerLogos;
}