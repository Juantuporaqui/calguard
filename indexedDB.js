// indexedDB.js

function guardarContadorEnIndexedDB(clave, valor) {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        if (!db.objectStoreNames.contains('dias')) {
        db.createObjectStore('dias', { keyPath: 'fecha' });
    }
    if (!db.objectStoreNames.contains('configuracion')) {
        db.createObjectStore('configuracion', { keyPath: 'clave' });
    }
    if (!db.objectStoreNames.contains('registro')) {
        db.createObjectStore('registro', { autoIncrement: true });
    }
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
            }
        };
    };
}
