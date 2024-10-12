// events.js

import { generateYearCalendar } from './calendar.js';
import {
    initIndexedDB,
    guardarDiaEnIndexedDB,
    obtenerDiasDeIndexedDB,
    eliminarDiaDeIndexedDB,
    guardarConfiguracionEnIndexedDB,
    obtenerConfiguracionDeIndexedDB,
    saveRegistroLibradosToIndexedDB,
    loadRegistroLibradosFromIndexedDB,
    resetIndexedDB
} from './db.js';
import {
    formatDate,
    formatDateShort,
    mostrarMensaje,
    mostrarDialogo,
    closeAllDropdowns,
    getDaysInRange,
    obtenerSemana
} from './utils.js';

// Variables globales
let db;
let daysLibres = 0;
let asuntosPropios = 8;
let libresGastados = 0;
let diasVacaciones = 25;
let diasPorGuardia = 5;
let asuntosAnuales = 8;
let asuntosPropiosLoaded = false;
let registroLibrados = [];
let vacationStart = null;
let vacationRanges = [];
let guardiasRealizadas = [];
let diasSeleccionados = [];
let seleccionDiaHandler;
let lastSelectedDay = null;// <-- Declaración de lastSelectedDay

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    initIndexedDB().then((database) => {
        db = database;
        inicializarAplicacion();
    }).catch((error) => {
        console.error("Error al inicializar IndexedDB:", error);
    });
});

function inicializarAplicacion() {
    generateYearCalendar(2024);
    generateYearCalendar(2025);
    generateYearCalendar(2026);

    // Asignar eventos a los días del calendario
    document.querySelectorAll('.day').forEach(dayElement => {
        dayElement.onclick = (event) => showDropdownMenu(event, dayElement);
    });

    obtenerDiasDeIndexedDB(db).then((dias) => {
        dias.forEach((diaData) => {
            const diaDiv = document.querySelector(`.day[data-date="${diaData.fecha}"]`);
            if (diaDiv) {
                diaDiv.classList.add(diaData.tipo);

                switch (diaData.tipo) {
                    case 'asunto':
                        // Ya se agregó la clase
                        break;
                    case 'proxima-guardia':
                        // Ya se agregó la clase
                        break;
                    case 'libre':
                        // Ya se agregó la clase
                        break;
                    case 'vacaciones':
                        // Ya se agregó la clase
                        break;
                    case 'tarde':
                        restaurarTarde(diaDiv);
                        break;
                    case 'otros':
                        if (diaData.detalle && diaData.detalle.diasAfectados) {
                            restaurarOtrosEventos(diaDiv, diaData.detalle.concepto, diaData.detalle.diasAfectados);
                        }
                        break;
                    case 'guardia':
                        // Ya se agregó la clase
                        break;
                    case 'mañana':
                        restaurarMañana(diaDiv);
                        break;
                }
            }
        });
        updateCounter();
    });

    obtenerConfiguracionDeIndexedDB(db).then((configuraciones) => {
        configuraciones.forEach(config => {
            switch (config.clave) {
                case 'diasPorGuardia':
                    diasPorGuardia = config.valor;
                    document.getElementById('dias-guardia').value = config.valor;
                    break;
                case 'asuntosAnuales':
                    asuntosAnuales = config.valor;
                    asuntosPropios = config.valor;
                    document.getElementById('asuntos-anuales').value = config.valor;
                    break;
                case 'asuntosPropios':
                    if (!asuntosPropiosLoaded) {
                        asuntosPropios = config.valor;
                        asuntosPropiosLoaded = true;
                    }
                    break;
                case 'diasVacaciones':
                    diasVacaciones = config.valor;
                    document.getElementById('dias-vacaciones').value = config.valor;
                    break;
                case 'diasExtra':
                    daysLibres += config.valor;
                    document.getElementById('dias-extra').value = config.valor;
                    break;
                case 'daysLibres':
                    daysLibres = config.valor;
                    break;
                case 'libresGastados':
                    libresGastados = config.valor;
                    break;
                case 'guardiasRealizadas':
                guardiasRealizadas = config.valor || [];
                break;   
            }
        });
        updateCounter();
    });

    loadRegistroLibradosFromIndexedDB(db).then((registro) => {
        registroLibrados = registro;
        updateRegistroLibrados();
    });

    checkGuardiaProxima();
    setInterval(checkGuardiaProxima, 86400000);
}

// Funciones de manejo de eventos y lógica de la aplicación

export function getLastSelectedDay() {
    return lastSelectedDay;
}

export function setLastSelectedDay(day) {
    lastSelectedDay = day;
}

function showDropdownMenu(event, dayElement) {
    closeAllDropdowns();
 // Desmarcar el último día seleccionado si existe y no se realizó ninguna acción sobre él
    if (lastSelectedDay && lastSelectedDay !== dayElement) {
        lastSelectedDay.classList.remove('selected'); // Eliminar la clase de resaltado
    }

    // Guardar el día actualmente seleccionado
    lastSelectedDay = dayElement;
    dayElement.classList.add('selected'); // Resaltar el día actual
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';

    // Crear los botones del menú
    const guardiaButton = document.createElement('button');
    guardiaButton.innerText = 'Guardia';
    guardiaButton.onclick = () => {
        markWeekAsGuardia(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(guardiaButton);

    const proximaGuardiaButton = document.createElement('button');
    proximaGuardiaButton.innerText = 'Próx. Guardia';
    proximaGuardiaButton.onclick = () => {
        markProximaGuardia(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(proximaGuardiaButton);

    const pedirDiasButton = document.createElement('button');
    pedirDiasButton.innerText = 'Pedir Días';
    pedirDiasButton.onclick = () => {
        solicitarDiasGuardia(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(pedirDiasButton);

    const asuntoButton = document.createElement('button');
    asuntoButton.innerText = 'A. Propio';
    asuntoButton.onclick = () => {
        markAsuntoPropio(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(asuntoButton);

    const vacacionesButton = document.createElement('button');
    vacacionesButton.innerText = 'Vacaciones';
    vacacionesButton.onclick = () => {
        startVacaciones(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(vacacionesButton);

    const tardeButton = document.createElement('button');
    tardeButton.innerText = 'Tarde';
    tardeButton.onclick = () => {
        markTarde(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(tardeButton);

    const otrosEventosButton = document.createElement('button');
    otrosEventosButton.innerText = 'Otros';
    otrosEventosButton.onclick = () => {
        markOtrosEventos(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(otrosEventosButton);

    const mañanaButton = document.createElement('button');
    mañanaButton.innerText = 'Mañana';
    mañanaButton.onclick = () => {
        markMañana(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(mañanaButton);

    const eliminarButton = document.createElement('button');
    eliminarButton.innerText = 'Eliminar';
    eliminarButton.onclick = () => {
        removeEvento(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(eliminarButton);

    document.body.appendChild(dropdown);

    const rect = dayElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownWidth = dropdown.offsetWidth;
    const dropdownHeight = dropdown.offsetHeight;

    let top = rect.top + window.pageYOffset + rect.height;
    let left = rect.left + window.pageXOffset;

    if ((rect.left + dropdownWidth) > viewportWidth) {
        left = rect.left + window.pageXOffset - dropdownWidth;
    }

    if ((rect.top + dropdownHeight) > viewportHeight) {
        top = rect.top + window.pageYOffset - dropdownHeight;
    }

    if (rect.left < 0) {
        left = 0;
    }

    if (rect.top < 0) {
        top = rect.top + window.pageYOffset + rect.height;
    }

    dropdown.style.position = 'absolute';
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;

    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.style.display = 'block';
        overlay.onclick = closeAllDropdowns;
    }
}

function toggleCounterMenu() {
    const counterMenu = document.getElementById('counter-menu');
    if (counterMenu.style.display === 'block') {
        counterMenu.style.display = 'none';
    } else {
        counterMenu.style.display = 'block';
    }
}

function toggleConfigMenu() {
    const configMenu = document.getElementById('config-menu');
    if (configMenu.style.display === 'block') {
        configMenu.style.display = 'none';
    } else {
        configMenu.style.display = 'block';
    }
}

function updateCounter() {
    document.getElementById('counter').innerText = daysLibres;
    document.getElementById('asunto-counter').innerText = asuntosPropios;
    document.getElementById('libres-gastados').innerText = libresGastados;
    document.getElementById('vacaciones-counter').innerText = diasVacaciones;

    // Guarda los valores actualizados en IndexedDB
    guardarConfiguracionEnIndexedDB(db, 'daysLibres', daysLibres);
    guardarConfiguracionEnIndexedDB(db, 'asuntosPropios', asuntosPropios);
    guardarConfiguracionEnIndexedDB(db, 'libresGastados', libresGastados);
    guardarConfiguracionEnIndexedDB(db, 'diasVacaciones', diasVacaciones);

    // Actualiza el registro de días libres (si es necesario)
    updateRegistroLibrados();
}

function resetCounters() {
    // Resetear los valores de los contadores a sus valores predeterminados
    daysLibres = 0;
    asuntosPropios = 8; // Ajusta según el valor por defecto
    libresGastados = 0;
    diasVacaciones = 25; // Ajusta según el valor por defecto
    diasPorGuardia = 5;  // Ajusta según el valor por defecto

    // Actualizar los contadores en la interfaz
    updateCounter();

    // Resetear IndexedDB
    resetIndexedDB(db);

    // Resetear el calendario
    resetCalendar();

    mostrarMensaje('Contadores y calendario reseteados');
    console.log('Contadores y base de datos reseteados');
}

function resetCalendar() {
    const allDays = document.querySelectorAll('.day');
    allDays.forEach(day => {
        day.classList.remove('guardia', 'proxima-guardia', 'asunto', 'libre', 'vacaciones');
        day.style = '';

        // Remover etiquetas adicionales como 'tarde', 'mañana', 'otros-eventos'
        const labels = day.querySelectorAll('.tarde-label, .mañana-label, .otros-eventos-label');
        labels.forEach(label => label.remove());
    });

    // Limpiar registro de librados
    registroLibrados.length = 0;
    updateRegistroLibrados();
    saveRegistroLibradosToIndexedDB(db, registroLibrados);
}

function markWeekAsGuardia(dayElement) {
    const selectedDate = new Date(dayElement.dataset.date);
    const semana = obtenerSemana(selectedDate);
    let guardiaDias = [];

    // Recorre todos los días de la semana y marca cada uno como "guardia"
    semana.forEach(dia => {
        const diaDiv = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
        if (diaDiv) {
            diaDiv.classList.add('guardia');
            // Almacenar la interacción en IndexedDB
            guardarDiaEnIndexedDB(db, diaDiv.dataset.date, 'guardia');
            guardiaDias.push(diaDiv.dataset.date); // Añadir el día al array guardiaDias
        }
    });

    const primerDiaGuardia = formatDate(semana[0]);

    // Crear un nuevo registro para la guardia realizada
    guardiasRealizadas.push({
        fecha: primerDiaGuardia,
        diasLibresRestantes: diasPorGuardia,  // Días libres generados por la guardia
        diasLibresUsados: []                 // Inicialmente no se han usado días libres
    });

    guardarConfiguracionEnIndexedDB(db, 'guardiasRealizadas', guardiasRealizadas);


    // Aquí añadimos el log para verificar el estado de guardiasRealizadas
    console.log('Guardias registradas:', guardiasRealizadas);
    
    // Incrementa el contador de días libres
    daysLibres += diasPorGuardia;
    updateCounter();

    // Añadir al registro de librados
    registroLibrados.push({
        tipo: 'guardia',
        fecha: primerDiaGuardia,
        texto: `Guardia del ${primerDiaGuardia}: Generados ${diasPorGuardia} días libres.`
    });

    // Guardar en IndexedDB
    saveRegistroLibradosToIndexedDB(db, registroLibrados);

    // Actualizar el registro visualmente
    updateRegistroLibrados();
}

function markProximaGuardia(dayElement) {
    const selectedDate = new Date(dayElement.dataset.date);
    const semana = obtenerSemana(selectedDate);

    // Marcar toda la semana como 'proxima-guardia'
    semana.forEach(dia => {
        const diaDiv = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
        if (diaDiv) {
            diaDiv.classList.add('proxima-guardia');
            guardarDiaEnIndexedDB(db, diaDiv.dataset.date, 'proxima-guardia');
        }
    });

    // Agregar la guardia al array guardiasRealizadas
    const fechaGuardia = formatDate(semana[0]);
    guardiasRealizadas.push({
        fecha: fechaGuardia,
        diasLibresRestantes: diasPorGuardia,
        diasLibresUsados: [],
        anticipada: false // Marcamos la guardia como no anticipada
    });

    mostrarMensaje("Próxima guardia programada y semana resaltada.");
}

function markAsuntoPropio(dayElement) {
    // Verificar si el día ya está marcado como "Asunto Propio"
    if (dayElement.classList.contains('asunto')) {
        alert("Este día ya está marcado como Asunto Propio.");
        return;
    }

    // Verifica si aún quedan asuntos propios disponibles
    if (asuntosPropios > 0) {
        // Marca el día con la clase "asunto" para aplicar el estilo visual
        dayElement.classList.add('asunto');

        // Resta uno al número de asuntos propios disponibles
        asuntosPropios -= 1;

        // Almacenar el cambio en IndexedDB
        guardarDiaEnIndexedDB(db, dayElement.dataset.date, 'asunto');

        // Actualiza el contador en la interfaz
        updateCounter();
    } else {
        // Si no quedan asuntos propios, muestra un mensaje de alerta
        alert("Has alcanzado el límite de asuntos propios anuales.");
    }
}

function startVacaciones(dayElement) {
    if (!vacationStart) {
        vacationStart = dayElement;
        console.log("Día inicial de vacaciones seleccionado:", vacationStart.dataset.date);
        mostrarDialogo("Selecciona el día final de vacaciones.");
        document.querySelectorAll('.day').forEach(dia => {
            dia.onclick = function () {
                const endDate = new Date(dia.dataset.date);
                const startDate = new Date(vacationStart.dataset.date);
                console.log("Día final de vacaciones seleccionado:", endDate);

                if (endDate >= startDate) {
                    let selectedDays = getDaysInRange(startDate, endDate);
                    console.log("Días seleccionados para vacaciones:", selectedDays);
                    showVacationPopup(selectedDays);

                    // Almacenar el rango de vacaciones
                    vacationRanges.push({ start: startDate, end: endDate, days: selectedDays });

                    resetDayClickHandlers();
                } else {
                    mostrarDialogo("El día final debe ser después o igual al día de inicio.");
                }
            };
        });
    } else {
        vacationStart = null;
    }
}

function showVacationPopup(selectedDays) {
    console.log("Mostrando popup para vacaciones con días:", selectedDays); // Verificación
    const vacationPopup = document.getElementById('vacation-popup');
    console.log(vacationPopup); // Verificación de que el elemento existe
    console.log(getComputedStyle(vacationPopup).display); // Verificación del estado de display

    // Asegurarse de que el popup se muestra correctamente
    vacationPopup.style.display = 'block';
    vacationPopup.style.visibility = 'visible'; // Solo una vez

    const daysToDiscount = selectedDays.filter(date => {
        const dayOfWeek = date.getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6; // Filtrar fines de semana
    });

    const vacationDaysInput = document.getElementById('vacation-days');
    vacationDaysInput.value = daysToDiscount.length; // Asignar la cantidad de días descontados

    console.log("Popup de vacaciones mostrado"); // Verificación

    // Agregar el evento click al botón del popup
    vacationPopup.querySelector('button').onclick = function () {
        const daysToDeduct = parseInt(vacationDaysInput.value, 10);
        if (daysToDeduct > diasVacaciones) {
            mostrarDialogo("No tienes suficientes días de vacaciones.");
        } else {
            selectedDays.forEach(date => {
                const diaDiv = document.querySelector(`.day[data-date="${date.toISOString().split('T')[0]}"]`);
                if (diaDiv) {
                    diaDiv.classList.add('vacaciones');
                    guardarDiaEnIndexedDB(db, diaDiv.dataset.date, 'vacaciones');
                }
            });

            diasVacaciones -= daysToDeduct;
            updateCounter();

            // Ocultar el popup después de la acción
            vacationPopup.style.display = 'none';
            closeAllDropdowns();
            resetDayClickHandlers();
        }
    };
}


function resetDayClickHandlers() {
    document.querySelectorAll('.day').forEach((dia) => {
        dia.onclick = function (event) {
            const dayElement = event.currentTarget;
            showDropdownMenu(event, dayElement);
        };
    });
}

function markTarde(dayElement) {
    let label = dayElement.querySelector('.tarde-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'tarde-label';
        label.innerText = 'T';
        dayElement.style.position = 'relative';
        label.style.position = 'absolute';
        label.style.top = '5px';
        label.style.left = '5px';
        label.style.fontSize = '25px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);

        // Almacenar en IndexedDB
        guardarDiaEnIndexedDB(db, dayElement.dataset.date, 'tarde');
    }
}

function restaurarTarde(dayElement) {
    let label = dayElement.querySelector('.tarde-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'tarde-label';
        label.innerText = 'T';
        dayElement.style.position = 'relative';
        label.style.position = 'absolute';
        label.style.top = '5px';
        label.style.left = '5px';
        label.style.fontSize = '25px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
}

function markMañana(dayElement) {
    let label = dayElement.querySelector('.mañana-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'mañana-label';
        label.innerText = 'M';
        dayElement.style.position = 'relative';
        label.style.position = 'absolute';
        label.style.top = '5px';
        label.style.right = '5px';
        label.style.fontSize = '25px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);

        // Almacenar en IndexedDB
        guardarDiaEnIndexedDB(db, dayElement.dataset.date, 'mañana');
    }
}

function restaurarMañana(dayElement) {
    let label = dayElement.querySelector('.mañana-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'mañana-label';
        label.innerText = 'M';
        dayElement.style.position = 'relative';
        label.style.position = 'absolute';
        label.style.top = '5px';
        label.style.right = '5px';
        label.style.fontSize = '25px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
}

function markOtrosEventos(dayElement) {
    const concepto = prompt("Introduce el concepto del evento:");
    if (!concepto || concepto.trim() === '') {
        mostrarDialogo("No se ha introducido un concepto válido.");
        return;
    }

    const diasAfectados = parseInt(prompt("¿AFECTA DÍAS? Ingresa un número positivo, negativo, o 0."), 10);
    if (isNaN(diasAfectados)) {
        mostrarDialogo("Número de días no válido.");
        return;
    }

    const parteSuperior = concepto.substring(0, 6);
    const parteInferior = concepto.length > 6 ? concepto.substring(6, 12) + '...' : concepto.substring(6);

    dayElement.dataset.conceptoCompleto = concepto;
    dayElement.dataset.diasAfectados = diasAfectados;

    const labelSuperior = document.createElement('div');
    const labelInferior = document.createElement('div');

    labelSuperior.className = 'otros-eventos-label';
    labelInferior.className = 'otros-eventos-label';

    labelSuperior.innerText = parteSuperior;
    labelInferior.innerText = parteInferior;

    labelSuperior.style.position = 'absolute';
    labelSuperior.style.top = '5px';
    labelSuperior.style.width = '100%';
    labelSuperior.style.textAlign = 'center';
    labelSuperior.style.fontSize = '15px';

    labelInferior.style.position = 'absolute';
    labelInferior.style.bottom = '5px';
    labelInferior.style.width = '100%';
    labelInferior.style.textAlign = 'center';
    labelInferior.style.fontSize = '15px';

    dayElement.style.position = 'relative';
    dayElement.appendChild(labelSuperior);
    dayElement.appendChild(labelInferior);

    // Actualizar el contador de días libres
    daysLibres += diasAfectados;
    updateCounter();

    // Almacenar la interacción en IndexedDB
    guardarDiaEnIndexedDB(db, dayElement.dataset.date, 'otros', { concepto: concepto, diasAfectados: diasAfectados });

    // Actualizar el registro de librados
    const signo = diasAfectados >= 0 ? 'Sumados' : 'Restados';
    registroLibrados.push({
        tipo: 'otros',
        fecha: formatDate(new Date(dayElement.dataset.date)),
        texto: `${concepto} (${formatDate(new Date(dayElement.dataset.date))}): ${signo} ${Math.abs(diasAfectados)} días libres.`
    });
    updateRegistroLibrados();
    saveRegistroLibradosToIndexedDB(db, registroLibrados);
}

function restaurarOtrosEventos(dayElement, concepto, diasAfectados) {
    dayElement.dataset.conceptoCompleto = concepto;
    dayElement.dataset.diasAfectados = diasAfectados;

    const parteSuperior = concepto.substring(0, 6);
    const parteInferior = concepto.length > 6 ? concepto.substring(6, 12) + '...' : concepto.substring(6);

    const labelSuperior = document.createElement('div');
    const labelInferior = document.createElement('div');

    labelSuperior.className = 'otros-eventos-label';
    labelInferior.className = 'otros-eventos-label';

    labelSuperior.innerText = parteSuperior;
    labelInferior.innerText = parteInferior;

    labelSuperior.style.position = 'absolute';
    labelSuperior.style.top = '5px';
    labelSuperior.style.width = '100%';
    labelSuperior.style.textAlign = 'center';
    labelSuperior.style.fontSize = '20px';

    labelInferior.style.position = 'absolute';
    labelInferior.style.bottom = '5px';
    labelInferior.style.width = '100%';
    labelInferior.style.textAlign = 'center';
    labelInferior.style.fontSize = '20px';

    dayElement.style.position = 'relative';
    dayElement.appendChild(labelSuperior);
    dayElement.appendChild(labelInferior);
}

function removeEvento(dayElement) {
    const selectedDate = new Date(dayElement.dataset.date);
    let tipoDia = null;

    // Verificar qué tipo de día es
    if (dayElement.classList.contains('guardia')) {
        tipoDia = 'guardia';
    } else if (dayElement.classList.contains('libre')) {
        tipoDia = 'libre';
    } else if (dayElement.classList.contains('asunto')) {
        tipoDia = 'asunto';
    } else if (dayElement.classList.contains('vacaciones')) {
        tipoDia = 'vacaciones';
    } else if (dayElement.classList.contains('proxima-guardia')) {
        tipoDia = 'proxima-guardia';
    } else if (dayElement.querySelector('.tarde-label')) {
        tipoDia = 'tarde';
    } else if (dayElement.querySelector('.mañana-label')) {
        tipoDia = 'mañana';
    } else if (dayElement.querySelector('.otros-eventos-label')) {
        tipoDia = 'otros';
    } else {
        mostrarMensaje("No hay nada que eliminar en este día.");
        return;
    }

    if (tipoDia === 'guardia' || tipoDia === 'proxima-guardia') {
        // Obtener todos los días de la semana
        const semana = obtenerSemana(selectedDate);

        // Remover la clase 'guardia' o 'proxima-guardia' de todos los días de la semana
        semana.forEach(dia => {
            const diaDiv = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
            if (diaDiv) {
                diaDiv.classList.remove('guardia', 'proxima-guardia');
                eliminarDiaDeIndexedDB(db, diaDiv.dataset.date, 'guardia');
                eliminarDiaDeIndexedDB(db, diaDiv.dataset.date, 'proxima-guardia');
            }
        });

        // Actualizar contadores
        daysLibres -= diasPorGuardia;
        updateCounter();

        // Actualizar el array guardiasRealizadas
        const fechaGuardia = formatDate(semana[0]);
        guardiasRealizadas = guardiasRealizadas.filter(guardia => guardia.fecha !== fechaGuardia);

        // Actualizar el registro
        registroLibrados = registroLibrados.filter(entry => entry.fecha !== fechaGuardia);
        updateRegistroLibrados();
        saveRegistroLibradosToIndexedDB(db, registroLibrados);

    } else if (tipoDia === 'vacaciones') {
        // Obtener el rango de vacaciones
        const vacationRange = vacationRanges.find(range => {
            return selectedDate >= range.start && selectedDate <= range.end;
        });

        if (vacationRange) {
            vacationRange.days.forEach(date => {
                const dateStr = date.toISOString().split('T')[0];
                const diaDiv = document.querySelector(`.day[data-date="${dateStr}"]`);
                if (diaDiv) {
                    diaDiv.classList.remove('vacaciones');
                    eliminarDiaDeIndexedDB(db, dateStr, 'vacaciones');
                }
            });

            // Actualizar contador de vacaciones
            diasVacaciones += vacationRange.days.length;
            updateCounter();

            // Remover el rango de vacationRanges
            vacationRanges = vacationRanges.filter(range => range !== vacationRange);

        } else {
            mostrarMensaje("No se encontró el periodo de vacaciones para eliminar.");
        }

    } else if (tipoDia === 'libre') {
        dayElement.classList.remove('libre');
        eliminarDiaDeIndexedDB(db, dayElement.dataset.date, 'libre');

        // Actualizar contadores
        daysLibres += 1;
        libresGastados -= 1;
        updateCounter();

        // Actualizar el registro
        const fechaEliminada = formatDateShort(selectedDate);
        registroLibrados = registroLibrados.filter(entry => !entry.texto.includes(fechaEliminada));
        updateRegistroLibrados();
        saveRegistroLibradosToIndexedDB(db, registroLibrados);

    } else if (tipoDia === 'asunto') {
        dayElement.classList.remove('asunto');
        eliminarDiaDeIndexedDB(db, dayElement.dataset.date, 'asunto');

        // Actualizar contador de asuntos propios
        asuntosPropios += 1;
        updateCounter();

    } else if (tipoDia === 'tarde') {
        const label = dayElement.querySelector('.tarde-label');
        if (label) {
            label.remove();
            eliminarDiaDeIndexedDB(db, dayElement.dataset.date, 'tarde');
        }

    } else if (tipoDia === 'mañana') {
        const label = dayElement.querySelector('.mañana-label');
        if (label) {
            label.remove();
            eliminarDiaDeIndexedDB(db, dayElement.dataset.date, 'mañana');
        }

    } else if (tipoDia === 'otros') {
        // Remover las etiquetas de 'otros-eventos'
        const labels = dayElement.querySelectorAll('.otros-eventos-label');
        labels.forEach(label => label.remove());
        eliminarDiaDeIndexedDB(db, dayElement.dataset.date, 'otros');

        // Actualizar el contador de días libres
        const diasAfectados = parseInt(dayElement.dataset.diasAfectados, 10);
        daysLibres -= diasAfectados;
        updateCounter();

        // Actualizar el registro
        const concepto = dayElement.dataset.conceptoCompleto;
        registroLibrados = registroLibrados.filter(entry => !entry.texto.includes(`${concepto} (${formatDate(selectedDate)})`));
        updateRegistroLibrados();
        saveRegistroLibradosToIndexedDB(db, registroLibrados);

        // Remover dataset
        delete dayElement.dataset.diasAfectados;
        delete dayElement.dataset.conceptoCompleto;
    }

    mostrarMensaje("Evento eliminado correctamente.");
}

function updateRegistroLibrados() {
    const registroDiv = document.getElementById('registro-librados');
    if (registroDiv) {
        if (registroLibrados.length > 0) {
            let registroHTML = '<h3>Registro de Días Libres:</h3><ul>';
            registroLibrados.forEach(entry => {
                registroHTML += `<li>${entry.texto}</li>`;
            });
            registroHTML += '</ul>';
            registroDiv.innerHTML = registroHTML;
        } else {
            registroDiv.innerHTML = '<h3>Registro de Días Libres:</h3><p>No hay días libres registrados.</p>';
        }
    } else {
        console.log('No se encontró el elemento para mostrar el registro de días libres.');
    }
}

function mostrarRegistro() {
    const registroTexto = registroLibrados.length > 0 ? registroLibrados.map(entry => entry.texto).join('<br>') : 'No hay días libres registrados.';

    const nuevaVentana = window.open('', '', 'width=400,height=600');
    nuevaVentana.document.write('<html><head><title>Registro de Días</title></head><body>');
    nuevaVentana.document.write(`<h3>Registro de Días</h3><p>${registroTexto}</p>`);
    nuevaVentana.document.write('</body></html>');
    nuevaVentana.document.close();
}

function checkGuardiaProxima() {
    const today = new Date().toISOString().split('T')[0];
    const diaDiv = document.querySelector(`.day[data-date="${today}"]`);

    if (diaDiv && diaDiv.classList.contains('proxima-guardia')) {
        const fechaGuardia = formatDate(new Date(today));
        const guardia = guardiasRealizadas.find(g => g.fecha === fechaGuardia);

        if (guardia && guardia.anticipada) {
            // La guardia ya fue anticipada, solo marcar la semana
            markWeekAsGuardia(diaDiv);
            mostrarMensaje("¡Hoy comienza tu guardia anticipada!");
        } else {
            // Sumar días libres
            daysLibres += diasPorGuardia;
            updateCounter();

            // Marcar la semana como 'guardia'
            markWeekAsGuardia(diaDiv);

            // Actualizar registro
            registroLibrados.push({
                tipo: 'guardia',
                fecha: fechaGuardia,
                texto: `Guardia del ${fechaGuardia}: Generados ${diasPorGuardia} días libres.`
            });
            updateRegistroLibrados();
            saveRegistroLibradosToIndexedDB(db, registroLibrados);

            mostrarMensaje("¡Hoy comienza tu guardia!");
        }

        // Remover la clase 'proxima-guardia' de toda la semana
        const semana = obtenerSemana(new Date(today));
        semana.forEach(dia => {
            const diaDivSemana = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
            if (diaDivSemana) {
                diaDivSemana.classList.remove('proxima-guardia');
                eliminarDiaDeIndexedDB(db, diaDivSemana.dataset.date, 'proxima-guardia');
            }
        });
    }
}

function saveConfig() {
    diasPorGuardia = parseInt(document.getElementById('dias-guardia').value);
    asuntosAnuales = parseInt(document.getElementById('asuntos-anuales').value);
    asuntosPropios = asuntosAnuales; // Reinicia los asuntos propios basados en la nueva configuración
    diasVacaciones = parseInt(document.getElementById('dias-vacaciones').value);
    const diasExtra = parseInt(document.getElementById('dias-extra').value);

    // Guardar las configuraciones en IndexedDB
    guardarConfiguracionEnIndexedDB(db, 'diasPorGuardia', diasPorGuardia);
    guardarConfiguracionEnIndexedDB(db, 'asuntosAnuales', asuntosAnuales);
    guardarConfiguracionEnIndexedDB(db, 'diasVacaciones', diasVacaciones);
    guardarConfiguracionEnIndexedDB(db, 'diasExtra', diasExtra);

    // Actualizar los días libres con los días extra
    daysLibres += diasExtra;
    updateCounter();
}

function solicitarDiasGuardia(dayElement) {
    closeAllDropdowns(); // Asegura que el overlay esté oculto
    diasSeleccionados = [];
    mostrarDialogo("Selecciona los días. Haz clic en cada día. Cuando termines, presiona Confirmar.");

    // Aquí deshabilitamos temporalmente el evento que muestra el menú emergente
    document.querySelectorAll('.day').forEach(dia => {
        dia.onclick = null; // Deshabilitar el menú emergente para cada día
    });
    
    seleccionDiaHandler = function () {
        if (diasSeleccionados.includes(this)) {
            diasSeleccionados = diasSeleccionados.filter(d => d !== this);
            this.classList.remove('selected');
        } else {
            diasSeleccionados.push(this);
            this.classList.add('selected');
        }
    };

    // Deshabilitar el menú de día durante la selección de días
    document.querySelectorAll('.day').forEach(dia => {
        dia.removeEventListener('click', showDropdownMenu);
        dia.addEventListener('click', seleccionDiaHandler);
    });

    mostrarBotonConfirmacion();
}

function mostrarBotonConfirmacion() {
    const confirmButton = document.createElement('button');
    confirmButton.innerText = "Confirmar Selección";
    confirmButton.style.position = "fixed";
    confirmButton.style.bottom = "40px";
    confirmButton.style.right = "40px";
    confirmButton.style.zIndex = "1000";
    confirmButton.style.padding = "20px 40px";
    confirmButton.style.backgroundColor = "#4CAF50";
    confirmButton.style.color = "white";
    confirmButton.style.border = "none";
    confirmButton.style.borderRadius = "8px";
    confirmButton.style.fontSize = "30px";
    confirmButton.style.cursor = "pointer";

    document.body.appendChild(confirmButton);

    confirmButton.onclick = function () {
        confirmarDiasSeleccionados();
        confirmButton.remove();
    };
}

function confirmarDiasSeleccionados() {
    if (diasSeleccionados.length === 0) {
        mostrarDialogo("No has seleccionado ningún día.");
        return;
    }

    // Verificar si hay suficientes días libres acumulados
    if (diasSeleccionados.length > daysLibres) {
        mostrarDialogo("No tienes suficientes días libres acumulados.");
        return;
    }

    // Resta los días seleccionados del contador de días libres acumulados
    daysLibres -= diasSeleccionados.length;
    libresGastados += diasSeleccionados.length;

    // Actualiza el contador en la interfaz
    updateCounter();

    // Marca los días seleccionados como "libres" en el calendario y almacena en IndexedDB
    diasSeleccionados.forEach(dia => {
        dia.classList.add('libre');
        guardarDiaEnIndexedDB(db, dia.dataset.date, 'libre');  // Asegura que el día se guarda en IndexedDB como "libre"
    });

    // Obtenemos las fechas seleccionadas utilizando formatDateShort
    const fechasSeleccionadas = diasSeleccionados.map(dia => formatDateShort(new Date(dia.dataset.date)));
    let diasPorAsignar = diasSeleccionados.length;
    let registroGuardiasDetalle = [];
    let mensajeWhatsAppDetalle = [];

    // Distribuir los días libres entre las guardias disponibles
    for (let guardia of guardiasRealizadas) {
        let diaGuardiaNumero = guardia.diasLibresUsados.length + 1;

        while (diasPorAsignar > 0 && guardia.diasLibresRestantes > 0) {
            guardia.diasLibresRestantes--;
            diasPorAsignar--;

            const diaAsignado = fechasSeleccionadas.shift();
            guardia.diasLibresUsados.push(diaAsignado);

            const fechaGuardia = formatDateShort(new Date(guardia.fecha));

            const registroTexto = `D.${diaGuardiaNumero} G.${fechaGuardia}: ${diaAsignado}`;
            registroGuardiasDetalle.push({ texto: registroTexto });

            mensajeWhatsAppDetalle.push(registroTexto);

            diaGuardiaNumero++;
        }
        if (diasPorAsignar === 0) {
            break;
        }
    }

    if (diasPorAsignar > 0) {
        alert("No hay suficientes guardias registradas para cubrir los días seleccionados.");
        return;
    }

    // Actualizar el registro con los días seleccionados y las guardias usadas
    registroLibrados.push(...registroGuardiasDetalle);

    // Guardar en IndexedDB
    saveRegistroLibradosToIndexedDB(db, registroLibrados);

    // Actualizamos el registro en el div correspondiente
    updateRegistroLibrados();

    // Construimos el mensaje de WhatsApp optimizado
    let mensajeWhatsApp = `Hola Paco,\nSolicito librar los siguientes días:\n${mensajeWhatsAppDetalle.join('\n')}\nGracias.`;

    // Mostrar el popup para confirmar el envío
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <p><strong>Mensaje para enviar:</strong></p>
            <textarea rows="6" cols="40" readonly>${mensajeWhatsApp}</textarea>
            <br>
            <button id="aceptarButton">Enviar</button>
            <button id="cancelarButton">Cancelar</button>
        </div>
    `;

    // Estilos del popup
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.backgroundColor = '#fff';
    popup.style.padding = '15px';
    popup.style.border = '1px solid #ddd';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0px 4px 10px rgba(0, 0, 0, 0.1)';
    popup.style.zIndex = '1000';
    popup.style.maxWidth = '300px';
    popup.style.maxHeight = '400px';
    popup.style.overflowY = 'auto';

    document.body.appendChild(popup);

    // Manejar el envío del mensaje de WhatsApp
    document.getElementById('aceptarButton').onclick = function () {
        enviarWhatsApp(mensajeWhatsApp);
        closePopup();
    };

    document.getElementById('cancelarButton').onclick = function () {
        closePopup();
    };

   // Restaurar la funcionalidad de los clics en los días para mostrar el menú emergente
    resetDayClickHandlers();
}


function closePopup() {
    const popup = document.querySelector('.popup');
    if (popup) {
        popup.remove();
    }
}

function enviarWhatsApp(mensaje) {
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

function enviarWhatsAppAlJefe() {
    const mensaje = encodeURIComponent(`Hola, estos son los días de guardia y libres asignados:\n\n${registroLibrados.map(entry => entry.texto).join('\n')}`);
    const url = `https://wa.me/?text=${mensaje}`;
    window.open(url, '_blank');
}

export function almacenarInteraccionDia(dia, tipo, detalle = null) {
    guardarDiaEnIndexedDB(db, dia, tipo, detalle);
}


window.toggleCounterMenu = toggleCounterMenu;
window.toggleConfigMenu = toggleConfigMenu;
window.saveConfig = saveConfig;
window.resetCounters = resetCounters;
window.mostrarRegistro = mostrarRegistro;
window.enviarWhatsAppAlJefe = enviarWhatsAppAlJefe;

// Registro del Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(function (registration) {
            console.log('Service Worker registrado con éxito:', registration);
        })
        .catch(function (error) {
            console.log('Error al registrar el Service Worker:', error);
        });
}

// Manejo de clics para cerrar menús desplegables
document.addEventListener('click', function (event) {
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
});
