/* =========================================
   1. CONFIGURACIÓN Y BASES DE DATOS
   ========================================= */

const props = PropertiesService.getScriptProperties();

const DATABASES = {
  INSURANCE_DB: props.getProperty('INSURANCE_DB'),
  PROVIDERS_ASSIGNMENT_DB: { id: props.getProperty('PROVIDERS_ASSIGNMENT_DB'), sheetName: 'Sheet1' },
  PROVIDERS_NPI_DB: { id: props.getProperty('PROVIDERS_NPI_DB'), sheetName: 'UPDATED 01/12/2026' },
  PROVIDERS_SCHEDULE_DB: { id: props.getProperty('PROVIDERS_SCHEDULE_DB'), sheetName: 'By Provider' },
  COMMON_DOCS_FOLDER_ID: props.getProperty('COMMON_DOCS_FOLDER_ID'),
  OFFICES_DB: { id: props.getProperty('OFFICES_DB'), sheetName: 'Sheet1' },
  MEDS_DB: { id: props.getProperty('MEDS_DB'), sheetName: 'Sheet1' },
  GEMINI_API_KEY: props.getProperty('GEMINI_API_KEY'),
  KNOWLEDGE_DB: { id: props.getProperty('KNOWLEDGE_DB'), sheetName: 'Sheet1' }
};

const KNOWLEDGE_CONFIG = {
  // 1. LISTA NEGRA:
  IGNORED_DOCS: [
    "Email Signature",
    "Site/VPN",
    "Home Visit log",
    "Clover Assistant",
    "All Health Medical Office Addresses",
    "Step by step instructions for athena portal",
    "All Health Guide",
    "Dr Tikoo Wait List",
    "Waiting List Dr Mazza",
    "Englewood Cliffs Waitlist",
    "REFERRAL SHEET.docx"
    // Agrega aquí cualquier otro que solo haga "ruido"
  ],

  // 2. MAPA DE ENRUTAMIENTO:
  ROUTING_MAP: [
    {
      keywords: ["aesthetic", "botox", "laser", "weight", "skin", "hair", "machines","machine"],
      docs: ["Aesthetic Machines", "Aesthetics Providers"]
    },
    {
      keywords: ["schedule", "hours", "covering"],
      docs: ["PROVIDER SCHEDULING CRITERIA", "Providers Covering Schedule", "Provider schedule by location"]
    },
    {
      keywords: ["insurance", "payer", "eligibility"],
      docs: ["Portal - Payer", "Eligibility cheat sheet", "Insurance Cheat Sheet", "Medicaid per location", "Office location Insurance List"]
    },
    {
      keywords: ["medicaid"],
      docs: ["Medicaid per location"]
    },
    {
      keywords: ["providers", "ma", "assistant", "services", "gyn"],
      docs: ["Provider / MA assignment", "SERVICES BY LOCATION", "GYN PROVIDERS", "Aesthetics Providers","PROVIDER SCHEDULING CRITERIA","Provider NPI/DEA list","Provider schedule by location"]
    },
    {
      keywords: ["telemedicine", "virtual"],
      docs: ["Telemedicine Prep Quick Guide", "Telemedicine templates","Provider schedule by location"]
    },
    {
      keywords: ["office", "location", "address", "phone", "parking", "fax", "suite", "directions", "contact"],
      docs: ["Offices", "CHEAT SHEET","SERVICES BY LOCATION","Provider schedule by location"]
    },
    {
      keywords: ["phone", "extension", "weave"],
      docs: ["Weave Extension List"]
    },
    {
      keywords: ["medication", "pharm", "rx"],
      docs: ["Medication Guidelines", "PHARM STOCK"]
    },
    {
      keywords: ["protocol", "template", "guide", "forms","form","protocols"],
      docs: ["Peds Physical Forms", "Providers Covering Schedule", "VAs On Boarding Handbook", "LETTER TEMPLATE", "All Health Medical Group Protocols","Frequently Asked Questions - Protocol"]
    },{
      keywords: ["price", "cost", "pocket", "pay", "fee", "charge", "pricing", "service", "cash"],
      docs: ["out of pocket prices", "Aesthetics Products Pricing"]
    }
  ]
};

/* =========================================
   CHECK AVAILABLE GEMINI MODELS
   ========================================= */

function checkAvailableModels() {
  // Use the existing API key from your DATABASES object
  const apiKey = DATABASES.GEMINI_API_KEY.trim();
  
  if (!apiKey) {
    console.log("Error: API Key is missing in DATABASES configuration.");
    return;
  }

  // Google AI Studio endpoint to list models
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  const options = {
    "method": "get",
    "muteHttpExceptions": true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    if (json.error) {
      console.log("API Error: ", json.error.message);
      return;
    }
    
    console.log("=== AVAILABLE MODELS FOR YOUR API KEY ===");
    
    json.models.forEach(model => {
      // Filter to show only models that can generate text/content 
      // (ignores embedding-only or old vision-only models to keep the list clean)
      if (model.supportedGenerationMethods && model.supportedGenerationMethods.includes("generateContent")) {
        console.log(`Model ID: ${model.name}`);
        console.log(`Version/Description: ${model.version} - ${model.displayName}`);
        console.log(`Input Token Limit: ${model.inputTokenLimit}`);
        console.log("--------------------------------------------------");
      }
    });
    
  } catch (error) {
    console.log("Execution Error: ", error.message);
  }
}

/* ================================
   TEST GEMINI API CONNECTION & LATENCY
   ========================================= */

function testGeminiConnection() {
  try {
    if (!DATABASES.GEMINI_API_KEY) {
      console.log("❌ Error: API Key is missing in DATABASES.");
      return;
    }
    
    const apiKey = DATABASES.GEMINI_API_KEY.trim();
    const model = "gemini-flash-latest"; // El modelo que vamos a probar
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Un prompt súper ligero para medir la velocidad pura del modelo
    const payload = {
      "contents": [{
        "parts": [{"text": "Hello, this is a connection test. Please reply with exactly: 'CONNECTION_SUCCESSFUL'."}]
      }]
    };
    
    const options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    
    console.log(`⏳ Iniciando prueba de conexión con el modelo: ${model}...`);
    
    // Medimos el tiempo de respuesta (Ping)
    const startTime = Date.now();
    const response = UrlFetchApp.fetch(url, options);
    const endTime = Date.now();
    
    const ping = endTime - startTime;
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    // Analizamos el resultado
    if (responseCode === 200) {
      const json = JSON.parse(responseText);
      if (json.candidates && json.candidates.length > 0) {
        const aiResponse = json.candidates[0].content.parts[0].text.trim();
        console.log(`✅ ¡ÉXITO! Conexión perfecta.`);
        console.log(`⏱️ Tiempo de respuesta puro (Latencia): ${ping} ms (${(ping/1000).toFixed(2)} segundos)`);
        console.log(`🤖 Respuesta de la IA: ${aiResponse}`);
      } else {
        console.log("⚠️ La conexión funcionó (Status 200), pero la IA devolvió un texto vacío.");
      }
    } else {
      console.log(`❌ ERROR HTTP: ${responseCode}`);
      const errorJson = JSON.parse(responseText);
      console.log(`🚨 Detalles del Error: ${errorJson.error ? errorJson.error.message : responseText}`);
    }
    
  } catch (error) {
    console.log(`❌ ERROR DE SISTEMA: ${error.message}`);
  }
}


function getAppModules() {
  return [
    {
      id: 'module_insurance',
      name: 'Insurance Portal Payer',
      image: 'https://cdn-icons-png.flaticon.com/512/12195/12195094.png',
      description: 'Search Payers, Portals & ID Cards'
    },
    {
      id: 'module_providers',
      name: 'Medical Providers',
      image: 'https://cdn-icons-png.flaticon.com/512/387/387561.png',
      description: 'Directory, Services, Medical Asistant, NPI/DEA & Schedules'
    },
    {
      id: 'module_docs',
      name: 'Common Documents',
      image: 'https://cdn-icons-png.flaticon.com/512/9746/9746449.png',
      description: 'Protocols, Forms & Guides'
    },
    {
      id: 'module_offices',
      name: 'Office Locations',
      image: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
      description: 'Maps, Info & Logistics'
    },
    {
      id: 'module_meds',
      name: 'Medication Guidelines',
      image: 'https://cdn-icons-png.flaticon.com/512/822/822143.png',
      description: 'Refill Criteria, Medication Guidelines'
    },
    {
      id: 'module_ai',
      name: 'AI Knowledge Search',
      image: 'https://cdn-icons-png.flaticon.com/512/2082/2082852.png',
      description: 'Ask questions about our Practice - Deep Search'
    }
  ];
}

/* =========================================
   2. INICIALIZACIÓN Y UTILIDADES
   ========================================= */

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  var logoId = PropertiesService.getScriptProperties().getProperty('LOGO_ID');
  template.companyLogoData = "https://drive.google.com/thumbnail?id=" + logoId + "&sz=w400";

  return template.evaluate()
    .setTitle('All Health Hub')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

function toDirectLink(url) {
  if (!url) return "";
  const strUrl = url.toString().trim();
  const match = strUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w1000";
  }
  return strUrl;
}

/* =========================================
   3. MÓDULO 1: INSURANCE
   ========================================= */

function getInsuranceSheet() {
  return SpreadsheetApp.openById(DATABASES.INSURANCE_DB).getSheetByName('Sheet2');
}

function findInsuranceOptions(query) {
  const sheet = getInsuranceSheet();
  const values = sheet.getDataRange().getValues();
  const options = [];
  const q = query.toLowerCase();

  for (let i = 1; i < values.length; i++) {
    let payerName = values[i][1];
    let notes = values[i][3] ? values[i][3].toString() : "";
    let logoUrl = toDirectLink(values[i][0]);

    if (!payerName) {
      for (let k = i; k >= 1; k--) {
        if (values[k][1]) { payerName = values[k][1]; break; }
      }
    }

    if (!payerName || payerName === "Payer Name") continue;

    let matchType = null;
    let snippet = "";

    if (payerName.toLowerCase().includes(q)) {
      matchType = 'name';
    } else if (notes.toLowerCase().includes(q)) {
      matchType = 'note';
      let parts = notes.split('•');
      let foundPart = parts.find(p => p.toLowerCase().includes(q));
      snippet = foundPart ? "• " + foundPart.trim() : notes.substring(0, 100) + "...";
    }

    if (matchType) {
      let existing = options.find(o => o.name === payerName);
      if (!existing) {
        options.push({ name: payerName, logo: logoUrl, matchType: matchType, noteSnippet: snippet });
      } else if (matchType === 'note' && !existing.noteSnippet) {
        existing.matchType = 'note';
        existing.noteSnippet = snippet;
      }
    }
  }
  return options;
}

function getAllPayersData() {
  const sheet = getInsuranceSheet();
  const values = sheet.getDataRange().getValues();
  const payers = [];
  const seenNames = new Set();

  for (let i = 1; i < values.length; i++) {
    let payerName = values[i][1];
    if (!payerName || payerName === "Payer Name") continue;

    if (!seenNames.has(payerName)) {
      payers.push({ name: payerName, logo: toDirectLink(values[i][0]) });
      seenNames.add(payerName);
    }
  }
  return payers.sort((a, b) => a.name.localeCompare(b.name));
}

function getAllCardsData() {
  const sheet = getInsuranceSheet();
  const values = sheet.getDataRange().getValues();
  const allCards = [];

  for (let i = 1; i < values.length; i++) {
    let payerName = values[i][1];
    if (!payerName) {
      for (let k = i; k >= 1; k--) {
        if (values[k][1]) { payerName = values[k][1]; break; }
      }
    }
    if (!payerName || payerName === "Payer Name") continue;

    for (let col = 5; col <= 9; col++) {
      let rawLink = values[i][col];
      if (rawLink) {
        let direct = toDirectLink(rawLink);
        if (direct !== rawLink || direct.startsWith("http")) {
          allCards.push({ payerName: payerName, cardUrl: direct });
        }
      }
    }
  }
  return allCards;
}

function getPayerDetails(payerName) {
  const sheet = getInsuranceSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();
  const richText = range.getRichTextValues();
  const details = [];

  for (let i = 1; i < values.length; i++) {
    let rowPayer = values[i][1];
    if (!rowPayer) {
      for (let j = i; j >= 1; j--) {
        if (values[j][1]) { rowPayer = values[j][1]; break; }
      }
    }

    if (rowPayer === payerName) {
      let portalText = values[i][2];
      let portalUrl = "";
      const cellRichText = richText[i][2];
      if (cellRichText && cellRichText.getLinkUrl()) {
        portalUrl = cellRichText.getLinkUrl();
      } else {
        if (portalText && portalText.toString().includes("http")) portalUrl = portalText;
      }

      let images = [];
      for (let col = 5; col <= 9; col++) {
        let rawLink = values[i][col];
        if (rawLink) {
          let direct = toDirectLink(rawLink);
          if (direct !== rawLink || direct.startsWith("http")) images.push(direct);
        }
      }

      details.push({
        logo: toDirectLink(values[i][0]),
        portalName: portalText,
        portalUrl: portalUrl,
        notes: values[i][3],
        userPass: values[i][4],
        cards: images
      });
    }
  }
  return { payer: payerName, entries: details };
}

/* =========================================
   4. MÓDULO 2: PROVIDERS (OPTIMIZADO)
   ========================================= */

function fetchProvidersFromSheets() {
  // Carga de hojas
  const sheetAssign = SpreadsheetApp.openById(DATABASES.PROVIDERS_ASSIGNMENT_DB.id)
    .getSheetByName(DATABASES.PROVIDERS_ASSIGNMENT_DB.sheetName);
  const dataAssign = sheetAssign.getDataRange().getValues();

  const sheetNPI = SpreadsheetApp.openById(DATABASES.PROVIDERS_NPI_DB.id)
    .getSheetByName(DATABASES.PROVIDERS_NPI_DB.sheetName);
  const dataNPI = sheetNPI.getDataRange().getValues();

  const sheetSched = SpreadsheetApp.openById(DATABASES.PROVIDERS_SCHEDULE_DB.id)
    .getSheetByName(DATABASES.PROVIDERS_SCHEDULE_DB.sheetName);
  const dataSched = sheetSched.getDataRange().getValues();

  // Helper limpio para credenciales
  const cleanCredential = (text) => {
    if (!text) return "Not Found";
    let str = String(text).trim();
    let firstSpace = str.indexOf(' ');
    return firstSpace !== -1 ? str.substring(firstSpace + 1).trim() : str;
  };

  // Helper para generar clave de búsqueda (2 palabras)
  const getSearchKey = (fullName) => {
    if (!fullName) return "";
    let parts = String(fullName).trim().split(' ');
    return (parts.length >= 2) ? (parts[0] + " " + parts[1]).toLowerCase() : parts[0].toLowerCase();
  };

  // --- OPTIMIZACIÓN: Crear Mapa de NPI/DEA ---
  // En lugar de buscar en bucle, creamos un diccionario una sola vez.
  const npiMap = {};
  for (let r = 0; r < dataNPI.length; r++) {
    for (let c = 0; c < dataNPI[r].length; c++) {
      let cellVal = String(dataNPI[r][c]);
      if (cellVal && cellVal.length > 3) { // Filtrar celdas vacías o muy cortas
        let key = getSearchKey(cellVal);
        // Si encontramos un nombre, guardamos sus datos en el mapa
        if (!npiMap[key] && r + 2 < dataNPI.length) {
          npiMap[key] = {
            npi: cleanCredential(dataNPI[r + 1][c]),
            dea: cleanCredential(dataNPI[r + 2][c])
          };
        }
      }
    }
  }

  // --- PROCESAMIENTO PRINCIPAL ---
  let providersList = [];
  const headers = dataAssign[0];
  let serviceIndices = [];
  let notesIndex = -1;

  // Detectar columnas de servicios
  for (let k = 2; k < headers.length; k++) {
    let headerText = String(headers[k]).trim();
    if (headerText === "") { notesIndex = k; break; }
    serviceIndices.push(k);
  }

  for (let i = 1; i < dataAssign.length; i++) {
    let name = dataAssign[i][0];
    if (!name) continue;

    // 1. Servicios
    let services = [];
    serviceIndices.forEach(idx => {
      let cellValue = String(dataAssign[i][idx]).toLowerCase();
      if (cellValue.includes('y') || cellValue.includes('si')) {
        services.push(headers[idx]);
      }
    });

    let ma = dataAssign[i][1];
    let notes = (notesIndex !== -1) ? dataAssign[i][notesIndex] : "";

    let providerObj = {
      name: name,
      ma: ma,
      services: services,
      notes: notes,
      npi: "Not Found",
      dea: "Not Found",
      schedule: {},
      photo: "https://via.placeholder.com/150?text=No+Photo",
      sex: "",
      languages: ""
    };

    // 2. Asignar NPI/DEA desde el Mapa Optimizado
    let searchKey = getSearchKey(name);
    if (npiMap[searchKey]) {
      providerObj.npi = npiMap[searchKey].npi;
      providerObj.dea = npiMap[searchKey].dea;
    }

    // 3. Horarios y Extras
    let foundSched = dataSched.find(row => String(row[0]).toLowerCase().includes(name.toLowerCase()));
    if (foundSched) {
      providerObj.schedule = {
        Mon: foundSched[1], Tue: foundSched[2], Wed: foundSched[3], Thu: foundSched[4], Fri: foundSched[5]
      };
      if (foundSched[6]) providerObj.photo = toDirectLink(foundSched[6]) || providerObj.photo;
      if (foundSched[7]) providerObj.sex = String(foundSched[7]).trim().toUpperCase();
      if (foundSched[8]) providerObj.languages = String(foundSched[8]).trim();
    }

    providersList.push(providerObj);
  }

  return providersList;
}

// --- FUNCIONES AVANZADAS DE CACHÉ (Bypass límite 9KB) ---
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

function getProvidersData() {
  const cachedString = readChunkedCache('CACHE_PROVIDERS');
  
  if (cachedString) {
    return JSON.parse(cachedString);
  } else {
    // Si la memoria está vacía, va a buscar a las 3 hojas, guarda y devuelve
    const freshData = fetchProvidersFromSheets();
    saveChunkedCache('CACHE_PROVIDERS', JSON.stringify(freshData));
    return freshData;
  }
}

/* =========================================
   5. MÓDULO 3: DOCUMENTS
   ========================================= */

function fetchCommonDocsFromDrive() {
  const folderId = DATABASES.COMMON_DOCS_FOLDER_ID;
  let docsList = [];

  try {
    const mainFolder = DriveApp.getFolderById(folderId);

    // Carpetas
    const subfolders = mainFolder.getFolders();
    while (subfolders.hasNext()) {
      let folder = subfolders.next();
      docsList.push({
        name: folder.getName(),
        url: folder.getUrl(),
        icon: "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_folder_x32.png",
        type: "Folder"
      });
    }

    // Archivos (con lógica de Shortcuts)
    const files = mainFolder.getFiles();
    while (files.hasNext()) {
      let file = files.next();
      let mime = file.getMimeType();

      if (mime === "application/vnd.google-apps.shortcut") {
        try {
          let targetId = file.getTargetId();
          let targetFile = DriveApp.getFileById(targetId);
          mime = targetFile.getMimeType();
        } catch (e) {
          console.log("Shortcut error: " + file.getName());
        }
      }

      let iconUrl = "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_text_x32.png";

      if (mime === MimeType.GOOGLE_SHEETS) iconUrl = "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x32.png";
      else if (mime === MimeType.GOOGLE_DOCS) iconUrl = "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x32.png";
      else if (mime === MimeType.GOOGLE_SLIDES) iconUrl = "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_presentation_x32.png";
      else if (mime === MimeType.GOOGLE_FORMS) iconUrl = "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_form_x32.png";
      else if (mime === MimeType.PDF) iconUrl = "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_pdf_x32.png";
      else if (mime.includes("image")) iconUrl = "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_image_x32.png";
      else if (mime.includes("video")) iconUrl = "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_video_x32.png";
      else if (mime === "application/vnd.google-apps.script") iconUrl = "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_script_x32.png";

      docsList.push({
        name: file.getName(),
        url: file.getUrl(),
        icon: iconUrl,
        type: "File"
      });
    }

  } catch (e) {
    docsList.push({ name: "Error loading folder", url: "#", icon: "" });
  }

  return docsList.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "Folder" ? -1 : 1;
  });
}

function getCommonDocsData() {
  const cachedData = PropertiesService.getScriptProperties().getProperty('CACHE_DOCS');
  
  if (cachedData) {
    // Lectura instantánea de la memoria
    return JSON.parse(cachedData);
  } else {
    // En caso de que la memoria esté vacía
    const freshData = fetchCommonDocsFromDrive();
    PropertiesService.getScriptProperties().setProperty('CACHE_DOCS', JSON.stringify(freshData));
    return freshData;
  }
}

/* =========================================
   6. MÓDULO 4: OFFICES
   ========================================= */

function fetchOfficesFromSheet() {
  const sheet = SpreadsheetApp.openById(DATABASES.OFFICES_DB.id)
    .getSheetByName(DATABASES.OFFICES_DB.sheetName);
  const data = sheet.getDataRange().getValues();

  let officesList = [];

  for (let i = 1; i < data.length; i++) {
    // IMPORTANTE: Status ahora está en la columna M (Índice 12)
    let status = String(data[i][12] || "").toLowerCase().trim();
    if (status === 'close' || status === 'closed') continue;

    let name = data[i][0];
    if (!name) continue;

    let photoUrl = "https://via.placeholder.com/300x150?text=No+Office+Photo";
    if (data[i][4]) {
      photoUrl = toDirectLink(data[i][4]);
    }

    officesList.push({
      name: name,
      address: data[i][1],
      phone: data[i][2],
      fax: data[i][3],
      photo: photoUrl,
      mapLink: data[i][5],
      streetView: data[i][6],
      wheelchair: data[i][7],
      parking: data[i][8],
      manager: data[i][9],     // Columna J
      services: data[i][10],   // Columna K (NUEVA)
      notes: data[i][11]       // Columna L
    });
  }

  return officesList;
}

function updateSystemCache() {
  try {
    // 1. Oficinas (Normal)
    const officesData = fetchOfficesFromSheet();
    PropertiesService.getScriptProperties().setProperty('CACHE_OFFICES', JSON.stringify(officesData));
    
    // 2. Documentos (Normal)
    const docsData = fetchCommonDocsFromDrive();
    PropertiesService.getScriptProperties().setProperty('CACHE_DOCS', JSON.stringify(docsData));

    // 3. Providers (Usando Fragmentación por su mayor tamaño)
    const provData = fetchProvidersFromSheets();
    saveChunkedCache('CACHE_PROVIDERS', JSON.stringify(provData));
    
    console.log("✅ Caché General (Oficinas, Docs y Providers) actualizado con éxito.");
  } catch (error) {
    console.error("❌ Error actualizando caché: " + error.message);
  }
}

// Esta es la nueva función que llama tu HTML (¡Responde en milisegundos!)
function getOfficesData() {
  const cachedData = PropertiesService.getScriptProperties().getProperty('CACHE_OFFICES');
  
  if (cachedData) {
    // Si la memoria tiene los datos, los devuelve al instante sin abrir el Sheet
    return JSON.parse(cachedData);
  } else {
    // Si la memoria está vacía (por ser la primera vez), lee el Sheet, guarda y devuelve
    const freshData = fetchOfficesFromSheet();
    PropertiesService.getScriptProperties().setProperty('CACHE_OFFICES', JSON.stringify(freshData));
    return freshData;
  }
}

/* =========================================
   7. MÓDULO 5: MEDICATION GUIDELINES (AI POWERED)
   ========================================= */

function searchMedication(query) {
  const sheet = SpreadsheetApp.openById(DATABASES.MEDS_DB.id)
    .getSheetByName(DATABASES.MEDS_DB.sheetName);
  const data = sheet.getDataRange().getValues(); // Asumimos: A=Category, B=Medications, C=Refill Criteria
  
  const q = query.toLowerCase().trim();
  let categories = []; // Guardaremos las categorías para dárselas a la IA si hace falta

  // --- FASE 1: BÚSQUEDA EXACTA ---
  for (let i = 1; i < data.length; i++) {
    let category = data[i][0];       // Columna A
    let medsString = String(data[i][1]).toLowerCase(); // Columna B
    let criteria = data[i][2];       // Columna C
    
    // Guardamos categoría para la IA
    if (category) categories.push(category);

    // Revisamos coincidencia exacta en la lista separada por comas
    let medsList = medsString.split(',').map(m => m.trim());
    
    // Si la query está en la lista O si la query coincide con la categoría misma
    if (medsList.includes(q) || category.toLowerCase() === q) {
      return {
        found: true,
        method: 'EXACT_MATCH',
        medication: q,
        category: category,
        criteria: criteria
      };
    }
  }

  // --- FASE 2: BÚSQUEDA CON IA (GEMINI) ---
  try {
    let aiResult = identifyCategoryWithGemini(q, categories);
    
    if (aiResult && aiResult.categoryMatch) {
      // Normalizamos lo que responde la IA (todo minúsculas y sin espacios extra)
      let aiCategory = String(aiResult.categoryMatch).trim().toLowerCase();
      
      // Buscamos la fila que corresponde a la categoría sugerida
      for (let i = 1; i < data.length; i++) {
        let dbCategory = String(data[i][0]).trim().toLowerCase();
        
        if (dbCategory === aiCategory) {
          return {
            found: true,
            method: 'AI_INFERENCE',
            medication: query, // Lo que el user escribió ("xanaxx")
            // Usamos medicationName (lo que pedimos) con fallback a genericName
            detectedAs: aiResult.medicationName || aiResult.genericName, 
            category: data[i][0],
            criteria: data[i][2]
          };
        }
      }
    }
  } catch (e) {
    console.log("Error en IA: " + e.toString());
  }
  
  // Si la IA dijo null, o la API falló, cae aquí devolviendo el input del usuario
  return { found: false, medication: query };

}

function identifyCategoryWithGemini(userQuery, categoriesList) {
  const apiKey = DATABASES.GEMINI_API_KEY;
  // Sugiero seguir usando el modelo que descubriste que sí tiene cuota en tu test anterior
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

  const prompt = `
    Act as a medical assistant data parser.
    User Query: "${userQuery}"
    
    Here is my database of Medication Categories:
    ${JSON.stringify(categoriesList)}
    
    Task:
    1. Identify the correct spelling and generic name of the medication in the User Query.
    2. STRICTLY match it to ONE of the Categories provided above.
       * HINT: Benzodiazepines (e.g., Xanax/Alprazolam), ADHD meds, and other scheduled drugs MUST match "Narcotics/Controlled".
       * HINT: Anxiety medications (non-controlled) can match "Depression".
    3. If it does not belong to any category, return null for categoryMatch.
    
    Output strictly in this JSON format:
    {
      "medicationName": "Corrected name of the drug",
      "categoryMatch": "Exact String from my list or null"
    }
  `;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());

    if (json.candidates && json.candidates.length > 0) {
      return JSON.parse(json.candidates[0].content.parts[0].text); 
    }
  } catch (e) {
    console.log("Error en API: " + e.toString());
  }
  
  return { medicationName: userQuery, categoryMatch: null };
}

/* =========================================
   DRIVE INDEXING ENGINE (V4: Real-World Formatting & AI-Optimized)
   ========================================= */

function indexDriveDocuments() {
  // 1. CONFIGURATION
  const FOLDER_ID = DATABASES.COMMON_DOCS_FOLDER_ID; 
  const sheet = SpreadsheetApp.openById(DATABASES.KNOWLEDGE_DB.id)
                              .getSheetByName(DATABASES.KNOWLEDGE_DB.sheetName);
  
  // Clear previous DB (keeping headers)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).clearContent();
  }

  let rowData = [];
  const rootFolder = DriveApp.getFolderById(FOLDER_ID);

  // 2. INDIVIDUAL FILE PROCESSING FUNCTION
  function processFile(file) {
    let name = file.getName();
    // --- NUEVO: Filtro de Lista Negra ---
    if (KNOWLEDGE_CONFIG.IGNORED_DOCS.some(ignored => name.toLowerCase().includes(ignored.toLowerCase()))) {
      console.log(`❌ Skipped blacklisted file: ${name}`);
      return; 
    }
    let url = file.getUrl();
    let mimeType = file.getMimeType();
    let fileToRead = file;

    try {
      // Shortcut Resolution
      if (mimeType === MimeType.SHORTCUT) {
        const targetId = file.getTargetId();
        try {
          fileToRead = DriveApp.getFileById(targetId);
          mimeType = fileToRead.getMimeType();
          url = fileToRead.getUrl(); 
        } catch (e) {
          console.log(`Shortcut skipped: '${name}'`);
          return; 
        }
      }

      let content = "";
      let readId = fileToRead.getId();

      // --- DOCS EXTRACTION: REAL-WORLD BOLD HEADING DETECTION ---
      if (mimeType === MimeType.GOOGLE_DOCS) {
        // --- DOCS EXTRACTION: EXTRAER SERVICIOS Y ACTUALIZAR OFFICES DB ---
        if (name.includes("SERVICES BY LOCATION")) {
          console.log("Iniciando extracción avanzada de Servicios...");
          let doc = DocumentApp.openById(readId);
          let paragraphs = doc.getBody().getParagraphs();
          
          let officesSheet = SpreadsheetApp.openById(DATABASES.OFFICES_DB.id).getSheetByName(DATABASES.OFFICES_DB.sheetName);
          let officesData = officesSheet.getDataRange().getValues();
          let dbOffices = [];
          
          for (let i = 1; i < officesData.length; i++) {
            let offName = String(officesData[i][0]).trim();
            if (offName) {
              dbOffices.push({ name: offName, row: i + 1, parsedServices: [] });
            }
          }

          let currentService = "";
          let currentTargetOffices = [];
          let currentDesc = [];

          const saveServiceToDb = () => {
            if (currentService && currentTargetOffices.length > 0) {
              let descHtml = currentDesc.join("<br>");
              let serviceHtml = `<b>${currentService}</b><br><span style="font-size:12px;color:#555;">${descHtml}</span>`;
              
              // Eliminamos duplicados en la lista de oficinas acumuladas
              let uniqueTargets = [...new Set(currentTargetOffices)];
              
              uniqueTargets.forEach(targetOff => {
                let cleanTarget = targetOff.toLowerCase().trim();
                
                dbOffices.forEach(dbOff => {
                  let dbNameLower = dbOff.name.toLowerCase();
                  
                  // REGLA DE EXCLUSIÓN PARA RUTHERFORD SPA
                  // Si el documento dice "Rutherford", solo se lo asignamos a la oficina médica.
                  // El Spa solo recibirá servicios si el documento dice explícitamente "Rutherford Spa".
                  
                  if (cleanTarget === "rutherford") {
                    // Solo vincula si el nombre de la DB contiene "Rutherford" pero NO contiene "Spa"
                    if (dbNameLower.includes("rutherford") && !dbNameLower.includes("spa")) {
                      dbOff.parsedServices.push(serviceHtml);
                    }
                  } 
                  else {
                    // Lógica normal para el resto de las oficinas
                    let matchTerm = cleanTarget.replace('office', '').replace('spa', '').trim();
                    if (dbNameLower.includes(matchTerm) && matchTerm.length > 2) {
                      dbOff.parsedServices.push(serviceHtml);
                    }
                  }
                });
              });
            }
          };

          paragraphs.forEach(p => {
            let text = p.getText().trim();
            if (!text) return;

            let heading = p.getHeading();
            
            // REGLA 1: Nombre del Servicio (Heading 2)
            if (heading === DocumentApp.ParagraphHeading.HEADING2) {
              saveServiceToDb(); // Guardamos el servicio completado anteriormente
              currentService = text;
              currentTargetOffices = []; // Reiniciamos lista de oficinas
              currentDesc = [];          // Reiniciamos descripción
            } 
            // REGLA 2: Nombres de Oficinas (Heading 3) -> ACUMULATIVO
            else if (heading === DocumentApp.ParagraphHeading.HEADING3) {
              // Si hay varias líneas de Heading 3, las separamos y las sumamos a la lista actual
              let foundInThisLine = text.split(/,|&|\n/).map(s => s.trim()).filter(s => s.length > 0);
              currentTargetOffices = currentTargetOffices.concat(foundInThisLine);
            } 
            // REGLA 3: Descripción (Texto Normal)
            else {
              // Si es texto normal, asumimos que la lista de oficinas ya terminó
              currentDesc.push("• " + text);
            }
          });
          
          saveServiceToDb(); // Guardar el último servicio

          // Limpiar columna K antes de escribir para no duplicar si el script corre varias veces
          officesSheet.getRange(2, 11, officesSheet.getLastRow(), 1).clearContent();

          dbOffices.forEach(dbOff => {
            if (dbOff.parsedServices.length > 0) {
              let finalHtml = dbOff.parsedServices.join("<br><br>");
              officesSheet.getRange(dbOff.row, 11).setValue(finalHtml);
            }
          });
          console.log("¡Servicios vinculados correctamente con lógica multilínea!");
        }
        
        let doc = DocumentApp.openById(readId);
        let paragraphs = doc.getBody().getParagraphs();
        
        content += `\n--- DOCUMENT: ${name} ---\n`;
        
        paragraphs.forEach(p => {
          let rawText = p.getText();
          let cleanText = rawText.trim();
          if (cleanText === "") return; // Ignorar líneas vacías

          let type = p.getType();
          let heading = p.getHeading();
          let prefix = "";

          // 1. Detección de Listas
          if (type === DocumentApp.ElementType.LIST_ITEM) {
            prefix = "- ";
          } 
          // 2. Detección Semántica (Títulos reales de Google Docs)
          else if (heading === DocumentApp.ParagraphHeading.HEADING1) {
            prefix = "\n# ";
          } 
          else if (heading === DocumentApp.ParagraphHeading.HEADING2) {
            prefix = "\n## ";
          } 
          else if (heading === DocumentApp.ParagraphHeading.HEADING3) {
            prefix = "\n### ";
          } 
          // 3. Detección Visual (TU código optimizado para Negritas)
          else {
            let textObj = p.editAsText();
            let firstCharIndex = rawText.search(/\S/); 
            
            if (firstCharIndex !== -1 && textObj.isBold(firstCharIndex)) {
              // Si la línea empieza en negrita Y es corta (es decir, parece un título y no un párrafo narrativo)
              if (cleanText.length < 80) {
                prefix = "\n### "; // Lo tratamos como un sub-título de nivel 3
              } else {
                // Si es un párrafo largo que empieza en negrita, le marcamos la negrita en Markdown
                cleanText = "**" + cleanText.substring(0, cleanText.indexOf(' ') > 0 ? cleanText.indexOf(' ') : 15) + "**" + cleanText.substring(cleanText.indexOf(' '));
              }
            }
          }

          content += prefix + cleanText + "\n";
        });
      }
      // --- SHEETS EXTRACTION: ROW-TO-HEADER MAPPING ---
      else if (mimeType === MimeType.GOOGLE_SHEETS) {
        let ss = SpreadsheetApp.openById(readId);
        let sheets = ss.getSheets();
        
        sheets.forEach(s => {
          let data = s.getDataRange().getDisplayValues();
          if (data.length > 0) {
            let headers = data[0];
            if (name.toLowerCase().includes("provider / ma assignment")) {
              let dynamicNames = [];
              for (let r = 1; r < data.length; r++) {
                // Toma la Columna 1 (Índice 0), la limpia de tildes y la pasa a minúsculas
                let col1Value = String(data[r][0]).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                // Separa por espacios y quita signos de puntuación
                let words = col1Value.split(/\s+/).map(w => w.replace(/[^a-z]/gi, ''));
                
                // Filtra palabras de 3 letras o menos (Elimina dr, apn, md, do)
                words.forEach(word => {
                  if (word.length > 3) {
                    dynamicNames.push(word);
                  }
                });
              }
              // Guarda los nombres únicos en la memoria oculta del script
              let uniqueNames = [...new Set(dynamicNames)];
              PropertiesService.getScriptProperties().setProperty('DYNAMIC_PROVIDERS', JSON.stringify(uniqueNames));
              console.log("Nombres de Providers aprendidos automáticamente:", uniqueNames.join(", "));
            }

            content += `\n--- SHEET TAB: ${s.getName()} ---\n`;
            
            for (let r = 1; r < data.length; r++) {
              let rowStringParts = [];
              for (let c = 0; c < headers.length; c++) {
                let cellValue = String(data[r][c]).trim();
                let headerName = String(headers[c]).trim() || `Column ${c+1}`;
                
                if (cellValue !== "") { 
                  rowStringParts.push(`${headerName}: ${cellValue}`);
                }
              }
              if (rowStringParts.length > 0) {
                content += "- " + rowStringParts.join(" | ") + "\n";
              }
            }
          }
        });
      }
      // --- SLIDES EXTRACTION ---
      else if (mimeType === MimeType.GOOGLE_SLIDES) {
        let presentation = SlidesApp.openById(readId);
        let slides = presentation.getSlides();
        slides.forEach((slide, index) => {
          content += `\n--- SLIDE ${index + 1} ---\n`;
          let shapes = slide.getShapes();
          shapes.forEach(shape => {
            if (shape.getShapeType() === SlidesApp.ShapeType.TEXT_BOX || shape.getShapeType() === SlidesApp.ShapeType.RECTANGLE) {
               content += shape.getText().asString().trim() + "\n";
            }
          });
        });
      }
      // --- PDF EXTRACTION (OCR) ---
      else if (mimeType === MimeType.PDF) {
        try {
          let blob = fileToRead.getBlob();
          let resource = { name: name + "_temp_ocr", mimeType: MimeType.GOOGLE_DOCS };
          let tempFile = Drive.Files.create(resource, blob); 
          let tempDoc = DocumentApp.openById(tempFile.id);
          content = tempDoc.getBody().getText();
          DriveApp.getFileById(tempFile.id).setTrashed(true);
        } catch(err) {
          content = "[Error extracting text from PDF]";
        }
      } else if (mimeType === MimeType.MICROSOFT_WORD || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          // Background conversion to Google Docs to extract text
          let blob = fileToRead.getBlob();
          let resource = { name: name + "_temp_word", mimeType: MimeType.GOOGLE_DOCS };
          let tempFile = Drive.Files.create(resource, blob); 
          let tempDoc = DocumentApp.openById(tempFile.id);
          content = tempDoc.getBody().getText();
          DriveApp.getFileById(tempFile.id).setTrashed(true);
        } catch(err) {
          content = "[Error extracting text from Word document]";
          console.log(`Could not read Word file ${name}: ${err.message}`);
        }
      } else {
        return; 
      }

      // Clean text to fit Google Sheets cell limits safely
      content = content.replace(/\n\s*\n/g, '\n').substring(0, 45000);

      // 3. PREPARE DATA TO SAVE
      if (content.trim() !== "") {
        rowData.push([name, mimeType.replace('application/vnd.google-apps.', ''), url, content]);
      }

    } catch (e) {
      console.log(`Error reading document ${name}: ${e.toString()}`);
    }
  }

  // 4. RECURSIVE FOLDER SCAN
  function processFolder(folder) {
    const files = folder.getFiles();
    while (files.hasNext()) { processFile(files.next()); }
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) { processFolder(subfolders.next()); }
  }

  // 5. EXECUTE AND SAVE
  console.log("Starting optimized folder scan...");
  processFolder(rootFolder);

  if (rowData.length > 0) {
    sheet.getRange(2, 1, rowData.length, 4).setValues(rowData);
    console.log(`Indexing complete! ${rowData.length} files processed with AI structure.`);
  } else {
    console.log("No readable text files were found.");
  }
}

    
/* =========================================
   9. MÓDULO 6: SMART SEARCH BAR & GEMINI INTEGRATION
   ========================================= */

/* =========================================
   9. MÓDULO 6: SMART SEARCH BAR & GEMINI INTEGRATION (WITH MEMORY)
   ========================================= */

function processSmartQuery(chatHistory, currentQuery) {
  try {
    if (!DATABASES.GEMINI_API_KEY) throw new Error("API Key is missing in DATABASES.");
    const apiKey = DATABASES.GEMINI_API_KEY.trim();

    // 1. Búsqueda Principal (Usamos la query actual para buscar documentos)
    const searchResult = searchKnowledgeDB(currentQuery);
    const docsContext = searchResult.text;
    const documentUrls = searchResult.urls;

    // 2. Carga Condicional (Ahorra tiempo de ejecución en Apps Script)
    let officesContext = "Not provided for this query.";
    const lowerQuery = currentQuery.toLowerCase();
    if (lowerQuery.includes("office") || lowerQuery.includes("address") || lowerQuery.includes("fax") || lowerQuery.includes("phone") || lowerQuery.includes("location")) {
      officesContext = JSON.stringify(getOfficesData());
    }

    // Cargamos los módulos solo para que sepa qué sugerir
    const modulesContext = JSON.stringify(getAppModules());
    
    // 3. Prompt Optimizado y Directo (Con citas de fuentes)
    // Extraemos las instrucciones del sistema en un bloque separado
    const systemInstructions = `
      You are the AI Knowledge Assistant for All Health Medical Group. 
      Your primary job is to answer the User Query based ONLY on the provided Document Context and Offices Data.
      
      RULES FOR READING DATA (STRICT):
      1. ROW ISOLATION: When reading structured data separated by "|" or rows, strictly associate the attributes ONLY with the specific subject named at the beginning of that exact row. Do not mix data from adjacent rows.
      2. RESPECT "NO" VALUES: Pay extreme attention to "Yes" and "No". If a service says "No" or "False", DO NOT include it in your answer. 
      3. AGGREGATION: A subject might be mentioned in multiple different documents. You MUST read ALL the provided context and combine the information to give a complete answer.

      GENERAL RULES:
      4. ACCURACY: Base your answer strictly on the provided context. If the answer is not in the context, DO NOT guess. 
      5. MODULE SUGGESTION: If you don't know the answer, politely suggest checking the Available Modules.
      6. CONTRADICTION RULE: Cross-reference the Document Context. If Document A contradicts Document B, set "hasContradiction" to true.
      7. FORMATTING: Use HTML formatting for the "response" (<ul>, <li>, <b>, <br>).
      8. CITATIONS: You MUST identify the exact names of the documents you used to formulate your answer (they are marked as [Source Document: Name]). Add them to the "sourcesUsed" array.

      RETURN STRICTLY A JSON OBJECT WITH THIS EXACT STRUCTURE:
      {
        "response": "Your formatted HTML answer here.",
        "sourcesUsed": ["Document Name 1", "Document Name 2"],
        "hasContradiction": true | false,
        "contradictionDetails": "Explanation of conflict if true, else null"
      }
    `;

    // 4. Preparar el Payload para Gemini
    // Construimos la lista de mensajes (contents) a partir del historial
    let contents = [];
    
    // Agregamos el historial previo (excepto la última pregunta que la trataremos especial)
    if (chatHistory && chatHistory.length > 1) {
        for (let i = 0; i < chatHistory.length - 1; i++) {
            // Aseguramos que el historial cumple con la estructura estricta de Gemini
            contents.push({
                "role": chatHistory[i].role,
                "parts": chatHistory[i].parts
            });
        }
    }

    // Preparamos el contexto para inyectarlo SOLO en el último mensaje
    const currentContext = `
      --- CURRENT DATA SOURCES ---
      Available Modules: ${modulesContext}
      Offices Data: ${officesContext}
      Document Context: ${docsContext}
      
      User Query: ${currentQuery}
    `;

    // Agregamos el último mensaje del usuario (la pregunta actual) con el contexto inyectado
    contents.push({
        "role": "user",
        "parts": [{"text": currentContext}]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    
    // Inyectamos las system_instructions de forma nativa en la API v1beta
    const payload = {
      "system_instruction": {
        "parts": [{"text": systemInstructions}]
      },
      "contents": contents,
      "generationConfig": { 
        "responseMimeType": "application/json",
        "temperature": 0.1 
      } 
    };
    
    const options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };

    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    if (json.error) throw new Error(json.error.message);
    
    // 5. Procesamiento Seguro de la Respuesta
    let rawResult = json.candidates[0].content.parts[0].text;
    rawResult = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(rawResult);
    
    // Agregar la nota al pie con las fuentes
    if (result.sourcesUsed && result.sourcesUsed.length > 0) {
      const fuentesUnicas = [...new Set(result.sourcesUsed)];
      const fuentesConLinks = fuentesUnicas.map(nombre => {
        // Find the matching key ignoring case and extra spaces
        const linkKey = Object.keys(documentUrls).find(k => k.trim().toLowerCase() === nombre.trim().toLowerCase());
        const link = linkKey ? documentUrls[linkKey] : null;
        
        if (link) {
          return `<a href="${link}" target="_blank" style="color: #1a73e8; text-decoration: none; font-weight: 500;">${nombre} 🔗</a>`;
        } else {
          return nombre;
        }
      });      
      const footerHtml = `
        <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
          <b>📄 Referred documents:</b> <i>${fuentesConLinks.join(' • ')}</i>
        </div>`;
      result.response += footerHtml;
    }

    // 6. Registro de Contradicciones
    if (result.hasContradiction && result.contradictionDetails) {
      logContradiction(currentQuery, result.contradictionDetails);
      result.response = `<div style="background-color:#ffebee; color:#c62828; padding:12px; border-radius:6px; margin-bottom:15px; border: 1px solid #ef9a9a; font-size:14px;">
        <b>⚠️ Warning: Document Contradiction Detected</b><br>
        ${result.contradictionDetails}
      </div>` + result.response;
    }
    
    return result;

  } catch (error) {
    return { 
      response: `<div style="color:#d32f2f;"><b>Error processing query:</b> ${error.message}</div>`, 
      hasContradiction: false 
    };
  }
}

// Helper: Búsqueda Semántica Inteligente con Routing Map
function searchKnowledgeDB(query) {
  const sheet = SpreadsheetApp.openById(DATABASES.KNOWLEDGE_DB.id).getSheetByName(DATABASES.KNOWLEDGE_DB.sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "No documents available.";
  
  // Reemplazamos símbolos por espacios para evitar que las palabras se peguen
  const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, ' ');
  
  const keywords = cleanQuery.split(/\s+/).filter(w => w.length > 1 && ![ 'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'does', 'into', 'each', 'than', 'then', 'very', 'been', 'were', 'also', 'some', 'over', 'upon', 'you', 'your', 'they', 'them', 'their', 'whom', 'whose', 'him', 'her', 'she', 'ours', 'mine', 'myself', 'give', 'tell', 'show', 'please', 'know', 'want', 'need', 'find', 'get', 'see', 'look', 'list', 'check', 'send', 'take', 'bring', 'all', 'any', 'each', 'every', 'many', 'much', 'more', 'most', 'only', 'just', 'where', 'when', 'what', 'which', 'how', 'why', 'there', 'here', 'about'].includes(w));
  
  if (keywords.length === 0) return "No specific keywords to search.";
  
  // RECUPERAR LOS NOMBRES DE LA MEMORIA
  let dynamicProviders = [];
  try {
    let storedNames = PropertiesService.getScriptProperties().getProperty('DYNAMIC_PROVIDERS');
    if (storedNames) dynamicProviders = JSON.parse(storedNames);
  } catch(e) {}

  let scoredRows = [];
  
  for (let i = 1; i < data.length; i++) {
    let fileName = data[i][0];
    let originalContent = String(data[i][3]); 
    let contentLower = originalContent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let score = 0;
    
    // --- 1. SUPER BONUS POR ENRUTAMIENTO (ROUTING MAP) ---
    KNOWLEDGE_CONFIG.ROUTING_MAP.forEach(route => {
      let routeKeywords = [...route.keywords]; 
      
      if (route.docs.includes("Provider / MA assignment")) {
        routeKeywords = routeKeywords.concat(dynamicProviders);
      }

      // Búsqueda de palabra exacta (Word Boundary)
      let hasKeyword = routeKeywords.some(kw => new RegExp('\\b' + kw + '\\b', 'i').test(cleanQuery));
      let isTargetDoc = route.docs.some(target => fileName.toLowerCase().includes(target.toLowerCase()));
      
      if (hasKeyword && isTargetDoc) {
        score += 1000; 
      }
    });

    // --- 2. BONOS EXTRA POR TÍTULO DEL DOCUMENTO ---
    keywords.forEach(kw => {
      if (new RegExp('\\b' + kw + '\\b', 'i').test(fileName.toLowerCase())) {
        score += 500;
      }
    });

    // --- 3. PUNTOS BASE POR REPETICIÓN ---
    keywords.forEach(kw => {
      let matches = contentLower.match(new RegExp('\\b' + kw + '\\b', 'g'));
      let occurrences = matches ? matches.length : 0;
      score += occurrences;
      
      let headingRegex = new RegExp(`(?:^|\n)#+.*\\b${kw}\\b.*(?:\n|$)`, 'g');
      if (headingRegex.test(contentLower)) score += 15; 
      
      let sheetHeaderRegex = new RegExp(`(?:^|- ).*:.*\\b${kw}\\b.*`, 'g');
      if (sheetHeaderRegex.test(contentLower)) score += 10; 
    });
    
    if (score > 0) {
      // --- SIN RESTRICCIONES DE TAMAÑO ---
      // Se pasa el documento íntegro a Gemini, asegurando 100% de precisión.
      scoredRows.push({ 
        score: score, 
        text: `[Source Document: ${fileName}]\nContent:\n${originalContent}` 
      });
    }
  }
  
  // --- FILTRO DE EXCLUSIVIDAD (STRICT ROUTING) ---
  scoredRows.sort((a, b) => b.score - a.score);
  
  let filteredRows = scoredRows;
  
  if (scoredRows.length > 0 && scoredRows[0].score >= 1000) {
    filteredRows = scoredRows.filter(r => r.score >= 1000);
  }
  
  // Enviamos al LLM un máximo de los 2 mejores de esa lista filtrada
  let topDocs = filteredRows.slice(0, 3).map(r => r.text).join("\n\n---\n\n");

  // --- NUEVO: CREAR DICCIONARIO DE LINKS ---
  let urlMap = {};
  for (let i = 1; i < data.length; i++) {
    let fileName = data[i][0];
    let fileUrl = data[i][2]; // Tomamos el link de la Columna C
    if (fileName && fileUrl) {
      urlMap[fileName] = fileUrl;
    }
  }
  
  // En lugar de devolver solo un string, devolvemos un Objeto con ambas cosas
  return {
    text: topDocs || "No relevant documents found for these keywords.",
    urls: urlMap
  };
}

function logContradiction(query, details) {
  const sheet = SpreadsheetApp.openById(DATABASES.KNOWLEDGE_DB.id).getSheetByName("CONTRADICTIONS_LOG");
  if (sheet) {
    sheet.appendRow([new Date(), query, details, "Automatically logged by Gemini"]);
  }
}

function getUniqueServices() {
  const sheet = SpreadsheetApp.openById(DATABASES.OFFICES_DB.id).getSheetByName(DATABASES.OFFICES_DB.sheetName);
  const data = sheet.getRange("K2:K" + sheet.getLastRow()).getValues();
  let servicesSet = new Set();

  data.forEach(row => {
    if (row[0]) {
      // Extraemos los nombres de los servicios (están entre <b>...</b>)
      let matches = row[0].match(/<b>(.*?)<\/b>/g);
      if (matches) {
        matches.forEach(m => servicesSet.add(m.replace(/<\/?b>/g, "")));
      }
    }
  });
  return Array.from(servicesSet).sort();
}