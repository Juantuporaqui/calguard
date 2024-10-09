// db.js

// Inicialización de IndexedDB
export function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('calendarioDB', 1);

        request.onupgradeneeded = function (event) {
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

            // Almacén para 'registro'
            if (!db.objectStoreNames.contains('registro')) {
                db.createObjectStore('registro', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = function (event) {
            const db = event.target.result;
            resolve(db);
        };

        request.onerror = function (event) {
            console.error("Error al abrir IndexedDB:", event);
            reject(event);
        };
    });
}

// Funciones para guardar y obtener datos

// Guardar día en IndexedDB
export function guardarDiaEnIndexedDB(db, dia, tipo, detalle = null) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('dias', 'readwrite');
        const store = transaction.objectStore('dias');

        // Eliminar cualquier registro existente para esa fecha y tipo
        const index = store.index('fecha');
        const request = index.openCursor(IDBKeyRange.only(dia));

        request.onsuccess = function (event) {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.tipo === tipo) {
                    cursor.delete();
                }
                cursor.continue();
            } else {
                // Guardar el nuevo registro
                store.add({
                    fecha: dia,
                    tipo: tipo,
                    detalle: detalle
                }).onsuccess = function () {
                    resolve();
                };
            }
        };

        request.onerror = function (event) {
            console.error("Error al guardar el día en IndexedDB:", event);
            reject(event);
        };
    });
}

// Obtener todos los días de IndexedDB
export function obtenerDiasDeIndexedDB(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('dias', 'readonly');
        const store = transaction.objectStore('dias');
        const request = store.getAll();

        request.onsuccess = function (event) {
            resolve(event.target.result);
        };

        request.onerror = function (event) {
            console.error("Error al obtener los días de IndexedDB:", event);
            reject(event);
        };
    });
}

// Eliminar un día de IndexedDB
export function eliminarDiaDeIndexedDB(db, dia, tipo) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('dias', 'readwrite');
        const store = transaction.objectStore('dias');
        const index = store.index('fecha');

        index.openCursor(IDBKeyRange.only(dia)).onsuccess = function (event) {
            const cursor = event.target.result;
            if (cursor && cursor.value.tipo === tipo) {
                cursor.delete();
                cursor.continue();
            } else if (cursor) {
                cursor.continue();
            } else {
                resolve();
            }
        };

        index.onerror = function (event) {
            console.error("Error al eliminar el día de IndexedDB:", event);
            reject(event);
        };
    });
}

// Guardar configuración en IndexedDB
export function guardarConfiguracionEnIndexedDB(db, clave, valor) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('configuracion', 'readwrite');
        const store = transaction.objectStore('configuracion');

        store.put({ clave: clave, valor: valor }).onsuccess = function () {
            resolve();
        };

        transaction.onerror = function (event) {
            console.error("Error al guardar la configuración en IndexedDB:", event);
            reject(event);
        };
    });
}

// Obtener configuración de IndexedDB
export function obtenerConfiguracionDeIndexedDB(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('configuracion', 'readonly');
        const store = transaction.objectStore('configuracion');
        const request = store.getAll();

        request.onsuccess = function (event) {
            resolve(event.target.result);
        };

        request.onerror = function (event) {
            console.error("Error al obtener la configuración de IndexedDB:", event);
            reject(event);
        };
    });
}

// Guardar registro de librados en IndexedDB
export function saveRegistroLibradosToIndexedDB(db, registroLibrados) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('registro', 'readwrite');
        const store = transaction.objectStore('registro');

        // Limpiar el almacén antes de guardar
        store.clear().onsuccess = function () {
            // Agregar todas las entradas de registroLibrados
            const promises = registroLibrados.map(entry => {
                return new Promise((resolveEntry, rejectEntry) => {
                    store.add(entry).onsuccess = resolveEntry;
                    store.onerror = rejectEntry;
                });
            });

            Promise.all(promises).then(resolve).catch(reject);
        };

        transaction.onerror = function (event) {
            console.error("Error al guardar el registro en IndexedDB:", event);
            reject(event);
        };
    });
}

// Cargar registro de librados desde IndexedDB
export function loadRegistroLibradosFromIndexedDB(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('registro', 'readonly');
        const store = transaction.objectStore('registro');
        const request = store.getAll();

        request.onsuccess = function (event) {
            resolve(event.target.result);
        };

        request.onerror = function (event) {
            console.error("Error al cargar el registro desde IndexedDB:", event);
            reject(event);
        };
    });
}

// Resetear IndexedDB
export function resetIndexedDB(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dias', 'configuracion', 'registro'], 'readwrite');
        const diasStore = transaction.objectStore('dias');
        const configStore = transaction.objectStore('configuracion');
        const registroStore = transaction.objectStore('registro');

        diasStore.clear();
        configStore.clear();
        registroStore.clear();

        transaction.oncomplete = function () {
            resolve();
        };

        transaction.onerror = function (event) {
            console.error("Error al resetear IndexedDB:", event);
            reject(event);
        };
    });
}
