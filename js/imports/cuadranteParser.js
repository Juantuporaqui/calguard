/**
 * @module imports/cuadranteParser
 * Parser for Excel shift schedule files (cuadrantes)
 * Imports .xlsx files and extracts shift assignments per person/date
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
 * @param {string} code - raw shift code from Excel
 * @returns {string|null} CalGuard tag type or null if unknown
 */
export function mapCodeToTagType(code) {
  if (!code || typeof code !== 'string') return null;
  const normalized = code.trim().toUpperCase();
  return CODE_MAP[normalized] || null;
}

/**
 * Parse an Excel cuadrante file
 * @param {File} file - .xlsx or .xls file
 * @returns {Promise<Array<{date: string, person: string, code: string, tagType: string}>>}
 */
export async function parseCuadrante(file) {
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

      // Parse person data rows until we hit an empty row or another month
      for (let r = dataStart; r < rows.length; r++) {
        const personRow = rows[r];
        if (!personRow || !personRow[0]) break;

        const personName = String(personRow[0]).trim();
        if (!personName) break;

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
