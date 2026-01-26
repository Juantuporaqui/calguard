// cuadranteParser.js
// Parser robusto para cuadrantes Excel que ignora plantillas sin fecha/año real

/**
 * Convierte número serial de Excel a Date
 * Excel 1900-date system: 25569 = días entre 1899-12-30 y 1970-01-01
 */
function excelSerialToDate(n) {
    const utcDays = Math.floor(n - 25569);
    return new Date(utcDays * 86400 * 1000);
}

/**
 * Verifica si un valor es un año válido (2000-2100)
 */
function isYearCell(v) {
    return Number.isInteger(v) && v >= 2000 && v <= 2100;
}

/**
 * Verifica si un valor es un serial de fecha Excel (rango razonable)
 */
function isExcelSerialDate(v) {
    return typeof v === 'number' && v >= 30000 && v <= 60000;
}

/**
 * Normaliza nombres de mes quitando espacios (ej: "E   N   E   R   O" -> "ENERO")
 */
function normalizeMonthName(s) {
    return String(s || '')
        .toUpperCase()
        .replace(/\s+/g, '')
        .trim();
}

const MONTHS = new Set([
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]);

/**
 * Parsea un ArrayBuffer de Excel de cuadrantes
 * Retorna array de { date: 'YYYY-MM-DD', person: string, code: string }
 *
 * IMPORTANTE: Ignora bloques "plantilla" (sin año/fecha real) y empieza
 * desde el primer bloque con año (2024, 2025...) o fecha real en columna A
 */
export async function parseCuadrante(arrayBuffer) {
    // Cargar XLSX dinámicamente desde CDN
    const XLSX = await loadXLSX();

    const wb = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,    // Convierte fechas automáticamente
        raw: true
    });

    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    // 1) Localizar el primer bloque "válido" (año o fecha real)
    let startRow = -1;
    for (let r = 0; r < rows.length; r++) {
        const a = rows[r][0];
        if (isYearCell(a)) { startRow = r; break; }
        if (a instanceof Date) { startRow = r; break; }
        if (isExcelSerialDate(a)) { startRow = r; break; }
    }

    if (startRow === -1) {
        throw new Error('No se encontró año/fecha ancla en el Excel. Verifica que el archivo tenga bloques con años (2024, 2025...) o fechas reales.');
    }

    console.log(`[CuadranteParser] Bloque válido encontrado en fila ${startRow + 1}`);

    // 2) Recorrer desde startRow y extraer meses reales
    const out = []; // [{date, person, code}]
    let currentYear = null;

    for (let r = startRow; r < rows.length; r++) {
        const a = rows[r][0];

        // Detectar año
        if (isYearCell(a)) {
            currentYear = a;
            console.log(`[CuadranteParser] Año detectado: ${currentYear} en fila ${r + 1}`);
            continue;
        }

        // Detectar mes (en col A)
        const maybeMonth = normalizeMonthName(a);
        if (MONTHS.has(maybeMonth)) {
            // Estructura típica del archivo (bloque 2024+):
            // r   : "ENERO"
            // r+1 : [Date(YYYY-01-01), 1,2,3...]
            // r+2 : [null, 'L','M','X'...]
            // r+3.. : personas (col0) + códigos en columnas días

            const dayRow = rows[r + 1];
            if (!dayRow) continue;

            // Fecha base (col A) puede venir como Date o serial
            let base = dayRow[0];
            if (isExcelSerialDate(base)) {
                base = excelSerialToDate(base);
            }

            if (!(base instanceof Date)) {
                // Si aquí no hay fecha, es un mes "plantilla". Se ignora.
                console.log(`[CuadranteParser] Ignorando mes plantilla "${maybeMonth}" en fila ${r + 1} (sin fecha base)`);
                continue;
            }

            console.log(`[CuadranteParser] Procesando ${maybeMonth} ${base.getFullYear()} desde fila ${r + 1}`);

            // Determinar cuántos días hay (1..28/29/30/31)
            // Los días están en columnas 1..31 (col0 es la fecha)
            let lastDayCol = 1;
            for (let c = 1; c < dayRow.length && c <= 32; c++) {
                if (Number.isInteger(dayRow[c]) && dayRow[c] >= 1 && dayRow[c] <= 31) {
                    lastDayCol = c;
                } else if (dayRow[c] !== null && dayRow[c] !== undefined) {
                    break;
                }
            }

            // Filas de personas empiezan en r+3 hasta que llegue otro mes/año o fila vacía
            for (let rr = r + 3; rr < rows.length; rr++) {
                const name = rows[rr][0];

                // Fin de bloque
                const nm = normalizeMonthName(name);
                if (isYearCell(name) || MONTHS.has(nm)) break;
                if (name == null || String(name).trim() === '') break;

                for (let c = 1; c <= lastDayCol; c++) {
                    const code = rows[rr][c];
                    if (code == null || String(code).trim() === '') continue;

                    const d = dayRow[c];
                    if (!Number.isInteger(d)) continue;

                    const date = new Date(base.getFullYear(), base.getMonth(), d);
                    out.push({
                        date: date.toISOString().slice(0, 10),
                        person: String(name).trim(),
                        code: String(code).trim()
                    });
                }
            }
        }
    }

    console.log(`[CuadranteParser] Total registros extraídos: ${out.length}`);
    return out;
}

/**
 * Carga la librería XLSX desde CDN
 */
async function loadXLSX() {
    if (window.XLSX) {
        return window.XLSX;
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => {
            if (window.XLSX) {
                resolve(window.XLSX);
            } else {
                reject(new Error('XLSX no se cargó correctamente'));
            }
        };
        script.onerror = () => reject(new Error('Error al cargar librería XLSX'));
        document.head.appendChild(script);
    });
}

/**
 * Filtra los registros del cuadrante para un usuario específico
 */
export function filterCuadranteByPerson(data, personName) {
    const normalizedName = personName.toUpperCase().trim();
    return data.filter(entry =>
        entry.person.toUpperCase().includes(normalizedName)
    );
}

/**
 * Agrupa los registros por fecha
 */
export function groupCuadranteByDate(data) {
    const grouped = {};
    data.forEach(entry => {
        if (!grouped[entry.date]) {
            grouped[entry.date] = [];
        }
        grouped[entry.date].push(entry);
    });
    return grouped;
}

/**
 * Mapea códigos de cuadrante a tipos de día del calendario
 */
export function mapCodeToTipo(code) {
    const upperCode = code.toUpperCase().trim();

    // Mapeo de códigos comunes
    const codeMap = {
        'G': 'guardia',
        'GU': 'guardia',
        'GUARDIA': 'guardia',
        'L': 'libre',
        'LI': 'libre',
        'LIBRE': 'libre',
        'V': 'vacaciones',
        'VC': 'vacaciones',
        'VAC': 'vacaciones',
        'VACACIONES': 'vacaciones',
        'AP': 'asunto',
        'A.P.': 'asunto',
        'ASUNTO': 'asunto',
        'T': 'tarde',
        'TA': 'tarde',
        'TARDE': 'tarde',
        'M': 'mañana',
        'MA': 'mañana',
        'MAÑANA': 'mañana'
    };

    return codeMap[upperCode] || 'otros';
}
