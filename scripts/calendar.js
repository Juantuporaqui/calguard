// calendar.js - Módulo de generación de calendario

import { formatDate, formatDateShort } from './utils.js';

// Estado del calendario
let currentYear = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = 2050;

/**
 * Inicializa el selector de año
 */
export function initYearSelector() {
    const yearSelect = document.getElementById('year-select');
    const prevYearBtn = document.getElementById('prev-year');
    const nextYearBtn = document.getElementById('next-year');

    if (!yearSelect || !prevYearBtn || !nextYearBtn) {
        console.error('Elementos de navegación de año no encontrados');
        return;
    }

    // Llenar el selector de años
    yearSelect.innerHTML = '';
    for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }

    // Event listeners
    yearSelect.addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value);
        refreshCalendar();
    });

    prevYearBtn.addEventListener('click', () => {
        if (currentYear > MIN_YEAR) {
            currentYear--;
            yearSelect.value = currentYear;
            refreshCalendar();
        }
    });

    nextYearBtn.addEventListener('click', () => {
        if (currentYear < MAX_YEAR) {
            currentYear++;
            yearSelect.value = currentYear;
            refreshCalendar();
        }
    });
}

/**
 * Obtiene el año actual
 */
export function getCurrentYear() {
    return currentYear;
}

/**
 * Establece el año actual
 */
export function setCurrentYear(year) {
    if (year >= MIN_YEAR && year <= MAX_YEAR) {
        currentYear = year;
        const yearSelect = document.getElementById('year-select');
        if (yearSelect) {
            yearSelect.value = year;
        }
    }
}

/**
 * Refresca el calendario completo
 */
function refreshCalendar() {
    const yearCalendar = document.getElementById('year-calendar');
    if (!yearCalendar) {
        console.error('Contenedor del calendario no encontrado');
        return;
    }

    // Limpiar el calendario
    yearCalendar.innerHTML = '';

    // Regenerar el calendario para el año actual
    generateYearCalendar(currentYear);

    // Disparar evento personalizado para que events.js recargue los datos
    const event = new CustomEvent('calendarRefreshed', { detail: { year: currentYear } });
    document.dispatchEvent(event);
}

/**
 * Genera el calendario anual
 * @param {number} year - Año para generar el calendario
 */
export function generateYearCalendar(year) {
    const yearCalendar = document.getElementById('year-calendar');
    if (!yearCalendar) {
        console.error('Contenedor del calendario no encontrado');
        return;
    }

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    months.forEach((monthName, monthIndex) => {
        const monthDiv = createMonthElement(year, monthIndex, monthName, weekdays);
        yearCalendar.appendChild(monthDiv);
    });
}

/**
 * Crea un elemento de mes completo
 * @param {number} year - Año
 * @param {number} monthIndex - Índice del mes (0-11)
 * @param {string} monthName - Nombre del mes
 * @param {Array} weekdays - Nombres de los días de la semana
 * @returns {HTMLElement} - Elemento del mes
 */
function createMonthElement(year, monthIndex, monthName, weekdays) {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'month';
    monthDiv.dataset.month = monthIndex;
    monthDiv.dataset.year = year;

    // Nombre del mes
    const monthNameDiv = document.createElement('div');
    monthNameDiv.className = 'month-name';
    monthNameDiv.innerText = `${monthName} ${year}`;
    monthDiv.appendChild(monthNameDiv);

    // Contenedor del calendario
    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'calendar-container';

    const calendar = document.createElement('div');
    calendar.className = 'calendar';
    calendar.setAttribute('role', 'grid');
    calendar.setAttribute('aria-label', `Calendario de ${monthName} ${year}`);

    // Agregar encabezados de días de la semana
    weekdays.forEach(day => {
        const weekdayDiv = document.createElement('div');
        weekdayDiv.className = 'weekday';
        weekdayDiv.innerText = day;
        weekdayDiv.setAttribute('role', 'columnheader');
        calendar.appendChild(weekdayDiv);
    });

    // Calcular días del mes
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDay = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // Lunes = 0

    // Agregar días vacíos al inicio
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'day empty';
        emptyDay.setAttribute('aria-hidden', 'true');
        calendar.appendChild(emptyDay);
    }

    // Agregar días del mes
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = createDayElement(year, monthIndex, day);
        calendar.appendChild(dayDiv);
    }

    calendarContainer.appendChild(calendar);
    monthDiv.appendChild(calendarContainer);

    return monthDiv;
}

/**
 * Crea un elemento de día
 * @param {number} year - Año
 * @param {number} monthIndex - Índice del mes (0-11)
 * @param {number} day - Día del mes
 * @returns {HTMLElement} - Elemento del día
 */
function createDayElement(year, monthIndex, day) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day';
    dayDiv.innerText = day;
    dayDiv.dataset.date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dayDiv.setAttribute('role', 'gridcell');
    dayDiv.setAttribute('tabindex', '0');
    dayDiv.setAttribute('aria-label', `Día ${day}`);

    // Determinar si es fin de semana
    const dayOfWeek = new Date(year, monthIndex, day).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        dayDiv.classList.add('weekend');
    }

    // Marcar el día actual
    const today = new Date();
    if (year === today.getFullYear() &&
        monthIndex === today.getMonth() &&
        day === today.getDate()) {
        dayDiv.classList.add('today');
        dayDiv.setAttribute('aria-current', 'date');
    }

    // Agregar soporte para teclado
    dayDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dayDiv.click();
        }
    });

    return dayDiv;
}

/**
 * Obtiene todos los elementos de día del calendario
 * @returns {NodeList} - Lista de elementos de día
 */
export function getAllDayElements() {
    return document.querySelectorAll('.day:not(.empty)');
}

/**
 * Obtiene un elemento de día por su fecha
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @returns {HTMLElement|null} - Elemento del día o null si no se encuentra
 */
export function getDayElement(dateStr) {
    return document.querySelector(`.day[data-date="${dateStr}"]`);
}

/**
 * Limpia todas las marcas del calendario
 */
export function clearAllMarks() {
    const allDays = getAllDayElements();
    allDays.forEach(day => {
        day.className = 'day';
        day.style = '';

        // Restaurar clase de fin de semana si aplica
        const date = new Date(day.dataset.date);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            day.classList.add('weekend');
        }

        // Restaurar clase de hoy si aplica
        const today = new Date();
        if (date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()) {
            day.classList.add('today');
        }

        // Remover etiquetas adicionales
        const labels = day.querySelectorAll('.tarde-label, .mañana-label, .otros-eventos-label');
        labels.forEach(label => label.remove());
    });
}

/**
 * Exporta el estado del calendario
 * @returns {Object} - Objeto con la configuración del calendario
 */
export function exportCalendarState() {
    const days = [];
    const allDays = getAllDayElements();

    allDays.forEach(dayElement => {
        const classes = Array.from(dayElement.classList);
        const tipos = classes.filter(c =>
            ['guardia', 'libre', 'asunto', 'vacaciones', 'proxima-guardia'].includes(c)
        );

        if (tipos.length > 0) {
            days.push({
                fecha: dayElement.dataset.date,
                tipos: tipos,
                labels: {
                    tarde: !!dayElement.querySelector('.tarde-label'),
                    mañana: !!dayElement.querySelector('.mañana-label'),
                    otros: dayElement.dataset.conceptoCompleto || null
                }
            });
        }
    });

    return {
        year: currentYear,
        days: days,
        exportDate: new Date().toISOString()
    };
}
