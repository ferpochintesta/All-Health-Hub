function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  
  // Pasamos el logo desde las propiedades seguras
  var logoId = PropertiesService.getScriptProperties().getProperty('LOGO_ID');
  template.companyLogoData = "https://drive.google.com/thumbnail?id=" + logoId + "&sz=w400";
  
  return template.evaluate()
    .setTitle('All Health Hub')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

// Vital feature to include HTML files inside others
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
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