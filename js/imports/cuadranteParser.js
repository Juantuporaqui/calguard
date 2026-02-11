/**
 * @module imports/cuadranteParser
 * Parser for Excel and PDF shift schedule files (cuadrantes)
 * Imports .xlsx and .pdf files and extracts shift assignments per person/date
 */

/**
 * Shift code mapping to CalGuard tag types
 */
const CODE_MAP = {
  'G': 'GUARDIA_REAL',
  'GU': 'GUARDIA_REAL',
  'GUARDIA': 'GUARDIA_REAL',
  'L': 'LIBRE',
  'LI': 'LIBRE',
  'LIBRE': 'LIBRE',
  'V': 'VACACIONES',
  'VC': 'VACACIONES',
  'VAC': 'VACACIONES',
  'VACACIONES': 'VACACIONES',
  'T': 'TURNO_T',
  'TA': 'TURNO_T',
  'TARDE': 'TURNO_T',
  'M': 'TURNO_M',
  'MA': 'TURNO_M',
  'MAÑANA': 'TURNO_M',
  'MANANA': 'TURNO_M',
  'AP': 'AP',
  'A.P.': 'AP',
  'ASUNTO': 'AP',
  'F': 'FORMACION',
  'FORM': 'FORMACION',
  'FORMACION': 'FORMACION',
  'FORMACIÓN': 'FORMACION',
  'J': 'JUICIO',
  'JUICIO': 'JUICIO',
  'N': 'TURNO_N',
  'NOCHE': 'TURNO_N'
};

const SPANISH_MONTHS = {
  'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3,
  'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7,
  'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
};

/**
 * Load the SheetJS (XLSX) library from CDN if not already present
 * @returns {Promise<object>} XLSX library
 */
async function loadXLSXLibrary() {
  if (typeof XLSX !== 'undefined') return XLSX;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload = () => {
      if (typeof XLSX !== 'undefined') {
        resolve(XLSX);
      } else {
        reject(new Error('XLSX library failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load XLSX library from CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Load the PDF.js library from CDN if not already present
 * @returns {Promise<object>} pdfjsLib
 */
async function loadPDFLibrary() {
  if (typeof pdfjsLib !== 'undefined') return pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
    script.type = 'module';

    // For module scripts we need a different approach - use dynamic import
    import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs').then(mod => {
      const lib = mod.default || mod;
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
      resolve(lib);
    }).catch(() => {
      // Fallback: try loading as classic script (older pdf.js builds)
      const fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      fallbackScript.onload = () => {
        if (typeof pdfjsLib !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(pdfjsLib);
        } else {
          reject(new Error('PDF.js library failed to initialize'));
        }
      };
      fallbackScript.onerror = () => reject(new Error('Failed to load PDF.js library from CDN'));
      document.head.appendChild(fallbackScript);
    });
  });
}

/**
 * Convert Excel serial date to JS Date
 * @param {number} serial
 * @returns {Date}
 */
function excelDateToJS(serial) {
  // Excel epoch: 1 Jan 1900 (with the famous leap-year bug)
  const epoch = new Date(1899, 11, 30);
  return new Date(epoch.getTime() + serial * 86400000);
}

/**
 * Map a shift code string to a CalGuard tag type
 * @param {string} code - raw shift code from Excel/PDF
 * @returns {string|null} CalGuard tag type or null if unknown
 */
export function mapCodeToTagType(code) {
  if (!code || typeof code !== 'string') return null;
  const normalized = code.trim().toUpperCase();
  return CODE_MAP[normalized] || null;
}

/**
 * Detect file type and parse accordingly
 * @param {File} file - .xlsx, .xls, .csv, .txt or .pdf file
 * @returns {Promise<Array<{date: string, person: string, code: string, tagType: string}>>}
 */
export async function parseCuadrante(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    return parseCuadrantePDF(file);
  }

  if (name.endsWith('.csv')) {
    return parseCuadranteCSV(file);
  }

  if (name.endsWith('.txt')) {
    return parseCuadranteText(file);
  }

  // Default to Excel for .xlsx, .xls, or unknown extensions
  return parseCuadranteExcel(file);
}

/**
 * Parse an Excel cuadrante file
 * @param {File} file - .xlsx or .xls file
 * @returns {Promise<Array<{date: string, person: string, code: string, tagType: string}>>}
 */
async function parseCuadranteExcel(file) {
  const xlsx = await loadXLSXLibrary();

  const buffer = await file.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: 'array' });

  const results = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    parseSheetData(data, results);
  }

  return results;
}

/**
 * Parse a PDF cuadrante file
 * @param {File} file - .pdf file
 * @returns {Promise<Array<{date: string, person: string, code: string, tagType: string}>>}
 */
async function parseCuadrantePDF(file) {
  const pdfLib = await loadPDFLibrary();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfLib.getDocument({ data: buffer }).promise;

  const results = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items into rows by Y position
    const rows = buildRowsFromTextContent(textContent);
    parseSheetData(rows, results);
  }

  return results;
}

/**
 * Build a row-based data structure from PDF text content
 * Groups text items by their Y coordinate to form rows,
 * then orders items within each row by X coordinate to form columns
 * @param {Object} textContent - PDF.js text content
 * @returns {Array<Array<string>>} rows of cell values
 */
function buildRowsFromTextContent(textContent) {
  if (!textContent || !textContent.items || textContent.items.length === 0) {
    return [];
  }

  // Group items by Y position (with tolerance for slight misalignment)
  const yTolerance = 3;
  const yGroups = [];

  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue;

    const y = Math.round(item.transform[5]);
    const x = Math.round(item.transform[4]);

    let found = false;
    for (const group of yGroups) {
      if (Math.abs(group.y - y) <= yTolerance) {
        group.items.push({ x, text: item.str.trim() });
        found = true;
        break;
      }
    }
    if (!found) {
      yGroups.push({ y, items: [{ x, text: item.str.trim() }] });
    }
  }

  // Sort rows top to bottom (PDF Y is bottom-up, so higher Y = earlier row)
  yGroups.sort((a, b) => b.y - a.y);

  // Determine column boundaries from X positions across all rows
  const allX = [];
  for (const group of yGroups) {
    for (const item of group.items) {
      allX.push(item.x);
    }
  }
  allX.sort((a, b) => a - b);

  // Cluster X positions into columns (tolerance 15px)
  const colTolerance = 15;
  const colPositions = [];
  for (const x of allX) {
    const existing = colPositions.find(c => Math.abs(c - x) <= colTolerance);
    if (!existing) {
      colPositions.push(x);
    }
  }
  colPositions.sort((a, b) => a - b);

  // Build rows
  const rows = [];
  for (const group of yGroups) {
    // Sort items left to right
    group.items.sort((a, b) => a.x - b.x);

    const row = new Array(colPositions.length).fill('');
    for (const item of group.items) {
      // Find closest column
      let bestCol = 0;
      let bestDist = Infinity;
      for (let c = 0; c < colPositions.length; c++) {
        const dist = Math.abs(colPositions[c] - item.x);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol = c;
        }
      }
      row[bestCol] = row[bestCol] ? row[bestCol] + ' ' + item.text : item.text;
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a CSV cuadrante file
 * Expected format: Fecha,Persona,Turno
 * Example: 2024-01-15,García López,G
 * Also accepts: dd/mm/yyyy or dd-mm-yyyy formats
 * @param {File} file - .csv file
 * @returns {Promise<Array<{date: string, person: string, code: string, tagType: string}>>}
 */
async function parseCuadranteCSV(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

  const results = [];
  let headers = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line) continue;

    // Parse CSV line (simple parser, handles basic quoting)
    const cells = parseCSVLine(line);

    // First line might be headers
    if (i === 0 && (
      cells[0]?.toLowerCase().includes('fecha') ||
      cells[1]?.toLowerCase().includes('persona') ||
      cells[2]?.toLowerCase().includes('turno')
    )) {
      headers = cells;
      continue;
    }

    // Parse data line
    if (cells.length >= 3) {
      const dateStr = cells[0].trim();
      const person = cells[1].trim();
      const code = cells[2].trim();

      if (!dateStr || !person || !code) continue;

      // Parse date (supports multiple formats)
      const dateISO = parseDateString(dateStr);
      if (!dateISO) continue;

      const tagType = mapCodeToTagType(code);
      if (!tagType) continue;

      results.push({
        date: dateISO,
        person,
        code: code.toUpperCase(),
        tagType
      });
    }
  }

  return results;
}

/**
 * Parse a plain text cuadrante (for WhatsApp messages)
 * Supports formats:
 * - "15/01 García López: G"
 * - "15-01-2024 Tesa: L"
 * - "2024-01-16 García: G"
 * - "16 enero García: G"
 * @param {File} file - .txt file
 * @returns {Promise<Array<{date: string, person: string, code: string, tagType: string}>>}
 */
async function parseCuadranteText(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

  const results = [];
  let currentYear = new Date().getFullYear();

  for (const line of lines) {
    // Skip empty lines or obvious non-data lines
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // Try to parse the line
    const entry = parseTextLine(line, currentYear);
    if (entry) {
      results.push(entry);
      // Update current year if we detected one in this line
      if (entry._detectedYear) {
        currentYear = entry._detectedYear;
        delete entry._detectedYear;
      }
    }
  }

  return results;
}

/**
 * Parse a single line of text format
 * @param {string} line
 * @param {number} defaultYear
 * @returns {object|null}
 */
function parseTextLine(line, defaultYear) {
  // Pattern: date person: code
  // Try to extract date, person, and code

  // Look for colon separator (person: code)
  const colonMatch = line.match(/^(.+?):(.+)$/);
  if (!colonMatch) return null;

  const beforeColon = colonMatch[1].trim();
  const code = colonMatch[2].trim();

  // Split before colon into date and person
  // Date patterns: dd/mm, dd-mm-yyyy, yyyy-mm-dd, dd month
  const datePatterns = [
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+(.+)$/,  // yyyy-mm-dd name or yyyy/mm/dd name
    /^(\d{1,2}[-/]\d{1,2}[-/]\d{4})\s+(.+)$/,  // dd-mm-yyyy name or dd/mm/yyyy name
    /^(\d{1,2}[-/]\d{1,2})\s+(.+)$/,            // dd-mm name or dd/mm name
    /^(\d{1,2})\s+([a-záéíóúñ]+)\s+(.+)$/i      // dd month name
  ];

  let dateStr = null;
  let person = null;
  let detectedYear = null;

  for (const pattern of datePatterns) {
    const match = beforeColon.match(pattern);
    if (match) {
      dateStr = match[1];
      person = pattern.toString().includes('month') ? match[3] : match[2];
      break;
    }
  }

  if (!dateStr || !person) return null;

  // Parse the date
  const dateISO = parseDateString(dateStr, defaultYear);
  if (!dateISO) return null;

  // Extract year if present
  const yearMatch = dateISO.match(/^(\d{4})/);
  if (yearMatch) {
    detectedYear = parseInt(yearMatch[1]);
  }

  const tagType = mapCodeToTagType(code);
  if (!tagType) return null;

  const result = {
    date: dateISO,
    person: person.trim(),
    code: code.toUpperCase(),
    tagType
  };

  if (detectedYear) {
    result._detectedYear = detectedYear;
  }

  return result;
}

/**
 * Parse a date string in various formats to ISO format (yyyy-mm-dd)
 * @param {string} dateStr
 * @param {number} defaultYear - year to use if not specified
 * @returns {string|null} ISO date or null
 */
function parseDateString(dateStr, defaultYear = new Date().getFullYear()) {
  if (!dateStr) return null;

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // yyyy-mm-dd with slashes
  const iso1 = dateStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso1) {
    const year = iso1[1];
    const month = iso1[2].padStart(2, '0');
    const day = iso1[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // dd-mm-yyyy or dd/mm/yyyy
  const dmy = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // dd-mm or dd/mm (use default year)
  const dm = dateStr.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dm) {
    const day = dm[1].padStart(2, '0');
    const month = dm[2].padStart(2, '0');
    return `${defaultYear}-${month}-${day}`;
  }

  // dd month (Spanish month names)
  const dmText = dateStr.match(/^(\d{1,2})\s+([a-záéíóúñ]+)$/i);
  if (dmText) {
    const day = dmText[1].padStart(2, '0');
    const monthName = dmText[2].toUpperCase();
    const monthIndex = SPANISH_MONTHS[monthName];
    if (monthIndex !== undefined) {
      const month = String(monthIndex + 1).padStart(2, '0');
      return `${defaultYear}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Parse a CSV line handling basic quoted fields
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Toggle quote state
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // End of cell
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last cell
  cells.push(current.trim());

  return cells;
}

/**
 * Parse raw sheet data looking for month blocks with shift assignments
 * @param {Array<Array>} rows
 * @param {Array} results - accumulator
 */
function parseSheetData(rows, results) {
  let currentYear = null;
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];

    // Look for year indicators (a cell containing a year number 2000-2100)
    for (const cell of row) {
      const num = typeof cell === 'number' ? cell : parseInt(cell);
      if (num >= 2000 && num <= 2100) {
        currentYear = num;
        break;
      }
    }

    // Look for month names in column A
    const cellA = String(row[0] || '').trim().toUpperCase();
    const monthIndex = SPANISH_MONTHS[cellA];

    if (monthIndex !== undefined && currentYear) {
      // Found a month block - next row should have day numbers, then data rows
      const dayNumberRow = rows[i + 1];
      if (!dayNumberRow) { i++; continue; }

      // Extract day numbers from the row (columns B onwards)
      const dayColumns = [];
      for (let col = 1; col < dayNumberRow.length; col++) {
        let dayNum = dayNumberRow[col];

        // Handle Excel serial dates
        if (typeof dayNum === 'number' && dayNum > 100) {
          const d = excelDateToJS(dayNum);
          dayNum = d.getDate();
        } else {
          dayNum = parseInt(dayNum);
        }

        if (dayNum >= 1 && dayNum <= 31) {
          dayColumns.push({ col, day: dayNum });
        }
      }

      if (dayColumns.length === 0) { i++; continue; }

      // Skip header row (weekday letters like L, M, X...) if present
      let dataStart = i + 2;
      if (rows[dataStart]) {
        const firstCell = String(rows[dataStart][1] || '').trim().toUpperCase();
        if (['L', 'M', 'X', 'J', 'V', 'S', 'D'].includes(firstCell)) {
          dataStart++;
        }
      }

      // Parse person data rows until we hit multiple empty rows or another month
      // Skip individual empty rows to handle inconsistent Excel formatting
      let consecutiveEmptyRows = 0;
      for (let r = dataStart; r < rows.length; r++) {
        const personRow = rows[r];
        if (!personRow || !personRow[0]) {
          consecutiveEmptyRows++;
          // Stop after 3 consecutive empty rows
          if (consecutiveEmptyRows >= 3) break;
          continue;
        }

        const personName = String(personRow[0]).trim();
        if (!personName) {
          consecutiveEmptyRows++;
          // Stop after 3 consecutive empty rows
          if (consecutiveEmptyRows >= 3) break;
          continue;
        }

        // Reset counter when we find a valid row
        consecutiveEmptyRows = 0;

        // Check if this row starts a new month
        const nameUpper = personName.toUpperCase();
        if (SPANISH_MONTHS[nameUpper] !== undefined) break;
        // Check if this is a year number
        const possibleYear = parseInt(personName);
        if (possibleYear >= 2000 && possibleYear <= 2100) break;

        // Extract shift codes for each day
        for (const { col, day } of dayColumns) {
          const rawCode = String(personRow[col] || '').trim();
          if (!rawCode) continue;

          const tagType = mapCodeToTagType(rawCode);
          if (!tagType) continue;

          // Build ISO date
          const month = String(monthIndex + 1).padStart(2, '0');
          const dayStr = String(day).padStart(2, '0');
          const dateISO = `${currentYear}-${month}-${dayStr}`;

          results.push({
            date: dateISO,
            person: personName,
            code: rawCode.toUpperCase(),
            tagType
          });
        }
      }
    }

    i++;
  }
}

/**
 * Filter parsed cuadrante data by person name (case-insensitive partial match)
 * @param {Array} entries - parsed cuadrante entries
 * @param {string} name - person name to filter by
 * @returns {Array}
 */
export function filterByPerson(entries, name) {
  const normalized = name.trim().toLowerCase();
  return entries.filter(e => e.person.toLowerCase().includes(normalized));
}

/**
 * Group entries by date
 * @param {Array} entries
 * @returns {Map<string, Array>}
 */
export function groupByDate(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (!map.has(entry.date)) {
      map.set(entry.date, []);
    }
    map.get(entry.date).push(entry);
  }
  return map;
}

/**
 * Get unique person names from parsed data
 * @param {Array} entries
 * @returns {string[]}
 */
export function getPersonNames(entries) {
  const names = new Set();
  for (const e of entries) {
    names.add(e.person);
  }
  return [...names].sort();
}
