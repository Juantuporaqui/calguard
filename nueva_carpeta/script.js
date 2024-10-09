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

// Aquí puedes agregar cualquier otra función que no pertenezca a los archivos calendar.js, ui.js, o indexedDB.js
