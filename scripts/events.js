// events.js

import { generateYearCalendar } from './calendar.js';
import { almacenarInteraccionDia, obtenerDiasDeIndexedDBYActualizarCalendario, cargarConfiguracion } from './db.js';
import { mostrarMensaje, mostrarDialogo, closeAllDropdowns } from './utils.js';

// Variables globales
let diasSeleccionados = [];
let seleccionDiaHandler;

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Generar el calendario para los años deseados
    generateYearCalendar(2024);
    generateYearCalendar(2025);
    generateYearCalendar(2026);

    // Cargar datos desde IndexedDB y actualizar el calendario
    cargarDatosDesdeIndexedDB();

    // Configurar los event listeners
    setupEventListeners();
});

function cargarDatosDesdeIndexedDB() {
    obtenerDiasDeIndexedDBYActualizarCalendario().then(() => {
        cargarConfiguracion().then(() => {
            // Actualizar contadores y otras configuraciones si es necesario
            updateCounter();
        });
    });
}

function setupEventListeners() {
    // Manejar los clics en los días del calendario
    document.querySelectorAll('.day').forEach(dayElement => {
        dayElement.addEventListener('click', (event) => {
            const date = dayElement.dataset.date;
            showDropdownMenu(event, dayElement, date);
        });
    });

    // Manejar los botones de los menús flotantes
    document.querySelector('.floating-button.right').addEventListener('click', toggleCounterMenu);
    document.querySelector('.floating-button.left').addEventListener('click', toggleConfigMenu);

    // Otros event listeners globales
    document.addEventListener('click', handleGlobalClick);
}

function showDropdownMenu(event, dayElement, date) {
    closeAllDropdowns();

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';

    // Crear los botones del menú
    const opciones = [
        { texto: 'Guardia', accion: () => markWeekAsGuardia(dayElement) },
        { texto: 'Próx. Guardia', accion: () => markProximaGuardia(dayElement) },
        { texto: 'Pedir Días', accion: () => solicitarDiasGuardia(dayElement) },
        { texto: 'A. Propio', accion: () => markAsuntoPropio(dayElement) },
        { texto: 'Vacaciones', accion: () => startVacaciones(dayElement) },
        { texto: 'Tarde', accion: () => markTarde(dayElement) },
        { texto: 'Otros', accion: () => markOtrosEventos(dayElement) },
        { texto: 'Mañana', accion: () => markMañana(dayElement) },
        { texto: 'Eliminar', accion: () => removeEvento(dayElement) },
    ];

    opciones.forEach(opcion => {
        const button = document.createElement('button');
        button.innerText = opcion.texto;
        button.onclick = () => {
            opcion.accion();
            closeAllDropdowns();
        };
        dropdown.appendChild(button);
    });

    document.body.appendChild(dropdown);

    // Posicionar el menú desplegable
    const rect = dayElement.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;

    // Mostrar overlay
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'block';
    overlay.onclick = closeAllDropdowns;
}

function handleGlobalClick(event) {
    const counterMenu = document.getElementById('counter-menu');
    const configMenu = document.getElementById('config-menu');
    const isClickInsideCounter = counterMenu.contains(event.target);
    const isClickInsideConfig = configMenu.contains(event.target);
    const isClickOnCounterButton = event.target.matches('.floating-button.right');
    const isClickOnConfigButton = event.target.matches('.floating-button.left');

    if (!isClickInsideCounter && !isClickOnCounterButton) {
        counterMenu.style.display = 'none';
    }
    if (!isClickInsideConfig && !isClickOnConfigButton) {
        configMenu.style.display = 'none';
    }
}

// Aquí puedes agregar más funciones relacionadas con eventos y lógica de interacción
// Por ejemplo, funciones para manejar la selección de días, confirmación de acciones, etc.

// Exportar funciones si es necesario (por ejemplo, para pruebas)
