if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
    .then(function(registration) {
        console.log('Service Worker registrado con éxito:', registration);
    })
    .catch(function(error) {
        console.log('Error al registrar el Service Worker:', error);
    });
}

function guardarContadorEnIndexedDB(clave, valor) {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('configuracion', 'readwrite');
        const store = transaction.objectStore('configuracion');
        store.put({ clave: clave, valor: valor });
    };
}

function guardarDiaEnIndexedDB(dia, tipo, detalle = null) {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('dias', 'readwrite');
        const store = transaction.objectStore('dias');

        // Eliminar cualquier registro existente para esa fecha
        const index = store.index('fecha');
        index.openCursor(IDBKeyRange.only(dia)).onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            } else {
                // Guardar el nuevo registro
                store.add({
                    fecha: dia,
                    tipo: tipo,
                    detalle: detalle
                });
            }
        };
    };
}

function saveRegistroLibradosToIndexedDB() {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('registro', 'readwrite');
        const store = transaction.objectStore('registro');

        // Limpiar el almacén antes de guardar
        store.clear().onsuccess = function() {
            // Agregar todas las entradas de registroLibrados
            registroLibrados.forEach(entry => {
                store.add(entry);
            });
        };
    };
}

function loadRegistroLibradosFromIndexedDB() {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('registro', 'readonly');
        const store = transaction.objectStore('registro');

        store.getAll().onsuccess = function(event) {
            registroLibrados.length = 0; // Limpiar el array actual
            registroLibrados.push(...event.target.result); // Agregar las entradas desde IndexedDB
            updateRegistroLibrados(); // Actualizar la visualización del registro
        };
    };
}

function guardarConfiguracionEnIndexedDB(clave, valor) {
    const request = indexedDB.open('calendarioDB', 2); // Asegúrate de usar la versión correcta

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('configuracion', 'readwrite');
        const store = transaction.objectStore('configuracion');
        store.put({ clave: clave, valor: valor });
    };
}

// Función para resetear contadores y también IndexedDB
function resetCounters() {
    // Resetear los valores de los contadores a sus valores predeterminados
    daysLibres = 0;
    asuntosPropios = 08; // Ajusta según el valor por defecto
    libresGastados = 0;
    diasVacaciones = 25; // Ajusta según el valor por defecto
    diasPorGuardia = 5;  // Ajusta según el valor por defecto

    // Actualizar los contadores en la interfaz
    updateCounter();

    // Resetear IndexedDB
    resetIndexedDB();

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
    saveRegistroLibradosToIndexedDB();
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

// Función para resetear IndexedDB
function resetIndexedDB() {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['dias', 'configuracion', 'registro'], 'readwrite');
        const diasStore = transaction.objectStore('dias');
        const configStore = transaction.objectStore('configuracion');
        const registroStore = transaction.objectStore('registro');

        // Eliminar todas las entradas en 'dias'
        diasStore.clear().onsuccess = function() {
            console.log('Días eliminados de IndexedDB');
        };

        // Eliminar todas las entradas en 'configuracion'
        configStore.clear().onsuccess = function() {
            console.log('Configuración eliminada de IndexedDB');
        };

        // Eliminar todas las entradas en 'registro'
        registroStore.clear().onsuccess = function() {
            console.log('Registro eliminado de IndexedDB');
        };

        // Restablecer los contadores en IndexedDB
        guardarConfiguracionEnIndexedDB('daysLibres', daysLibres);
        guardarConfiguracionEnIndexedDB('asuntosPropios', asuntosPropios);
        guardarConfiguracionEnIndexedDB('libresGastados', libresGastados);
        guardarConfiguracionEnIndexedDB('diasVacaciones', diasVacaciones);

        console.log('IndexedDB reseteada con éxito');
    };

    request.onerror = function(event) {
        console.log('Error al resetear IndexedDB:', event);
    };
}

// Función para actualizar los contadores visualmente
function updateCounter() {
    document.getElementById('counter').innerText = daysLibres;
    document.getElementById('asunto-counter').innerText = asuntosPropios;
    document.getElementById('libres-gastados').innerText = libresGastados;
    document.getElementById('vacaciones-counter').innerText = diasVacaciones;

    // Guarda los valores actualizados en IndexedDB
    guardarConfiguracionEnIndexedDB('daysLibres', daysLibres);
    guardarConfiguracionEnIndexedDB('asuntosPropios', asuntosPropios);
    guardarConfiguracionEnIndexedDB('libresGastados', libresGastados);
    guardarConfiguracionEnIndexedDB('diasVacaciones', diasVacaciones);

    // Actualiza el registro de días libres (si es necesario)
    updateRegistroLibrados();
}

function mostrarDialogo(mensaje, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-dialogo';

    const dialogo = document.createElement('div');
    dialogo.className = 'dialogo-mensaje';
    dialogo.innerHTML = `<p>${mensaje}</p>`;

    const botonAceptar = document.createElement('button');
    botonAceptar.innerText = 'Aceptar';
    botonAceptar.onclick = () => {
        document.body.removeChild(overlay);
        if (callback) callback();
    };

    dialogo.appendChild(botonAceptar);
    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    // Estilos para el diálogo y el overlay
}

function almacenarInteraccionDia(dia, tipo, detalle = null) {
    guardarDiaEnIndexedDB(dia, tipo, detalle);
}

function obtenerConfiguracionDeIndexedDB() {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('configuracion', 'readonly');
        const store = transaction.objectStore('configuracion');

        store.getAll().onsuccess = function(event) {
            const configuraciones = event.target.result;
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
                        // Solo establecer asuntosPropios si no se ha actualizado aún
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
                }
            });
            updateCounter(); // Actualizar contadores después de cargar todos los valores
        };
    };
}

function obtenerDiasDeIndexedDB() {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('dias', 'readonly');
        const store = transaction.objectStore('dias');

        store.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const diaData = cursor.value;
                const diaDiv = document.querySelector(`.day[data-date="${diaData.fecha}"]`);
                if (diaDiv) {
                    diaDiv.classList.add(diaData.tipo);

                    switch (diaData.tipo) {
                        case 'asunto':
                            // Marca el día como 'asunto' en el calendario
                            diaDiv.classList.add('asunto');
                            break;
                        case 'proxima-guardia':
                            diaDiv.classList.add('proxima-guardia');
                            break;
                        case 'libre':
                            diaDiv.classList.add('libre');
                            break;
                        case 'vacaciones':
                            diaDiv.classList.add('vacaciones');
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
                            diaDiv.classList.add('guardia');
                            // Aquí puedes reconstruir el array guardiasRealizadas si es necesario
                            break;
                        case 'mañana':
                            restaurarMañana(diaDiv);
                            break;
                        // Agrega más casos si es necesario
                    }
                }
                cursor.continue();
            } else {
                // Todos los días han sido procesados; actualiza los contadores visualmente
                updateCounter();
            }
        };
    };
}

let daysLibres = 0;
let asuntosPropios = 08; // Inicializado a 08
let libresGastados = 0;
let diasVacaciones = 25;
let diasPorGuardia = 5;
let asuntosAnuales = 08;
let asuntosPropiosLoaded = false;
const registroLibrados = []; // Array de objetos para el registro de días libres
let vacationStart = null;
let vacationRanges = []; // Array para almacenar los rangos de vacaciones

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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
}

function restaurarOtrosEventos(dayElement, concepto, diasAfectados) {
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
    labelSuperior.style.fontSize = '10px';

    labelInferior.style.position = 'absolute';
    labelInferior.style.bottom = '5px';
    labelInferior.style.width = '100%';
    labelInferior.style.textAlign = 'center';
    labelInferior.style.fontSize = '10px';

    dayElement.style.position = 'relative';
    dayElement.appendChild(labelSuperior);
    dayElement.appendChild(labelInferior);
}

function generateYearCalendar(year) {
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
            dayDiv.onclick = (event) => showDropdownMenu(event, dayDiv, monthIndex, i);
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

// Inicialización de IndexedDB
const request = indexedDB.open('calendarioDB', 1);

request.onupgradeneeded = function(event) {
    const db = event.target.result;

    // Almacén para 'dias'
    if (!db.objectStoreNames.contains('dias')) {
        const store = db.createObjectStore('dias', { keyPath: 'id', autoIncrement: true });
        store.createIndex('fecha', 'fecha', { unique: false });
        store.createIndex('tipo', 'tipo', { unique: false });
    }

    // Almacén para 'configuracion'
    if (!db.objectStoreNames.contains('configuracion')) {
        db.createObjectStore('configuracion', { keyPath: 'clave' });
    }

    // **Nuevo almacén para 'registro'**
    if (!db.objectStoreNames.contains('registro')) {
        db.createObjectStore('registro', { keyPath: 'id', autoIncrement: true });
    }
};

function showDropdownMenu(event, dayElement, monthIndex, dayNumber) {
    closeAllDropdowns();

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';

    // Crear los botones del menú
    const guardiaButton = document.createElement('button');
    guardiaButton.innerText = 'Guardia';
    guardiaButton.onclick = () => {
        markWeekAs





// Función para marcar una semana como guardia
function markWeekAsGuardia(dayElement, monthIndex) {
    const selectedDate = new Date(dayElement.dataset.date);
    const semana = obtenerSemana(selectedDate);
    let guardiaDias = [];

    semana.forEach(dia => {
        const diaDiv = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
        if (diaDiv) {
            diaDiv.classList.add('guardia');
            almacenarInteraccionDia(diaDiv.dataset.date, 'guardia');
            guardiaDias.push(diaDiv.dataset.date);
        }
    });

    const primerDiaGuardia = formatDate(semana[0]);

    guardiasRealizadas.push({
        fecha: primerDiaGuardia,
        diasLibresRestantes: diasPorGuardia,
        diasLibresUsados: []
    });

    daysLibres += diasPorGuardia;
    updateCounter();

    registroLibrados.push({
        tipo: 'guardia',
        fecha: primerDiaGuardia,
        texto: `Guardia del ${primerDiaGuardia}: Generados ${diasPorGuardia} días libres.`
    });

    saveRegistroLibradosToIndexedDB();
    updateRegistroLibrados();
}

// Función para marcar la próxima guardia
function markProximaGuardia(dayElement, monthIndex) {
    const selectedDate = new Date(dayElement.dataset.date);
    const semana = obtenerSemana(selectedDate);

    semana.forEach(dia => {
        const diaDiv = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
        if (diaDiv) {
            diaDiv.classList.add('proxima-guardia');
            almacenarInteraccionDia(diaDiv.dataset.date, 'proxima-guardia');
        }
    });

    const fechaGuardia = formatDate(semana[0]);
    guardiasRealizadas.push({
        fecha: fechaGuardia,
        diasLibresRestantes: diasPorGuardia,
        diasLibresUsados: [],
        anticipada: false
    });

    mostrarMensaje("Próxima guardia programada y semana resaltada.");
}

// Función para iniciar la selección de vacaciones
function startVacaciones(dayElement) {
    if (!vacationStart) {
        vacationStart = dayElement;
        mostrarDialogo("Selecciona el día final de vacaciones.");
        document.querySelectorAll('.day').forEach(dia => {
            dia.onclick = function() {
                const endDate = new Date(dia.dataset.date);
                const startDate = new Date(vacationStart.dataset.date);

                if (endDate >= startDate) {
                    let selectedDays = getDaysInRange(startDate, endDate);
                    showVacationPopup(selectedDays);

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

// Función para mostrar el menú desplegable
function showDropdownMenu(event, dayElement, monthIndex, dayNumber) {
    closeAllDropdowns();

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';

    const guardiaButton = document.createElement('button');
    guardiaButton.innerText = 'Guardia';
    guardiaButton.onclick = () => {
        markWeekAsGuardia(dayElement, monthIndex);
        closeAllDropdowns();
    };
    dropdown.appendChild(guardiaButton);

    const proximaGuardiaButton = document.createElement('button');
    proximaGuardiaButton.innerText = 'Próx. Guardia';
    proximaGuardiaButton.onclick = () => {
        markProximaGuardia(dayElement, monthIndex);
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
        removeGuardia(dayElement, monthIndex);
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

    document.getElementById('overlay').style.display = 'block';
    document.getElementById('overlay').onclick = closeAllDropdowns;
}

// Función para cerrar todos los menús desplegables
function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    dropdowns.forEach(dropdown => dropdown.remove());
    document.getElementById('overlay').style.display = 'none';
}

// Función para obtener la semana de una fecha
function obtenerSemana(dia) {
    const startOfWeek = new Date(dia);
    const dayOfWeek = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const days = [];
    for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
    }
    return days;
}

// Función para formatear la fecha
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Función para mostrar el mensaje
function mostrarMensaje(mensaje) {
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = 'mensaje-notificacion';
    mensajeDiv.innerText = mensaje;

    mensajeDiv.style.position = 'fixed';
    mensajeDiv.style.bottom = '20px';
    mensajeDiv.style.left = '50%';
    mensajeDiv.style.transform = 'translateX(-50%)';
    mensajeDiv.style.backgroundColor = '#333';
    mensajeDiv.style.color = '#fff';
    mensajeDiv.style.padding = '10px 20px';
    mensajeDiv.style.borderRadius = '5px';
    mensajeDiv.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.3)';
    mensajeDiv.style.zIndex = '1000';
    mensajeDiv.style.fontSize = '16px';

    document.body.appendChild(mensajeDiv);

    setTimeout(() => {
        mensajeDiv.remove();
    }, 3000);
}

// Función para obtener los días en un rango
function getDaysInRange(startDate, endDate) {
    let days = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
}

// Función para mostrar el popup de vacaciones
function showVacationPopup(selectedDays) {
    const popup = document.getElementById('vacation-popup');
    const daysToDiscount = selectedDays.filter(date => {
        const dayOfWeek = date.getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6;
    });

    const vacationDaysInput = document.getElementById('vacation-days');
    vacationDaysInput.value = daysToDiscount.length;

    popup.style.display = 'block';
    popup.querySelector('button').onclick = function () {
        const daysToDeduct = parseInt(vacationDaysInput.value, 10);
        if (daysToDeduct > diasVacaciones) {
            mostrarDialogo("No tienes suficientes días de vacaciones.");
        } else {
            selectedDays.forEach(date => {
                const diaDiv = document.querySelector(`.day[data-date="${date.toISOString().split('T')[0]}"]`);
                if (diaDiv) {
                    diaDiv.classList.add('vacaciones');
                    almacenarInteraccionDia(diaDiv.dataset.date, 'vacaciones');
                }
            });

            diasVacaciones -= daysToDeduct;
            updateCounter();

            popup.style.display = 'none';
            closeAllDropdowns();
            resetDayClickHandlers();
        }
    };
}

// Función para resetear los handlers de clic en los días
function resetDayClickHandlers() {
    document.querySelectorAll('.day').forEach((dia) => {
        dia.onclick = function (event) {
            const dayElement = event.currentTarget;
            const monthIndex = parseInt(dayElement.dataset.date.split('-')[1], 10) - 1;
            const dayNumber = parseInt(dayElement.innerText, 10);
            showDropdownMenu(event, dayElement, monthIndex, dayNumber);
        };
    });
}

// Función para marcar el día como mañana
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
label.style.fontSize = '16px';
label.style.fontWeight = 'bold';
label.style.color = '#333';
dayElement.appendChild(label);

// Función para marcar un día como "mañana"
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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
    almacenarInteraccionDia(dayElement.dataset.date, 'mañana');
}

// Función para marcar un día como "tarde"
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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
    almacenarInteraccionDia(dayElement.dataset.date, 'tarde');
}

// Función para marcar otros eventos
function markOtrosEventos(dayElement) {
    const concepto = prompt("Introduce el concepto del evento:");
    const diasAfectados = prompt("Introduce los días afectados:");
    if (concepto && diasAfectados) {
        dayElement.dataset.conceptoCompleto = concepto;
        dayElement.dataset.diasAfectados = diasAfectados;

        const labelSuperior = document.createElement('div');
        const labelInferior = document.createElement('div');

        labelSuperior.className = 'otros-eventos-label';
        labelInferior.className = 'otros-eventos-label';

        labelSuperior.innerText = concepto.substring(0, 6);
        labelInferior.innerText = concepto.length > 6 ? concepto.substring(6, 12) + '...' : concepto.substring(6);

        labelSuperior.style.position = 'absolute';
        labelSuperior.style.top = '5px';
        labelSuperior.style.width = '100%';
        labelSuperior.style.textAlign = 'center';
        labelSuperior.style.fontSize = '10px';

        labelInferior.style.position = 'absolute';
        labelInferior.style.bottom = '5px';
        labelInferior.style.width = '100%';
        labelInferior.style.textAlign = 'center';
        labelInferior.style.fontSize = '10px';

        dayElement.style.position = 'relative';
        dayElement.appendChild(labelSuperior);
        dayElement.appendChild(labelInferior);

        almacenarInteraccionDia(dayElement.dataset.date, 'otros', { concepto, diasAfectados });
    }
}

// Función para remover una guardia
function removeGuardia(dayElement, monthIndex) {
    dayElement.classList.remove('guardia', 'proxima-guardia', 'asunto', 'libre', 'vacaciones', 'mañana', 'tarde');
    const labels = dayElement.querySelectorAll('.tarde-label, .mañana-label, .otros-eventos-label');
    labels.forEach(label => label.remove());
    almacenarInteraccionDia(dayElement.dataset.date, 'libre');
}

// Función para gestionar la interacción con los días
function almacenarInteraccionDia(fecha, tipo, detalles = {}) {
    const interaccion = {
        fecha,
        tipo,
        detalles
    };
    // Guardar la interacción en localStorage o enviarla a un servidor
    console.log('Interacción almacenada:', interaccion); // Para depuración
}

// Event Listener para los días del calendario
document.querySelectorAll('.day').forEach(dayElement => {
    dayElement.addEventListener('click', () => {
        const tipoGuardia = prompt('Introduce el tipo de guardia (mañana, tarde, otros, remover):');
        if (tipoGuardia === 'mañana') {
            markMañana(dayElement);
        } else if (tipoGuardia === 'tarde') {
            markTarde(dayElement);
        } else if (tipoGuardia === 'otros') {
            markOtrosEventos(dayElement);
        } else if (tipoGuardia === 'remover') {
            removeGuardia(dayElement);
        }
    });
});

// Inicializar el calendario con días marcados previamente
function inicializarCalendario() {
    const interaccionesGuardadas = JSON.parse(localStorage.getItem('interacciones')) || [];
    interaccionesGuardadas.forEach(interaccion => {
        const dayElement = document.querySelector(`[data-date="${interaccion.fecha}"]`);
        if (dayElement) {
            if (interaccion.tipo === 'mañana') {
                markMañana(dayElement);
            } else if (interaccion.tipo === 'tarde') {
                markTarde(dayElement);
            } else if (interaccion.tipo === 'otros') {
                markOtrosEventos(dayElement);
            } else if (interaccion.tipo === 'remover') {
                removeGuardia(dayElement);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', inicializarCalendario);







// Función para marcar un día como "mañana"
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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
    almacenarInteraccionDia(dayElement.dataset.date, 'mañana');
}

// Función para marcar un día como "tarde"
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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
    almacenarInteraccionDia(dayElement.dataset.date, 'tarde');
}

// Función para marcar otros eventos
function markOtrosEventos(dayElement) {
    const concepto = prompt("Introduce el concepto del evento:");
    const diasAfectados = prompt("Introduce los días afectados:");
    if (concepto && diasAfectados) {
        dayElement.dataset.conceptoCompleto = concepto;
        dayElement.dataset.diasAfectados = diasAfectados;

        const labelSuperior = document.createElement('div');
        const labelInferior = document.createElement('div');

        labelSuperior.className = 'otros-eventos-label';
        labelInferior.className = 'otros-eventos-label';

        labelSuperior.innerText = concepto.substring(0, 6);
        labelInferior.innerText = concepto.length > 6 ? concepto.substring(6, 12) + '...' : concepto.substring(6);

        labelSuperior.style.position = 'absolute';
        labelSuperior.style.top = '5px';
        labelSuperior.style.width = '100%';
        labelSuperior.style.textAlign = 'center';
        labelSuperior.style.fontSize = '10px';

        labelInferior.style.position = 'absolute';
        labelInferior.style.bottom = '5px';
        labelInferior.style.width = '100%';
        labelInferior.style.textAlign = 'center';
        labelInferior.style.fontSize = '10px';

        dayElement.style.position = 'relative';
        dayElement.appendChild(labelSuperior);
        dayElement.appendChild(labelInferior);

        almacenarInteraccionDia(dayElement.dataset.date, 'otros', { concepto, diasAfectados });
    }
}

// Función para remover una guardia
function removeGuardia(dayElement, monthIndex) {
    dayElement.classList.remove('guardia', 'proxima-guardia', 'asunto', 'libre', 'vacaciones', 'mañana', 'tarde');
    const labels = dayElement.querySelectorAll('.tarde-label, .mañana-label, .otros-eventos-label');
    labels.forEach(label => label.remove());
    almacenarInteraccionDia(dayElement.dataset.date, 'libre');
}

// Función para gestionar la interacción con los días
function almacenarInteraccionDia(fecha, tipo, detalles = {}) {
    const interaccion = {
        fecha,
        tipo,
        detalles
    };
    // Guardar la interacción en localStorage o enviarla a un servidor
    console.log('Interacción almacenada:', interaccion); // Para depuración
}

// Event Listener para los días del calendario
document.querySelectorAll('.day').forEach(dayElement => {
    dayElement.addEventListener('click', () => {
        const tipoGuardia = prompt('Introduce el tipo de guardia (mañana, tarde, otros, remover):');
        if (tipoGuardia === 'mañana') {
            markMañana(dayElement);
        } else if (tipoGuardia === 'tarde') {
            markTarde(dayElement);
        } else if (tipoGuardia === 'otros') {
            markOtrosEventos(dayElement);
        } else if (tipoGuardia === 'remover') {
            removeGuardia(dayElement);
        }
    });
});

// Inicializar el calendario con días marcados previamente
function inicializarCalendario() {
    const interaccionesGuardadas = JSON.parse(localStorage.getItem('interacciones')) || [];
    interaccionesGuardadas.forEach(interaccion => {
        const dayElement = document.querySelector(`[data-date="${interaccion.fecha}"]`);
        if (dayElement) {
            if (interaccion.tipo === 'mañana') {
                markMañana(dayElement);
            } else if (interaccion.tipo === 'tarde') {
                markTarde(dayElement);
            } else if (interaccion.tipo === 'otros') {
                markOtrosEventos(dayElement);
            } else if (interaccion.tipo === 'remover') {
                removeGuardia(dayElement);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', inicializarCalendario);



// Función para marcar un día como "mañana"
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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
    almacenarInteraccionDia(dayElement.dataset.date, 'mañana');
}

// Función para marcar un día como "tarde"
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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
    almacenarInteraccionDia(dayElement.dataset.date, 'tarde');
}

// Función para marcar otros eventos
function markOtrosEventos(dayElement) {
    const concepto = prompt("Introduce el concepto del evento:");
    const diasAfectados = prompt("Introduce los días afectados:");
    if (concepto && diasAfectados) {
        dayElement.dataset.conceptoCompleto = concepto;
        dayElement.dataset.diasAfectados = diasAfectados;

        const labelSuperior = document.createElement('div');
        const labelInferior = document.createElement('div');

        labelSuperior.className = 'otros-eventos-label';
        labelInferior.className = 'otros-eventos-label';

        labelSuperior.innerText = concepto.substring(0, 6);
        labelInferior.innerText = concepto.length > 6 ? concepto.substring(6, 12) + '...' : concepto.substring(6);

        labelSuperior.style.position = 'absolute';
        labelSuperior.style.top = '5px';
        labelSuperior.style.width = '100%';
        labelSuperior.style.textAlign = 'center';
        labelSuperior.style.fontSize = '10px';

        labelInferior.style.position = 'absolute';
        labelInferior.style.bottom = '5px';
        labelInferior.style.width = '100%';
        labelInferior.style.textAlign = 'center';
        labelInferior.style.fontSize = '10px';

        dayElement.style.position = 'relative';
        dayElement.appendChild(labelSuperior);
        dayElement.appendChild(labelInferior);

        almacenarInteraccionDia(dayElement.dataset.date, 'otros', { concepto, diasAfectados });
    }
}

// Función para remover una guardia
function removeGuardia(dayElement, monthIndex) {
    dayElement.classList.remove('guardia', 'proxima-guardia', 'asunto', 'libre', 'vacaciones', 'mañana', 'tarde');
    const labels = dayElement.querySelectorAll('.tarde-label, .mañana-label, .otros-eventos-label');
    labels.forEach(label => label.remove());
    almacenarInteraccionDia(dayElement.dataset.date, 'libre');
}

// Función para gestionar la interacción con los días
function almacenarInteraccionDia(fecha, tipo, detalles = {}) {
    const interaccion = {
        fecha,
        tipo,
        detalles
    };
    // Guardar la interacción en localStorage o enviarla a un servidor
    console.log('Interacción almacenada:', interaccion); // Para depuración
}

// Event Listener para los días del calendario
document.querySelectorAll('.day').forEach(dayElement => {
    dayElement.addEventListener('click', () => {
        const tipoGuardia = prompt('Introduce el tipo de guardia (mañana, tarde, otros, remover):');
        if (tipoGuardia === 'mañana') {
            markMañana(dayElement);
        } else if (tipoGuardia === 'tarde') {
            markTarde(dayElement);
        } else if (tipoGuardia === 'otros') {
            markOtrosEventos(dayElement);
        } else if (tipoGuardia === 'remover') {
            removeGuardia(dayElement);
        }
    });
});

// Inicializar el calendario con días marcados previamente
function inicializarCalendario() {
    const interaccionesGuardadas = JSON.parse(localStorage.getItem('interacciones')) || [];
    interaccionesGuardadas.forEach(interaccion => {
        const dayElement = document.querySelector(`[data-date="${interaccion.fecha}"]`);
        if (dayElement) {
            if (interaccion.tipo === 'mañana') {
                markMañana(dayElement);
            } else if (interaccion.tipo === 'tarde') {
                markTarde(dayElement);
            } else if (interaccion.tipo === 'otros') {
                markOtrosEventos(dayElement);
            } else if (interaccion.tipo === 'remover') {
                removeGuardia(dayElement);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', inicializarCalendario);
