// utils.js

// Funciones para mostrar mensajes y diálogos
export function mostrarMensaje(mensaje) {
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

export function mostrarDialogo(mensaje, callback) {
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
}

export function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    dropdowns.forEach(dropdown => dropdown.remove());
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.onclick = null;
    }
}

// Funciones de formato de fechas
export function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

export function formatDateShort(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}

// Otras funciones utilitarias que necesites
