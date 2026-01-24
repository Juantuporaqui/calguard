// user.js - Gestión de usuarios y roles

const USER_CONFIG_KEY = 'calguard-user-config';

/**
 * Configuración del usuario
 */
export class UserConfig {
    constructor() {
        this.config = this.loadConfig();
    }

    /**
     * Carga la configuración del usuario
     */
    loadConfig() {
        const saved = localStorage.getItem(USER_CONFIG_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Error al cargar configuración de usuario:', e);
            }
        }
        return null;
    }

    /**
     * Guarda la configuración del usuario
     */
    saveConfig(config) {
        this.config = config;
        localStorage.setItem(USER_CONFIG_KEY, JSON.stringify(config));
    }

    /**
     * Verifica si el usuario está configurado
     */
    isConfigured() {
        return this.config !== null && this.config.nombre && this.config.placa;
    }

    /**
     * Verifica si el usuario es el jefe/coordinador
     */
    isJefe() {
        return this.config && this.config.rol === 'jefe';
    }

    /**
     * Obtiene la configuración actual
     */
    getConfig() {
        return this.config;
    }

    /**
     * Resetea la configuración
     */
    reset() {
        localStorage.removeItem(USER_CONFIG_KEY);
        this.config = null;
    }
}

/**
 * Muestra el diálogo de configuración inicial
 */
export function showUserConfigDialog(onComplete) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-dialogo';
    overlay.style.display = 'flex';

    const dialog = document.createElement('div');
    dialog.className = 'user-config-dialog';
    dialog.innerHTML = `
        <h2 style="color: var(--accent-color); margin-bottom: 20px;">Configuración Inicial</h2>
        <form id="user-config-form">
            <div class="form-group">
                <label for="user-nombre">Nombre Completo:</label>
                <input type="text" id="user-nombre" required placeholder="Ej: Juan García López">
            </div>
            <div class="form-group">
                <label for="user-placa">Placa/TIP:</label>
                <input type="text" id="user-placa" required placeholder="Ej: 12345">
            </div>
            <div class="form-group">
                <label for="user-email">Email (opcional):</label>
                <input type="email" id="user-email" placeholder="Ej: juan.garcia@policia.local">
            </div>
            <div class="form-group" style="margin-top: 20px; padding: 15px; background: var(--background); border-radius: 8px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="user-jefe" style="margin-right: 10px; width: 20px; height: 20px;">
                    <span style="font-weight: 600;">Soy el coordinador/jefe del grupo</span>
                </label>
                <p style="font-size: 14px; color: var(--text-secondary); margin-top: 8px; margin-left: 30px;">
                    El coordinador tiene acceso al cuadrante grupal y puede importar/exportar datos del equipo.
                </p>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top: 20px;">
                Guardar y Comenzar
            </button>
        </form>
    `;

    dialog.querySelector('#user-config-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const config = {
            nombre: document.getElementById('user-nombre').value.trim(),
            placa: document.getElementById('user-placa').value.trim(),
            email: document.getElementById('user-email').value.trim(),
            rol: document.getElementById('user-jefe').checked ? 'jefe' : 'funcionario',
            fechaCreacion: new Date().toISOString()
        };

        const userConfig = new UserConfig();
        userConfig.saveConfig(config);

        document.body.removeChild(overlay);

        if (onComplete) {
            onComplete(config);
        }
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

/**
 * Tipos de eventos disponibles
 */
export const TIPOS_EVENTOS = {
    // Eventos laborales (públicos)
    GUARDIA: {
        id: 'guardia',
        nombre: 'Guardia',
        icono: '🚨',
        color: 'var(--color-guardia)',
        publico: true,
        categoria: 'laboral'
    },
    LIBRE: {
        id: 'libre',
        nombre: 'Día Libre',
        icono: '🏖️',
        color: 'var(--color-libre)',
        publico: true,
        categoria: 'laboral'
    },
    ASUNTO: {
        id: 'asunto',
        nombre: 'Asunto Propio',
        icono: '📋',
        color: 'var(--color-asunto)',
        publico: true,
        categoria: 'laboral'
    },
    VACACIONES: {
        id: 'vacaciones',
        nombre: 'Vacaciones',
        icono: '✈️',
        color: 'var(--color-vacaciones)',
        publico: true,
        categoria: 'laboral'
    },
    TARDE: {
        id: 'tarde',
        nombre: 'Tarde',
        icono: '🌅',
        color: '#FFA500',
        publico: true,
        categoria: 'laboral'
    },
    MANANA: {
        id: 'mañana',
        nombre: 'Mañana',
        icono: '🌄',
        color: '#87CEEB',
        publico: true,
        categoria: 'laboral'
    },

    // Eventos personales (privados)
    MEDICO: {
        id: 'medico',
        nombre: 'Cita Médica',
        icono: '🏥',
        color: '#95a5a6',
        publico: false,
        categoria: 'personal'
    },
    FORMACION: {
        id: 'formacion',
        nombre: 'Formación',
        icono: '🎓',
        color: '#3498db',
        publico: false,
        categoria: 'personal'
    },
    CUMPLEANOS: {
        id: 'cumpleanos',
        nombre: 'Cumpleaños',
        icono: '🎂',
        color: '#e91e63',
        publico: false,
        categoria: 'personal'
    },
    PERSONAL: {
        id: 'personal',
        nombre: 'Evento Personal',
        icono: '📅',
        color: '#607d8b',
        publico: false,
        categoria: 'personal'
    }
};

/**
 * Obtiene eventos laborales
 */
export function getEventosLaborales() {
    return Object.values(TIPOS_EVENTOS).filter(e => e.categoria === 'laboral');
}

/**
 * Obtiene eventos personales
 */
export function getEventosPersonales() {
    return Object.values(TIPOS_EVENTOS).filter(e => e.categoria === 'personal');
}

/**
 * Obtiene un tipo de evento por ID
 */
export function getTipoEvento(id) {
    return Object.values(TIPOS_EVENTOS).find(e => e.id === id);
}
