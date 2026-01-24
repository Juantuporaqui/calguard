// utils.js - Funciones utilitarias

import { getLastSelectedDay, setLastSelectedDay } from './events.js';

// ============================
// TEMA OSCURO
// ============================

const THEME_KEY = 'calguard-theme';

/**
 * Inicializa el tema
 */
export function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const themeToggle = document.getElementById('theme-toggle');

    if (!themeToggle) {
        console.error('Botón de tema no encontrado');
        return;
    }

    // Aplicar tema guardado o detectar preferencia del sistema
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }

    // Event listener para el botón de tema
    themeToggle.addEventListener('click', toggleTheme);

    // Escuchar cambios en la preferencia del sistema
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem(THEME_KEY)) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
}

/**
 * Aplica un tema
 * @param {string} theme - 'light' o 'dark'
 */
function applyTheme(theme) {
    const themeToggle = document.getElementById('theme-toggle');

    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggle) themeToggle.textContent = '☀️';
    } else {
        document.body.classList.remove('dark-theme');
        if (themeToggle) themeToggle.textContent = '🌙';
    }

    localStorage.setItem(THEME_KEY, theme);
}

/**
 * Alterna entre tema claro y oscuro
 */
function toggleTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    applyTheme(isDark ? 'light' : 'dark');
}

/**
 * Obtiene el tema actual
 * @returns {string} - 'light' o 'dark'
 */
export function getCurrentTheme() {
    return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
}

// ============================
// EXPORTACIÓN DE DATOS
// ============================

/**
 * Inicializa la funcionalidad de exportación
 */
export function initExport() {
    const exportBtn = document.getElementById('export-button');
    if (exportBtn) {
        exportBtn.addEventListener('click', showExportMenu);
    }
}

/**
 * Muestra el menú de exportación
 */
function showExportMenu() {
    const menu = document.createElement('div');
    menu.className = 'popup';
    menu.innerHTML = `
        <h3 style="margin-bottom: 16px; color: var(--accent-color);">Exportar Datos</h3>
        <p style="margin-bottom: 16px;">Selecciona el formato de exportación:</p>
        <button class="btn btn-primary" id="export-json">Exportar como JSON</button>
        <button class="btn btn-secondary" id="export-csv">Exportar como CSV</button>
        <button class="btn btn-warning" id="export-cancel">Cancelar</button>
    `;

    document.body.appendChild(menu);

    // Event listeners
    document.getElementById('export-json').addEventListener('click', () => {
        exportDataAsJSON();
        menu.remove();
    });

    document.getElementById('export-csv').addEventListener('click', () => {
        exportDataAsCSV();
        menu.remove();
    });

    document.getElementById('export-cancel').addEventListener('click', () => {
        menu.remove();
    });
}

/**
 * Exporta los datos como JSON
 */
async function exportDataAsJSON() {
    try {
        // Importar dinámicamente para evitar circular dependency
        const { exportCalendarState } = await import('./calendar.js');
        const { exportAppData } = await import('./events.js');

        const data = await exportAppData();
        const calendarState = exportCalendarState();

        const exportData = {
            version: '2.0',
            appName: 'CalGuard',
            ...data,
            calendarState
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `calguard-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
        mostrarMensaje('Datos exportados correctamente como JSON');
    } catch (error) {
        console.error('Error al exportar JSON:', error);
        mostrarMensaje('Error al exportar los datos');
    }
}

/**
 * Exporta los datos como CSV
 */
async function exportDataAsCSV() {
    try {
        const { exportAppData } = await import('./events.js');
        const data = await exportAppData();

        // Crear CSV de registro de días
        let csv = 'Fecha,Tipo,Descripción\n';

        if (data.registroLibrados && data.registroLibrados.length > 0) {
            data.registroLibrados.forEach(entry => {
                const tipo = entry.tipo || 'N/A';
                const fecha = entry.fecha || 'N/A';
                const texto = (entry.texto || '').replace(/"/g, '""');
                csv += `"${fecha}","${tipo}","${texto}"\n`;
            });
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `calguard-registro-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        URL.revokeObjectURL(url);
        mostrarMensaje('Datos exportados correctamente como CSV');
    } catch (error) {
        console.error('Error al exportar CSV:', error);
        mostrarMensaje('Error al exportar los datos');
    }
}

// ============================
// MENSAJES Y DIÁLOGOS
// ============================

/**
 * Muestra un mensaje temporal
 * @param {string} mensaje - Mensaje a mostrar
 * @param {number} duracion - Duración en ms (por defecto 3000)
 */
export function mostrarMensaje(mensaje, duracion = 3000) {
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = 'mensaje-notificacion';
    mensajeDiv.innerText = mensaje;

    document.body.appendChild(mensajeDiv);

    setTimeout(() => {
        mensajeDiv.style.opacity = '0';
        setTimeout(() => mensajeDiv.remove(), 300);
    }, duracion);
}

/**
 * Muestra un diálogo modal
 * @param {string} mensaje - Mensaje a mostrar
 * @param {Function} callback - Función a ejecutar al aceptar
 */
export function mostrarDialogo(mensaje, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-dialogo';
    overlay.style.display = 'flex';

    const dialogo = document.createElement('div');
    dialogo.className = 'dialogo-mensaje';
    dialogo.innerHTML = `<p>${mensaje}</p>`;

    const botonAceptar = document.createElement('button');
    botonAceptar.innerText = 'Aceptar';
    botonAceptar.className = 'btn btn-primary';
    botonAceptar.onclick = () => {
        document.body.removeChild(overlay);
        if (callback) callback();
    };

    dialogo.appendChild(botonAceptar);
    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    // Cerrar con Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            botonAceptar.click();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Muestra un diálogo de confirmación
 * @param {string} mensaje - Mensaje a mostrar
 * @param {Function} onConfirm - Función a ejecutar si se confirma
 * @param {Function} onCancel - Función a ejecutar si se cancela
 */
export function mostrarConfirmacion(mensaje, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-dialogo';
    overlay.style.display = 'flex';

    const dialogo = document.createElement('div');
    dialogo.className = 'dialogo-mensaje';
    dialogo.innerHTML = `<p>${mensaje}</p>`;

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '8px';
    btnContainer.style.marginTop = '16px';

    const botonConfirmar = document.createElement('button');
    botonConfirmar.innerText = 'Confirmar';
    botonConfirmar.className = 'btn btn-primary';
    botonConfirmar.style.flex = '1';
    botonConfirmar.onclick = () => {
        document.body.removeChild(overlay);
        if (onConfirm) onConfirm();
    };

    const botonCancelar = document.createElement('button');
    botonCancelar.innerText = 'Cancelar';
    botonCancelar.className = 'btn btn-secondary';
    botonCancelar.style.flex = '1';
    botonCancelar.onclick = () => {
        document.body.removeChild(overlay);
        if (onCancel) onCancel();
    };

    btnContainer.appendChild(botonConfirmar);
    btnContainer.appendChild(botonCancelar);
    dialogo.appendChild(btnContainer);
    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    // Cerrar con Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            botonCancelar.click();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Cierra todos los menús desplegables
 */
export function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    dropdowns.forEach(dropdown => dropdown.remove());

    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.onclick = null;
    }

    // Obtener el último día seleccionado
    const lastSelectedDay = getLastSelectedDay();

    if (lastSelectedDay) {
        lastSelectedDay.classList.remove('selected');
        setLastSelectedDay(null);
    }
}

// ============================
// FUNCIONES DE FORMATO
// ============================

/**
 * Formatea una fecha en formato DD/MM/YYYY
 * @param {Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
export function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Formatea una fecha en formato DD/MM
 * @param {Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
export function formatDateShort(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}

/**
 * Formatea una fecha en formato ISO (YYYY-MM-DD)
 * @param {Date} date - Fecha a formatear
 * @returns {string} - Fecha en formato ISO
 */
export function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}

// ============================
// FUNCIONES DE RANGO DE FECHAS
// ============================

/**
 * Obtiene todos los días en un rango
 * @param {Date} startDate - Fecha de inicio
 * @param {Date} endDate - Fecha de fin
 * @returns {Array<Date>} - Array de fechas
 */
export function getDaysInRange(startDate, endDate) {
    const dateArray = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        dateArray.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return dateArray;
}

/**
 * Obtiene la semana completa (lunes a domingo) de una fecha
 * @param {Date} fecha - Fecha de referencia
 * @returns {Array<Date>} - Array con las 7 fechas de la semana
 */
export function obtenerSemana(fecha) {
    const startOfWeek = new Date(fecha);
    const dayOfWeek = startOfWeek.getDay();

    // Ajustar para que la semana empiece el lunes (lunes = 0)
    const diff = (dayOfWeek + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - diff);

    const week = [];
    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        week.push(currentDay);
    }

    return week;
}

/**
 * Verifica si una fecha es fin de semana
 * @param {Date} date - Fecha a verificar
 * @returns {boolean} - True si es fin de semana
 */
export function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}

/**
 * Cuenta los días laborables en un rango (excluyendo fines de semana)
 * @param {Date} startDate - Fecha de inicio
 * @param {Date} endDate - Fecha de fin
 * @returns {number} - Número de días laborables
 */
export function countWorkdays(startDate, endDate) {
    const days = getDaysInRange(startDate, endDate);
    return days.filter(date => !isWeekend(date)).length;
}

// ============================
// VALIDACIÓN
// ============================

/**
 * Valida un número dentro de un rango
 * @param {number} value - Valor a validar
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {boolean} - True si es válido
 */
export function validateNumber(value, min, max) {
    return !isNaN(value) && value >= min && value <= max;
}

/**
 * Sanitiza texto para prevenir XSS
 * @param {string} text - Texto a sanitizar
 * @returns {string} - Texto sanitizado
 */
export function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================
// ALMACENAMIENTO LOCAL
// ============================

/**
 * Guarda un valor en localStorage de forma segura
 * @param {string} key - Clave
 * @param {any} value - Valor a guardar
 */
export function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error al guardar en localStorage:', error);
    }
}

/**
 * Obtiene un valor de localStorage de forma segura
 * @param {string} key - Clave
 * @param {any} defaultValue - Valor por defecto si no existe
 * @returns {any} - Valor guardado o valor por defecto
 */
export function getFromLocalStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Error al leer de localStorage:', error);
        return defaultValue;
    }
}

// ============================
// UTILIDADES DOM
// ============================

/**
 * Espera a que el DOM esté cargado
 * @param {Function} callback - Función a ejecutar
 */
export function onDOMReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

/**
 * Debounce para funciones
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} - Función con debounce
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
