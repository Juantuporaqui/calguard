// app-init.js - Inicialización de la aplicación

import { UserConfig } from './user.js';
import { getCuadranteManager } from './cuadrante.js';
import { initTheme } from './utils.js';

/**
 * Inicializa la aplicación
 */
export function initApp() {
    const userConfig = new UserConfig();

    // Verificar si hay sesión activa
    if (userConfig.isConfigured()) {
        mostrarApp(userConfig);
    } else {
        mostrarLogin(userConfig);
    }

    // Inicializar tema
    initTheme();
}

/**
 * Muestra la pantalla de login
 */
function mostrarLogin(userConfig) {
    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');

    loginScreen.style.display = 'flex';
    app.style.display = 'none';

    const loginForm = document.getElementById('login-form');
    loginForm.onsubmit = (e) => {
        e.preventDefault();

        const nombre = document.getElementById('login-nombre').value.trim();
        const password = document.getElementById('login-password').value;

        if (!nombre) {
            alert('Por favor, selecciona tu nombre');
            return;
        }

        const result = userConfig.loginByName(nombre, password);

        if (result.success) {
            mostrarApp(userConfig);
        } else {
            alert(result.message || 'Error al iniciar sesión');
        }
    };
}

/**
 * Muestra la aplicación principal
 */
function mostrarApp(userConfig) {
    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');
    const config = userConfig.getConfig();

    loginScreen.style.display = 'none';
    app.style.display = 'block';

    // Actualizar badge de usuario
    const badge = document.getElementById('user-badge');
    const badgeText = document.getElementById('user-name-badge');

    if (badgeText) {
        badgeText.textContent = config.nombre;
    }

    // Mostrar tab de cuadrante para TODOS (es consultivo, actualizado desde despacho)
    const cuadranteTab = document.querySelector('[data-view="cuadrante"]');
    if (cuadranteTab) {
        cuadranteTab.style.display = 'block';
    }

    // Marcar admin (Juan) con badge especial si necesario
    if (config.rol === 'admin') {
        badge.classList.add('admin');
    }

    // Inicializar cuadrante (disponible para todos, solo lectura)
    setTimeout(() => {
        const manager = getCuadranteManager();
        window.cuadranteManager = manager;
        window.userRole = config.rol; // Guardar rol (admin para funciones administrativas)
        window.userName = config.nombre; // Guardar nombre del usuario para importar turnos
    }, 500);
}

/**
 * Cambia entre vistas
 */
export function cambiarVista(vistaId) {
    // Actualizar tabs
    const tabs = document.querySelectorAll('.app-tab');
    tabs.forEach(tab => {
        if (tab.dataset.view === vistaId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Actualizar vistas
    const vistas = document.querySelectorAll('.app-view');
    vistas.forEach(vista => {
        vista.classList.remove('active');
    });

    const vistaActiva = document.getElementById(`vista-${vistaId}`);
    if (vistaActiva) {
        vistaActiva.classList.add('active');
    }

    // Si es cuadrante, renderizar
    if (vistaId === 'cuadrante' && window.cuadranteManager) {
        window.cuadranteManager.render('cuadrante-container');
    }
}

/**
 * Cierra la sesión
 */
export function cerrarSesion() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        const userConfig = new UserConfig();
        userConfig.logout();
        location.reload();
    }
}

/**
 * Posiciona el menú contextual para que siempre quepa en pantalla
 */
export function posicionarMenuContextual(menu, x, y) {
    const menuWidth = 240;
    const menuHeight = menu.offsetHeight || 400;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;

    // Ajustar X para que no se salga por la derecha
    if (x + menuWidth > windowWidth) {
        finalX = windowWidth - menuWidth - 10;
    }

    // Ajustar Y para que no se salga por abajo
    if (y + menuHeight > windowHeight) {
        finalY = windowHeight - menuHeight - 10;
    }

    // Ajustar Y para que no se salga por arriba
    if (finalY < 10) {
        finalY = 10;
    }

    // Ajustar X para que no se salga por la izquierda
    if (finalX < 10) {
        finalX = 10;
    }

    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
}

// Exportar funciones globales
window.cambiarVista = cambiarVista;
window.cerrarSesion = cerrarSesion;
