/* =========================================
          CONFIG AND DATA BASE
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