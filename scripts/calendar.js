// calendar.js

import { guardarDiaEnIndexedDB, obtenerConfiguracionDeIndexedDB, almacenarInteraccionDia } from './db.js';
import { formatDate, formatDateShort } from './utils.js';

// Variables globales relacionadas con el calendario
let daysLibres = 0;
let asuntosPropios = 8;
let libresGastados = 0;
let diasVacaciones = 25;
let diasPorGuardia = 5;
let asuntosAnuales = 8;
let asuntosPropiosLoaded = false;
const registroLibrados = [];
let vacationStart = null;
let vacationRanges = [];
let guardiasRealizadas = [];

// Función para generar el calendario anual
export function generateYearCalendar(year) {
    const yearCalendar = document.getElementById('year-calendar');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    months.forEach((month, monthIndex) => {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'month';

        const monthName = document.createElement('div');
        monthName.className = 'month-name';
        monthName.innerText = `${months[monthIndex]} ${year}`;
        monthDiv.appendChild(monthName);

        const calendarContainer = document.createElement('div');
        calendarContainer.className = 'calendar-container';

        const calendar = document.createElement('div');
        calendar.className = 'calendar';

        weekdays.forEach(day => {
            const weekdayDiv = document.createElement('div');
            weekdayDiv.className = 'weekday';
            weekdayDiv.innerText = day;
            calendar.appendChild(weekdayDiv);
        });

        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const firstDay = (new Date(year, monthIndex, 1).getDay() + 6) % 7;

        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day empty';
            calendar.appendChild(emptyDay);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day';
            dayDiv.innerText = i;
            dayDiv.dataset.date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            // Determinar si el día es sábado o domingo
            const dayOfWeek = new Date(year, monthIndex, i).getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                dayDiv.classList.add('weekend');
            }

            calendar.appendChild(dayDiv);
        }

        calendarContainer.appendChild(calendar);
        monthDiv.appendChild(calendarContainer);
        yearCalendar.appendChild(monthDiv);
    });
}

// Funciones relacionadas con el manejo de eventos del calendario
export function markWeekAsGuardia(dayElement) {
    // Implementación de la función para marcar una semana como guardia
    // ...
}

export function markProximaGuardia(dayElement) {
    // Implementación de la función para marcar la próxima guardia
    // ...
}

export function solicitarDiasGuardia(dayElement) {
    // Implementación de la función para solicitar días de guardia
    // ...
}

export function markAsuntoPropio(dayElement) {
    // Implementación de la función para marcar un asunto propio
    // ...
}

export function startVacaciones(dayElement) {
    // Implementación de la función para iniciar la selección de vacaciones
    // ...
}

export function markTarde(dayElement) {
    // Implementación de la función para marcar tarde
    // ...
}

export function markMañana(dayElement) {
    // Implementación de la función para marcar mañana
    // ...
}

export function markOtrosEventos(dayElement) {
    // Implementación de la función para marcar otros eventos
    // ...
}

export function removeEvento(dayElement) {
    // Implementación de la función para eliminar un evento
    // ...
}

// Otras funciones relacionadas con el calendario

// Función para actualizar los contadores
export function updateCounter() {
    // Actualizar los elementos de la interfaz con los nuevos valores
    document.getElementById('counter').innerText = daysLibres;
    document.getElementById('asunto-counter').innerText = asuntosPropios;
    document.getElementById('libres-gastados').innerText = libresGastados;
    document.getElementById('vacaciones-counter').innerText = diasVacaciones;

    // Guarda los valores actualizados en IndexedDB
    guardarConfiguracionEnIndexedDB('daysLibres', daysLibres);
    guardarConfiguracionEnIndexedDB('asuntosPropios', asuntosPropios);
    guardarConfiguracionEnIndexedDB('libresGastados', libresGastados);
    guardarConfiguracionEnIndexedDB('diasVacaciones', diasVacaciones);
}

// Exportar otras funciones si es necesario
