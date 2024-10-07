

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
    const request = indexedDB.open('calendarioDB', 1); // Asegúrate de usar la versión correcta

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
    asuntosPropios = 8; // Ajusta según el valor por defecto
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
        
        
        // Reemplaza una de las funciones por esta versión combinada
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
    let asuntosPropios = 8; // Inicializado a 8
    let libresGastados = 0;
    let diasVacaciones = 25;
    let diasPorGuardia = 5;
    let asuntosAnuales = 8;
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

function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    dropdowns.forEach(dropdown => dropdown.remove());
    document.getElementById('overlay').style.display = 'none';
}

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

let guardiasRealizadas = [];

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function markWeekAsGuardia(dayElement, monthIndex) {
    const selectedDate = new Date(dayElement.dataset.date);
    const semana = obtenerSemana(selectedDate);
    let guardiaDias = [];

    // Recorre todos los días de la semana y marca cada uno como "guardia"
    semana.forEach(dia => {
        const diaDiv = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
        if (diaDiv) {
            diaDiv.classList.add('guardia');
            // Almacenar la interacción en IndexedDB
            almacenarInteraccionDia(diaDiv.dataset.date, 'guardia');
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
    saveRegistroLibradosToIndexedDB();

    // Actualizar el registro visualmente
    updateRegistroLibrados();
}


function formatDateShort(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
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

function markProximaGuardia(dayElement, monthIndex) {
    const selectedDate = new Date(dayElement.dataset.date);
    const semana = obtenerSemana(selectedDate);

    // Marcar toda la semana como 'proxima-guardia'
    semana.forEach(dia => {
        const diaDiv = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
        if (diaDiv) {
            diaDiv.classList.add('proxima-guardia');
            almacenarInteraccionDia(diaDiv.dataset.date, 'proxima-guardia');
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
        almacenarInteraccionDia(dayElement.dataset.date, 'asunto');

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
        mostrarDialogo("Selecciona el día final de vacaciones.");
        document.querySelectorAll('.day').forEach(dia => {
            dia.onclick = function() {
                const endDate = new Date(dia.dataset.date);
                const startDate = new Date(vacationStart.dataset.date);

                if (endDate >= startDate) {
                    let selectedDays = getDaysInRange(startDate, endDate);
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

function obtenerRangoVacaciones(selectedDate) {
    return vacationRanges.find(range => {
        return selectedDate >= range.start && selectedDate <= range.end;
    });
}


function crearBackup() {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const backupData = {};

        const transaction = db.transaction(['dias', 'configuracion'], 'readonly');
        const diasStore = transaction.objectStore('dias');
        const configuracionStore = transaction.objectStore('configuracion');

        // Obtener datos de 'dias'
        diasStore.getAll().onsuccess = function(event) {
            backupData.dias = event.target.result;

            // Obtener datos de 'configuracion'
            configuracionStore.getAll().onsuccess = function(event) {
                backupData.configuracion = event.target.result;

                // Convertir los datos a JSON y crear un blob para descargar
                const dataStr = JSON.stringify(backupData, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                // Crear un enlace para descargar el archivo
                const a = document.createElement('a');
                a.href = url;
                a.download = 'backup_calendario.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                // Notificar al usuario que la copia de seguridad se ha descargado
                mostrarMensaje("La copia de seguridad se ha creado y descargado correctamente.");
            };
        };
    };

    request.onerror = function(event) {
        mostrarMensaje("Error al crear la copia de seguridad.");
        console.error("Error al abrir IndexedDB:", event);
    };
}

function mostrarMensaje(mensaje) {
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = 'mensaje-notificacion';
    mensajeDiv.innerText = mensaje;

    // Estilos del mensaje
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

    // Eliminar el mensaje después de 3 segundos
    setTimeout(() => {
        mensajeDiv.remove();
    }, 3000);
}



function getDaysInRange(startDate, endDate) {
    let days = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
}

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

function resetDayClickHandlers() {
    document.querySelectorAll('.day').forEach((dia) => {
        dia.onclick = function (event) {
            const dayElement = event.currentTarget;
            const monthIndex = parseInt(dayElement.dataset.date.split('-')[1]) - 1;
            const dayNumber = parseInt(dayElement.innerText);
            showDropdownMenu(event, dayElement, monthIndex, dayNumber);
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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);

        // Almacenar en IndexedDB
        almacenarInteraccionDia(dayElement.dataset.date, 'tarde');
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
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);

        // Almacenar en IndexedDB
        almacenarInteraccionDia(dayElement.dataset.date, 'mañana');
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
    labelSuperior.style.fontSize = '10px';

    labelInferior.style.position = 'absolute';
    labelInferior.style.bottom = '5px';
    labelInferior.style.width = '100%';
    labelInferior.style.textAlign = 'center';
    labelInferior.style.fontSize = '10px';

    dayElement.style.position = 'relative';
    dayElement.appendChild(labelSuperior);
    dayElement.appendChild(labelInferior);

    // Actualizar el contador de días libres
    daysLibres += diasAfectados;
    updateCounter();

    // Almacenar la interacción en IndexedDB
    almacenarInteraccionDia(dayElement.dataset.date, 'otros', { concepto: concepto, diasAfectados: diasAfectados });

    // Actualizar el registro de librados
    const signo = diasAfectados >= 0 ? 'Sumados' : 'Restados';
    registroLibrados.push(`${concepto} (${formatDate(new Date(dayElement.dataset.date))}): ${signo} ${Math.abs(diasAfectados)} días libres.`);
    updateRegistroLibrados();
}

function showConceptPopup(concepto, diasAfectados) {
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = `
        <div class="popup-content">
            <p><strong>Concepto:</strong> ${concepto}</p>
            <p><strong>Días afectados:</strong> ${diasAfectados}</p>
            <button onclick="closePopup()">Cerrar</button>
        </div>
    `;

    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.backgroundColor = '#fff';
    popup.style.padding = '20px';
    popup.style.border = '1px solid #ddd';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0px 4px 10px rgba(0, 0, 0, 0.1)';
    popup.style.zIndex = '1000';

    document.body.appendChild(popup);
}


function removeGuardia(dayElement, monthIndex) {
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
                eliminarDiaDeIndexedDB(diaDiv.dataset.date, 'guardia');
                eliminarDiaDeIndexedDB(diaDiv.dataset.date, 'proxima-guardia');
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
        saveRegistroLibradosToIndexedDB();

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
                    eliminarDiaDeIndexedDB(dateStr, 'vacaciones');
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
        eliminarDiaDeIndexedDB(dayElement.dataset.date, 'libre');

        // Actualizar contadores
        daysLibres += 1;
        libresGastados -= 1;
        updateCounter();

        // Actualizar el registro
        const fechaEliminada = formatDateShort(selectedDate);
        registroLibrados = registroLibrados.filter(entry => !entry.texto.includes(fechaEliminada));
        updateRegistroLibrados();
        saveRegistroLibradosToIndexedDB();

    } else if (tipoDia === 'asunto') {
        dayElement.classList.remove('asunto');
        eliminarDiaDeIndexedDB(dayElement.dataset.date, 'asunto');

        // Actualizar contador de asuntos propios
        asuntosPropios += 1;
        updateCounter();

    } else if (tipoDia === 'tarde') {
        const label = dayElement.querySelector('.tarde-label');
        if (label) {
            label.remove();
            eliminarDiaDeIndexedDB(dayElement.dataset.date, 'tarde');
        }

    } else if (tipoDia === 'mañana') {
        const label = dayElement.querySelector('.mañana-label');
        if (label) {
            label.remove();
            eliminarDiaDeIndexedDB(dayElement.dataset.date, 'mañana');
        }

    } else if (tipoDia === 'otros') {
        // Remover las etiquetas de 'otros-eventos'
        const labels = dayElement.querySelectorAll('.otros-eventos-label');
        labels.forEach(label => label.remove());
        eliminarDiaDeIndexedDB(dayElement.dataset.date, 'otros');

        // Actualizar el contador de días libres
        const diasAfectados = parseInt(dayElement.dataset.diasAfectados, 10);
        daysLibres -= diasAfectados;
        updateCounter();

        // Actualizar el registro
        const concepto = dayElement.dataset.conceptoCompleto;
        registroLibrados = registroLibrados.filter(entry => !entry.texto.includes(`${concepto} (${formatDate(selectedDate)})`));
        updateRegistroLibrados();
        saveRegistroLibradosToIndexedDB();

        // Remover dataset
        delete dayElement.dataset.diasAfectados;
        delete dayElement.dataset.conceptoCompleto;
    }

    mostrarMensaje("Evento eliminado correctamente.");
}


function mostrarRegistro() {
    const registroTexto = registroLibrados.length > 0 ? registroLibrados.join('<br>') : 'No hay días libres registrados.';
    
    const nuevaVentana = window.open('', '', 'width=400,height=600');
    nuevaVentana.document.write('<html><head><title>Registro de Días</title></head><body>');
    nuevaVentana.document.write(`<h3>Registro de Días</h3><p>${registroTexto}</p>`);
    nuevaVentana.document.write('</body></html>');
    nuevaVentana.document.close();
}

function cerrarModal(button) {
    const modal = button.parentElement;
    if (modal) {
        modal.remove();
    }
}

function checkGuardiaProxima() {
    const today = new Date().toISOString().split('T')[0];
    const diaDiv = document.querySelector(`.day[data-date="${today}"]`);

    if (diaDiv && diaDiv.classList.contains('proxima-guardia')) {
        const fechaGuardia = formatDate(new Date(today));
        const guardia = guardiasRealizadas.find(g => g.fecha === fechaGuardia);

        if (guardia && guardia.anticipada) {
            // La guardia ya fue anticipada, solo marcar la semana
            markWeekAsGuardia(diaDiv, new Date(today).getMonth());
            mostrarMensaje("¡Hoy comienza tu guardia anticipada!");
        } else {
            // Sumar días libres
            daysLibres += diasPorGuardia;
            updateCounter();

            // Marcar la semana como 'guardia'
            markWeekAsGuardia(diaDiv, new Date(today).getMonth());

            // Actualizar registro
            registroLibrados.push(`Guardia del ${fechaGuardia}: Generados ${diasPorGuardia} días libres.`);
            updateRegistroLibrados();

            mostrarMensaje("¡Hoy comienza tu guardia!");
        }

        // Remover la clase 'proxima-guardia' de toda la semana
        const semana = obtenerSemana(new Date(today));
        semana.forEach(dia => {
            const diaDivSemana = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
            if (diaDivSemana) {
                diaDivSemana.classList.remove('proxima-guardia');
                eliminarDiaDeIndexedDB(diaDivSemana.dataset.date, 'proxima-guardia');
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
    guardarConfiguracionEnIndexedDB('diasPorGuardia', diasPorGuardia);
    guardarConfiguracionEnIndexedDB('asuntosAnuales', asuntosAnuales);
    guardarConfiguracionEnIndexedDB('diasVacaciones', diasVacaciones);
    guardarConfiguracionEnIndexedDB('diasExtra', diasExtra);

    // Actualizar los días libres con los días extra
    daysLibres += diasExtra;
    updateCounter();
}

let diasSeleccionados = [];
let seleccionDiaHandler; // Variable para almacenar la función del event listener

function solicitarDiasGuardia(dayElement) {
    closeAllDropdowns(); // Asegura que el overlay esté oculto
    diasSeleccionados = [];
    mostrarDialogo("Selecciona los días. Haz clic en cada día. Cuando termines, presiona Confirmar.");

    seleccionDiaHandler = function() {
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
    dia.removeEventListener('click', showDropdownMenu); //  <--- Añadir esta línea
    dia.addEventListener('click', seleccionDiaHandler);
});

    mostrarBotonConfirmacion();
}

function mostrarBotonConfirmacion() {
    const confirmButton = document.createElement('button');
    confirmButton.innerText = "Confirmar Selección";
    confirmButton.style.position = "fixed";
    confirmButton.style.bottom = "20px";
    confirmButton.style.right = "20px";
    confirmButton.style.zIndex = "1000";
    confirmButton.style.padding = "10px";
    confirmButton.style.backgroundColor = "#4CAF50";
    confirmButton.style.color = "white";
    confirmButton.style.border = "none";
    confirmButton.style.borderRadius = "4px";
    confirmButton.style.cursor = "pointer";

    document.body.appendChild(confirmButton);

    confirmButton.onclick = function() {
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
        almacenarInteraccionDia(dia.dataset.date, 'libre');  // Asegura que el día se guarda en IndexedDB como "libre"
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
            registroGuardiasDetalle.push(registroTexto);

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
    registroLibrados.push(...registroGuardiasDetalle.map(texto => ({
        tipo: 'libre',
        texto: texto
    })));

// Guardar en IndexedDB
    saveRegistroLibradosToIndexedDB();

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

function resetDayClickHandlers() {
    document.querySelectorAll('.day').forEach((dia) => {
        dia.onclick = function (event) {
            const dayElement = event.target;
            const monthIndex = parseInt(dayElement.dataset.date.split('-')[1]) - 1;
            const dayNumber = parseInt(dayElement.innerText);
            showDropdownMenu(event, dayElement, monthIndex, dayNumber);
        };
    });
}

window.onload = () => {
    generateYearCalendar(2024);
    generateYearCalendar(2025);
    generateYearCalendar(2026);
    obtenerDiasDeIndexedDB();          // Cargar los días seleccionados
    obtenerConfiguracionDeIndexedDB(); // Cargar los contadores
    loadRegistroLibradosFromIndexedDB(); // Cargar el registro de días librados
    checkGuardiaProxima();  
    setInterval(checkGuardiaProxima, 86400000);
};

// Agrega este evento al cargar la página
document.addEventListener('click', function(event) {
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


function enviarWhatsAppAlJefe() {
    const mensaje = encodeURIComponent(`Hola, estos son los días de guardia y libres asignados:\n\n${registroLibrados.join('\n')}`);
    const url = `https://wa.me/?text=${mensaje}`;
    window.open(url, '_blank');
}
   
function eliminarDiaDeIndexedDB(dia, tipo) {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('dias', 'readwrite');
        const store = transaction.objectStore('dias');

        const index = store.index('fecha');
        index.openCursor(IDBKeyRange.only(dia)).onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor && cursor.value.tipo === tipo) {
                cursor.delete();
                console.log(`Día ${dia} del tipo ${tipo} eliminado de IndexedDB.`);
            }
        };
    };
}


// Función para cerrar ventanas o popups
function closePopup() {
    const popup = document.querySelector('.popup');
    if (popup) {
        popup.remove();
    }
}

// Escuchar eventos de clic en los botones de Guardar Día de Guardia y Guardar Día Libre
document.addEventListener('DOMContentLoaded', function () {
    // Guardar Día de Guardia
    document.getElementById('guardarGuardia').addEventListener('click', function () {
        const fechaGuardia = document.getElementById('fechaGuardia').value;
        if (fechaGuardia) {
            guardarDiaEnIndexedDB(fechaGuardia, 'guardia');
            alert('Día de guardia guardado');
        } else {
            alert('Por favor, selecciona una fecha');
        }
    });

    // Guardar Día Libre
    document.getElementById('guardarLibre').addEventListener('click', function () {
        const fechaLibre = document.getElementById('fechaLibre').value;
        if (fechaLibre) {
            guardarDiaEnIndexedDB(fechaLibre, 'libre');
            alert('Día libre guardado');
        } else {
            alert('Por favor, selecciona una fecha');
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const currentYear = new Date().getFullYear();
    generateYearCalendar(currentYear);
});

