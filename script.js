
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
