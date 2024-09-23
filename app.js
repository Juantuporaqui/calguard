// Inicializar la base de datos IndexedDB
const request = indexedDB.open('calendarioDB', 1);

request.onupgradeneeded = function(event) {
    const db = event.target.result;

    // Creamos un objeto de almacenamiento para los días
    const store = db.createObjectStore('dias', { keyPath: 'id', autoIncrement: true });

    // Creamos un índice para buscar por tipo de día (guardia, libre, etc.)
    store.createIndex('tipo', 'tipo', { unique: false });
};

request.onsuccess = function(event) {
    console.log('IndexedDB inicializada');
    const db = event.target.result;

    // Llama a la función para recuperar los días almacenados al cargar la página
    obtenerDiasDeIndexedDB();
};

// Función para guardar un día en IndexedDB
function guardarDiaEnIndexedDB(dia, tipo) {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('dias', 'readwrite');
        const store = transaction.objectStore('dias');

        // Guardar día en la base de datos
        store.add({
            fecha: dia,  // Por ejemplo, '2024-10-01'
            tipo: tipo   // Por ejemplo, 'guardia' o 'libre'
        });

        transaction.oncomplete = function() {
            console.log('Día guardado en IndexedDB:', dia);
            alert(`Día guardado: ${dia} como ${tipo}`);
        };
    };
}

// Función para obtener y mostrar los días guardados en IndexedDB
function obtenerDiasDeIndexedDB() {
    const request = indexedDB.open('calendarioDB', 1);

    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction('dias', 'readonly');
        const store = transaction.objectStore('dias');

        const diasGuardados = [];

        store.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                diasGuardados.push(cursor.value);
                cursor.continue();
            } else {
                // Mostramos los días guardados en consola o los reconstruimos en la interfaz
                console.log('Días recuperados de IndexedDB:', diasGuardados);
                mostrarDiasEnCalendario(diasGuardados); // Llama a una función para mostrar en el calendario
            }
        };
    };
}

// Función para mostrar los días recuperados en el calendario
function mostrarDiasEnCalendario(dias) {
    dias.forEach(dia => {
        // Lógica para marcar los días en el calendario
        const elementoDia = document.querySelector(`[data-date="${dia.fecha}"]`);
        if (elementoDia) {
            if (dia.tipo === 'guardia') {
                elementoDia.classList.add('guardia');
            } else if (dia.tipo === 'libre') {
                elementoDia.classList.add('libre');
            }
        }
    });
}

// Ejemplo: Guardar un día de guardia
document.getElementById('guardarGuardia').addEventListener('click', function() {
    const dia = document.getElementById('fechaGuardia').value; // Captura la fecha de un input
    guardarDiaEnIndexedDB(dia, 'guardia');
});

// Ejemplo: Guardar un día libre
document.getElementById('guardarLibre').addEventListener('click', function() {
    const dia = document.getElementById('fechaLibre').value; // Captura la fecha de un input
    guardarDiaEnIndexedDB(dia, 'libre');
});
