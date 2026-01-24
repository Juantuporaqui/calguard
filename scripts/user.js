// user.js - Gestión de usuarios y roles

const USER_CONFIG_KEY = 'calguard-user-config';
const USERS_DB_KEY = 'calguard-users-db';

/**
 * Hash simple para contraseñas (solo para uso interno)
 */
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

/**
 * Base de datos de usuarios
 */
class UsersDB {
    constructor() {
        this.users = this.load();
    }

    load() {
        const saved = localStorage.getItem(USERS_DB_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Error al cargar BD de usuarios:', e);
            }
        }
        return {};
    }

    save() {
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(this.users));
    }

    register(placa, password, nombre) {
        if (this.users[placa]) {
            return { success: false, message: 'La placa ya está registrada' };
        }

        this.users[placa] = {
            placa,
            passwordHash: hashPassword(password),
            nombre,
            fechaRegistro: new Date().toISOString()
        };

        this.save();
        return { success: true };
    }

    login(placa, password) {
        const user = this.users[placa];
        if (!user) {
            return { success: false, message: 'Placa no encontrada' };
        }

        if (user.passwordHash !== hashPassword(password)) {
            return { success: false, message: 'Contraseña incorrecta' };
        }

        return { success: true, user };
    }

    exists(placa) {
        return !!this.users[placa];
    }
}

// Instancia global
const usersDB = new UsersDB();

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
     * Verifica si el usuario es administrador (Juan)
     */
    isAdmin() {
        return this.config && this.config.rol === 'admin';
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

    /**
     * Login de usuario
     */
    login(placa, password) {
        // Verificar si el usuario ya existe
        if (!usersDB.exists(placa)) {
            // Primera vez: registrar
            const nombre = prompt('Primera vez con esta placa. ¿Cuál es tu nombre completo?');
            if (!nombre) return { success: false, message: 'Nombre requerido' };

            const result = usersDB.register(placa, password, nombre);
            if (!result.success) return result;
        }

        // Intentar login
        const result = usersDB.login(placa, password);
        if (!result.success) return result;

        // Guardar sesión
        // Juan es admin para funciones administrativas de la web
        const esAdmin = result.user.nombre.toUpperCase().includes('JUAN');

        this.saveConfig({
            placa: placa,
            nombre: result.user.nombre,
            rol: esAdmin ? 'admin' : 'usuario',
            fechaLogin: new Date().toISOString()
        });

        return { success: true };
    }

    /**
     * Cierra la sesión actual
     */
    logout() {
        this.reset();
    }
}

export { usersDB };

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
            <button type="submit" class="btn btn-primary" style="margin-top: 20px;">
                Guardar y Comenzar
            </button>
        </form>
    `;

    dialog.querySelector('#user-config-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const nombre = document.getElementById('user-nombre').value.trim();
        const esAdmin = nombre.toUpperCase().includes('JUAN');

        const config = {
            nombre: nombre,
            placa: document.getElementById('user-placa').value.trim(),
            email: document.getElementById('user-email').value.trim(),
            rol: esAdmin ? 'admin' : 'usuario',
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
