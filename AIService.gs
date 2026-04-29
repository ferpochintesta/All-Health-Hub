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

/* ================================
        MEDS MODULE
   ========================================= */

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
/* ================================
  SMART SEARCH BAR & GEMINI INTEGRATION (WITH MEMORY)
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