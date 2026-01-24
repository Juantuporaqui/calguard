// cuadrante.js - Vista de cuadrante grupal (visible para todos)

import { getCurrentYear } from './calendar.js';
import { formatDateShort, mostrarMensaje, mostrarConfirmacion } from './utils.js';
import { UserConfig } from './user.js';

const CUADRANTE_DATA_KEY = 'calguard-cuadrante-data';
const MAX_USUARIOS = 8;

// Nombres reales del equipo
const NOMBRES_EQUIPO = ['Tesa', 'Paco', 'Mario', 'Rafa', 'Reinoso', 'Nuria', 'Juan', 'Carmen'];

/**
 * Clase para gestionar el cuadrante grupal
 */
export class CuadranteManager {
    constructor() {
        this.usuarios = this.loadUsuarios();
        this.currentMonth = new Date().getMonth();
        this.currentYear = getCurrentYear();
    }

    /**
     * Carga los datos de usuarios del cuadrante
     */
    loadUsuarios() {
        const saved = localStorage.getItem(CUADRANTE_DATA_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Error al cargar cuadrante:', e);
            }
        }
        return this.getDefaultUsuarios();
    }

    /**
     * Obtiene la estructura por defecto de usuarios
     */
    getDefaultUsuarios() {
        const usuarios = [];

        // Crear usuarios con los nombres del equipo
        for (let i = 0; i < MAX_USUARIOS; i++) {
            usuarios.push({
                id: i + 1,
                nombre: NOMBRES_EQUIPO[i],
                placa: `${1000 + i}`,
                color: this.getColorForUser(i),
                eventos: []
            });
        }

        return usuarios;
    }

    /**
     * Obtiene un color único para un usuario
     */
    getColorForUser(index) {
        const colors = [
            '#ff6961', // rojo - Tesa
            '#77dd77', // verde - Paco
            '#aec6cf', // azul claro - Mario
            '#f49ac2', // rosa - Rafa
            '#fdfd96', // amarillo - Reinoso
            '#cb99c9', // morado - Nuria
            '#ff964f', // naranja - Juan
            '#95e1d3'  // turquesa - Carmen
        ];
        return colors[index % colors.length];
    }

    /**
     * Guarda los datos del cuadrante
     */
    save() {
        localStorage.setItem(CUADRANTE_DATA_KEY, JSON.stringify(this.usuarios));
    }

    /**
     * Actualiza los datos de un usuario
     */
    updateUsuario(id, data) {
        const usuario = this.usuarios.find(u => u.id === id);
        if (usuario) {
            Object.assign(usuario, data);
            this.save();
        }
    }

    /**
     * Añade un evento a un usuario
     */
    addEvento(usuarioId, evento) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (usuario) {
            usuario.eventos.push(evento);
            this.save();
        }
    }

    /**
     * Importa datos de un funcionario (archivo JSON)
     */
    importarDatosFuncionario(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

            if (!data.usuario || !data.eventos) {
                throw new Error('Formato de datos inválido');
            }

            // Buscar si el usuario ya existe
            let usuario = this.usuarios.find(u =>
                u.placa === data.usuario.placa ||
                u.nombre === data.usuario.nombre
            );

            if (!usuario) {
                // Buscar el primer usuario placeholder disponible
                usuario = this.usuarios.find(u => u.nombre.startsWith('Usuario '));
                if (!usuario) {
                    throw new Error('No hay espacios disponibles para más usuarios');
                }
            }

            // Actualizar datos del usuario
            usuario.nombre = data.usuario.nombre;
            usuario.placa = data.usuario.placa;

            // Filtrar solo eventos públicos (laborales)
            usuario.eventos = data.eventos.filter(e => e.publico !== false);

            this.save();
            return usuario.nombre;
        } catch (error) {
            console.error('Error al importar datos:', error);
            throw error;
        }
    }

    /**
     * Exporta el cuadrante maestro
     */
    exportarCuadrante() {
        const exportData = {
            version: '2.0',
            tipo: 'cuadrante_maestro',
            fecha: new Date().toISOString(),
            año: this.currentYear,
            mes: this.currentMonth + 1,
            usuarios: this.usuarios.map(u => ({
                id: u.id,
                nombre: u.nombre,
                placa: u.placa,
                eventos: u.eventos.filter(e => e.publico !== false) // Solo eventos públicos
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `cuadrante-maestro-${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}.json`;
        link.click();

        URL.revokeObjectURL(url);
        return exportData;
    }

    /**
     * Renderiza la vista del cuadrante
     */
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Contenedor de cuadrante no encontrado');
            return;
        }

        const html = this.generateCuadranteHTML();
        container.innerHTML = html;

        this.attachEventListeners();
    }

    /**
     * Genera el HTML del cuadrante
     */
    generateCuadranteHTML() {
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        // Botón para importar mis turnos del cuadrante a mi calendario personal
        const botonImportarMisTurnos = `
            <button class="btn btn-info" onclick="window.cuadranteManager.importarMisTurnos()" title="Importar mis turnos del cuadrante a mi calendario personal">
                📲 Importar Mis Turnos
            </button>
        `;

        // Botones para gestión del cuadrante completo (desde despacho)
        const botonesGestionCompleta = `
            <button class="btn btn-primary" onclick="window.cuadranteManager.importarCuadranteCompleto()" title="Importar cuadrante completo desde archivo JSON">
                📥 Cargar Cuadrante
            </button>
            <button class="btn btn-success" onclick="window.cuadranteManager.exportarCuadranteCompleto()" title="Descargar cuadrante completo a archivo JSON">
                📤 Guardar Cuadrante
            </button>
            <button class="btn btn-secondary" onclick="window.cuadranteManager.descargarPlantilla()" title="Descargar plantilla vacía para rellenar" style="font-size: 14px;">
                📋 Plantilla
            </button>
        `;

        let html = `
            <div class="cuadrante-header">
                <h2 style="color: var(--accent-color); margin: 0;">
                    Cuadrante ${monthNames[this.currentMonth]} ${this.currentYear}
                    <small style="color: var(--text-secondary); font-size: 0.6em; font-weight: normal; display: block;">(Click en celdas para editar desde despacho)</small>
                </h2>
                <div class="cuadrante-actions">
                    <button class="btn btn-secondary" onclick="window.cuadranteManager.prevMonth()">◀ Mes Anterior</button>
                    <button class="btn btn-secondary" onclick="window.cuadranteManager.nextMonth()">Mes Siguiente ▶</button>
                    ${botonImportarMisTurnos}
                    ${botonesGestionCompleta}
                </div>
            </div>

            <div class="cuadrante-grid">
                <table class="cuadrante-table">
                    <thead>
                        <tr class="month-row">
                            <th class="month-cell" colspan="${daysInMonth + 1}">
                                ${monthNames[this.currentMonth]} ${this.currentYear}
                            </th>
                        </tr>
                        <tr class="days-row">
                            <th class="user-header"></th>`;

        // Encabezados de días con día de semana
        const diasSemana = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
        for (let day = 1; day <= daysInMonth; day++) {
            const fecha = new Date(this.currentYear, this.currentMonth, day);
            const diaSemana = diasSemana[fecha.getDay()];
            const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
            const claseWeekend = esFinDeSemana ? 'weekend-header' : '';
            html += `<th class="${claseWeekend}"><div class="day-header"><span class="day-number">${day}</span><span class="day-name">${diaSemana}</span></div></th>`;
        }

        html += `</tr>
                    </thead>
                    <tbody>`;

        // Filas de usuarios
        this.usuarios.forEach(usuario => {
            // Abreviar nombre (primeras 4 letras)
            const nombreAbreviado = usuario.nombre.substring(0, 4);
            html += `<tr>
                        <td class="user-name-cell" title="${usuario.nombre}">${nombreAbreviado}</td>`;

            // Celdas de días
            for (let day = 1; day <= daysInMonth; day++) {
                const fecha = new Date(this.currentYear, this.currentMonth, day);
                const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
                const claseWeekend = esFinDeSemana ? 'weekend-cell' : '';

                const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const eventos = usuario.eventos.filter(e => {
                    if (e.fecha === dateStr) return true;
                    if (e.fechaInicio && e.fechaFin) {
                        const fecha = new Date(dateStr);
                        const inicio = new Date(e.fechaInicio);
                        const fin = new Date(e.fechaFin);
                        return fecha >= inicio && fecha <= fin;
                    }
                    return false;
                });

                const icono = eventos.length > 0 ? this.getIconoEvento(eventos[0].tipo) : '';
                const eventoTitles = eventos.map(e => e.tipo).join(', ');
                const tieneEvento = eventos.length > 0 ? 'has-event' : '';
                html += `<td class="event-cell ${claseWeekend} ${tieneEvento}"
                            title="${eventoTitles}"
                            data-usuario="${usuario.nombre}"
                            data-fecha="${dateStr}"
                            onclick="window.cuadranteManager.editarCelda('${usuario.nombre}', '${dateStr}')">${icono}</td>`;
            }

            html += `</tr>`;
        });

        html += `</tbody>
                </table>
            </div>`;

        // Estadísticas
        html += this.generateStatsHTML();

        return html;
    }

    /**
     * Obtiene el icono de un tipo de evento
     */
    getIconoEvento(tipo) {
        const iconos = {
            'guardia': '🚨',
            'libre': '🏖️',
            'asunto': '📋',
            'vacaciones': '✈️',
            'tarde': '🌅',
            'mañana': '🌄'
        };
        return iconos[tipo] || '📅';
    }

    /**
     * Genera HTML de estadísticas
     */
    generateStatsHTML() {
        const stats = this.calculateStats();

        return `
            <div class="cuadrante-stats">
                <div class="stat-card">
                    <h4>Guardias Activas</h4>
                    <div class="stat-value">${stats.guardiasActivas}</div>
                </div>
                <div class="stat-card">
                    <h4>Funcionarios Disponibles</h4>
                    <div class="stat-value">${stats.disponibles}</div>
                </div>
                <div class="stat-card">
                    <h4>De Vacaciones</h4>
                    <div class="stat-value">${stats.vacaciones}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Eventos</h4>
                    <div class="stat-value">${stats.totalEventos}</div>
                </div>
            </div>
        `;
    }

    /**
     * Calcula estadísticas del cuadrante
     */
    calculateStats() {
        const today = new Date().toISOString().split('T')[0];
        let guardiasActivas = 0;
        let vacaciones = 0;
        let totalEventos = 0;

        this.usuarios.forEach(usuario => {
            const eventosHoy = usuario.eventos.filter(e => {
                if (e.fecha === today) return true;
                if (e.fechaInicio && e.fechaFin) {
                    const fecha = new Date(today);
                    const inicio = new Date(e.fechaInicio);
                    const fin = new Date(e.fechaFin);
                    return fecha >= inicio && fecha <= fin;
                }
                return false;
            });

            eventosHoy.forEach(e => {
                if (e.tipo === 'guardia') guardiasActivas++;
                if (e.tipo === 'vacaciones') vacaciones++;
                totalEventos++;
            });
        });

        return {
            guardiasActivas,
            vacaciones,
            disponibles: MAX_USUARIOS - guardiasActivas - vacaciones,
            totalEventos
        };
    }

    /**
     * Adjunta event listeners
     */
    attachEventListeners() {
        // Los event listeners se manejan mediante onclick en el HTML
        // Esto es para mantener la simplicidad
    }

    /**
     * Navega al mes anterior
     */
    prevMonth() {
        if (this.currentMonth === 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else {
            this.currentMonth--;
        }
        this.render('cuadrante-container');
    }

    /**
     * Navega al mes siguiente
     */
    nextMonth() {
        if (this.currentMonth === 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else {
            this.currentMonth++;
        }
        this.render('cuadrante-container');
    }

    /**
     * Muestra el diálogo para importar archivo
     */
    importarArchivo() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const nombre = this.importarDatosFuncionario(event.target.result);
                        mostrarMensaje(`Datos de ${nombre} importados correctamente`);
                        this.render('cuadrante-container');
                    } catch (error) {
                        mostrarMensaje(`Error al importar: ${error.message}`, 5000);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    /**
     * Exporta el cuadrante
     */
    exportar() {
        try {
            this.exportarCuadrante();
            mostrarMensaje('Cuadrante exportado correctamente');
        } catch (error) {
            mostrarMensaje(`Error al exportar: ${error.message}`, 5000);
        }
    }

    /**
     * Importa los turnos del usuario actual del cuadrante a su calendario personal
     * FUNCIÓN PREMIUM
     */
    async importarMisTurnos() {
        try {
            if (!window.userName) {
                mostrarMensaje('Error: No se pudo identificar el usuario actual', 5000);
                return;
            }

            // Buscar el usuario en el cuadrante
            const usuario = this.usuarios.find(u =>
                u.nombre.toLowerCase() === window.userName.toLowerCase()
            );

            if (!usuario) {
                mostrarMensaje(`No se encontraron datos para ${window.userName} en el cuadrante`, 5000);
                return;
            }

            if (!usuario.eventos || usuario.eventos.length === 0) {
                mostrarMensaje('No hay eventos para importar', 3000);
                return;
            }

            // Confirmar antes de importar
            const confirmar = confirm(
                `¿Deseas importar ${usuario.eventos.length} eventos del cuadrante a tu calendario personal?\n\n` +
                `Esto agregará todos tus turnos (guardias, libres, etc.) a tu vista personal.`
            );

            if (!confirmar) return;

            // Importar eventos al IndexedDB del usuario
            const { initIndexedDB, guardarDiaEnIndexedDB } = await import('./db.js');
            const db = await initIndexedDB();

            let importados = 0;
            for (const evento of usuario.eventos) {
                try {
                    // Si el evento tiene fechaInicio y fechaFin, importar cada día del rango
                    if (evento.fechaInicio && evento.fechaFin) {
                        const inicio = new Date(evento.fechaInicio);
                        const fin = new Date(evento.fechaFin);

                        for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
                            const fechaStr = d.toISOString().split('T')[0];
                            await guardarDiaEnIndexedDB(db, fechaStr, evento.tipo, evento.detalle || null);
                            importados++;
                        }
                    } else if (evento.fecha) {
                        // Evento de un solo día
                        await guardarDiaEnIndexedDB(db, evento.fecha, evento.tipo, evento.detalle || null);
                        importados++;
                    }
                } catch (error) {
                    console.error('Error al importar evento:', evento, error);
                }
            }

            mostrarMensaje(
                `✅ Importados ${importados} eventos a tu calendario personal.\n` +
                `Cambia a la pestaña "📅 Mi Calendario" para verlos.`,
                5000
            );

            // Recargar el calendario si está disponible
            if (window.renderCalendar) {
                setTimeout(() => window.renderCalendar(), 1000);
            }

        } catch (error) {
            console.error('Error al importar turnos:', error);
            mostrarMensaje(`Error al importar turnos: ${error.message}`, 5000);
        }
    }

    /**
     * Edita una celda del cuadrante (para actualizar desde despacho)
     */
    editarCelda(nombreUsuario, fecha) {
        const usuario = this.usuarios.find(u => u.nombre === nombreUsuario);
        if (!usuario) {
            mostrarMensaje('Usuario no encontrado', 3000);
            return;
        }

        // Buscar evento existente en esta fecha
        const eventoExistente = usuario.eventos.find(e => {
            if (e.fecha === fecha) return true;
            if (e.fechaInicio && e.fechaFin) {
                const fechaObj = new Date(fecha);
                const inicio = new Date(e.fechaInicio);
                const fin = new Date(e.fechaFin);
                return fechaObj >= inicio && fechaObj <= fin;
            }
            return false;
        });

        // Crear menú de opciones
        const opciones = [
            { tipo: 'guardia', icono: '🚨', nombre: 'Guardia' },
            { tipo: 'libre', icono: '🏖️', nombre: 'Libre' },
            { tipo: 'asunto', icono: '📋', nombre: 'Asunto Propio' },
            { tipo: 'vacaciones', icono: '✈️', nombre: 'Vacaciones' },
            { tipo: 'tarde', icono: '🌅', nombre: 'Tarde' },
            { tipo: 'mañana', icono: '🌄', nombre: 'Mañana' }
        ];

        let menu = '<div style="max-width: 300px;">';
        menu += `<h3 style="margin-bottom: 15px; color: var(--accent-color);">Editar: ${nombreUsuario} - ${fecha}</h3>`;

        if (eventoExistente) {
            menu += `<p style="margin-bottom: 15px; color: var(--text-secondary);">Evento actual: ${this.getIconoEvento(eventoExistente.tipo)} ${eventoExistente.tipo}</p>`;
        }

        opciones.forEach(opt => {
            menu += `<button class="btn btn-secondary" style="width: 100%; margin-bottom: 8px; text-align: left;"
                        onclick="window.cuadranteManager.setEvento('${nombreUsuario}', '${fecha}', '${opt.tipo}')">
                        ${opt.icono} ${opt.nombre}
                    </button>`;
        });

        if (eventoExistente) {
            menu += `<button class="btn btn-warning" style="width: 100%; margin-top: 10px;"
                        onclick="window.cuadranteManager.eliminarEvento('${nombreUsuario}', '${fecha}')">
                        ❌ Eliminar Evento
                    </button>`;
        }

        menu += '</div>';

        mostrarConfirmacion(menu, null, true);
    }

    /**
     * Establece un evento en una celda
     */
    setEvento(nombreUsuario, fecha, tipo) {
        const usuario = this.usuarios.find(u => u.nombre === nombreUsuario);
        if (!usuario) return;

        // Eliminar evento existente en esta fecha
        usuario.eventos = usuario.eventos.filter(e => {
            if (e.fecha === fecha) return false;
            if (e.fechaInicio && e.fechaFin) {
                const fechaObj = new Date(fecha);
                const inicio = new Date(e.fechaInicio);
                const fin = new Date(e.fechaFin);
                if (fechaObj >= inicio && fechaObj <= fin) return false;
            }
            return true;
        });

        // Añadir nuevo evento
        usuario.eventos.push({
            tipo: tipo,
            fecha: fecha
        });

        this.save();
        this.render('cuadrante-container');
        mostrarMensaje(`Evento "${tipo}" añadido para ${nombreUsuario}`, 2000);

        // Cerrar el menú
        const overlay = document.querySelector('.overlay-dialogo');
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }

    /**
     * Elimina un evento de una celda
     */
    eliminarEvento(nombreUsuario, fecha) {
        const usuario = this.usuarios.find(u => u.nombre === nombreUsuario);
        if (!usuario) return;

        usuario.eventos = usuario.eventos.filter(e => {
            if (e.fecha === fecha) return false;
            if (e.fechaInicio && e.fechaFin) {
                const fechaObj = new Date(fecha);
                const inicio = new Date(e.fechaInicio);
                const fin = new Date(e.fechaFin);
                if (fechaObj >= inicio && fechaObj <= fin) return false;
            }
            return true;
        });

        this.save();
        this.render('cuadrante-container');
        mostrarMensaje(`Evento eliminado para ${nombreUsuario}`, 2000);

        // Cerrar el menú
        const overlay = document.querySelector('.overlay-dialogo');
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }

    /**
     * Resetea el cuadrante
     */
    reset() {
        mostrarConfirmacion(
            '¿Estás seguro de que quieres resetear todo el cuadrante? Esta acción no se puede deshacer.',
            () => {
                this.usuarios = this.getDefaultUsuarios();
                this.save();
                this.render('cuadrante-container');
                mostrarMensaje('Cuadrante reseteado');
            }
        );
    }

    /**
     * Exporta el cuadrante completo (todos los usuarios y eventos)
     * Ideal para hacer backup o transferir entre dispositivos
     */
    exportarCuadranteCompleto() {
        const exportData = {
            version: '2.0',
            tipo: 'cuadrante_completo',
            fecha_exportacion: new Date().toISOString(),
            año_actual: this.currentYear,
            mes_actual: this.currentMonth + 1,
            usuarios: this.usuarios.map(u => ({
                id: u.id,
                nombre: u.nombre,
                placa: u.placa,
                color: u.color,
                eventos: u.eventos // Todos los eventos
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        const fecha = new Date().toISOString().split('T')[0];
        link.download = `cuadrante-completo-${fecha}.json`;
        link.click();

        URL.revokeObjectURL(url);
        mostrarMensaje('✅ Cuadrante exportado correctamente', 3000);
    }

    /**
     * Importa el cuadrante completo desde un archivo JSON o CSV
     * Reemplaza TODOS los datos actuales
     */
    importarCuadranteCompleto() {
        // Mostrar instrucciones primero
        const instrucciones = confirm(
            '📋 IMPORTANTE - Lee esto primero:\n\n' +
            '✅ Archivos aceptados: JSON o CSV\n\n' +
            '❌ Excel (.xls, .xlsx) NO se puede importar directamente\n\n' +
            '💡 Si tienes Excel:\n' +
            '1. Abre tu archivo Excel\n' +
            '2. Archivo → Guardar como\n' +
            '3. Tipo: CSV (delimitado por comas)\n' +
            '4. Guarda el archivo\n' +
            '5. Importa ese archivo CSV aquí\n\n' +
            '¿Continuar con la importación?'
        );

        if (!instrucciones) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv';
        input.multiple = false;

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                console.log('No file selected');
                return;
            }

            console.log('File selected:', file.name, file.type, file.size);
            mostrarMensaje('📂 Cargando archivo...', 2000);

            const fileName = file.name.toLowerCase();

            // Validar extensión
            if (!fileName.endsWith('.json') && !fileName.endsWith('.csv')) {
                alert(
                    '❌ Archivo no válido\n\n' +
                    'Solo se aceptan archivos .JSON o .CSV\n\n' +
                    'Si tienes Excel (.xls, .xlsx):\n' +
                    '1. Abre el archivo en Excel\n' +
                    '2. Archivo → Guardar como\n' +
                    '3. Tipo: CSV (delimitado por comas)\n' +
                    '4. Importa el archivo CSV'
                );
                return;
            }

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    let data;

                    // Detectar tipo de archivo
                    if (fileName.endsWith('.json')) {
                        data = JSON.parse(event.target.result);
                    } else if (fileName.endsWith('.csv')) {
                        data = this.parseCSVToCuadrante(event.target.result);
                    }

                    // Validar estructura
                    if (!data.usuarios || !Array.isArray(data.usuarios)) {
                        throw new Error('Archivo inválido: falta el array de usuarios');
                    }

                    if (data.usuarios.length !== MAX_USUARIOS) {
                        const continuar = confirm(
                            `⚠️ El archivo contiene ${data.usuarios.length} usuarios, ` +
                            `pero el sistema espera ${MAX_USUARIOS}.\n\n` +
                            '¿Deseas continuar de todos modos?'
                        );
                        if (!continuar) return;
                    }

                    // Importar datos
                    this.usuarios = data.usuarios.map((u, index) => ({
                        id: u.id || index + 1,
                        nombre: u.nombre || NOMBRES_EQUIPO[index] || `Usuario ${index + 1}`,
                        placa: u.placa || `AUTO-${u.nombre?.toUpperCase()}`,
                        color: u.color || this.getColorForUser(index),
                        eventos: Array.isArray(u.eventos) ? u.eventos : []
                    }));

                    // Guardar y actualizar
                    this.save();
                    this.render('cuadrante-container');

                    const totalEventos = this.usuarios.reduce((sum, u) => sum + u.eventos.length, 0);
                    mostrarMensaje(
                        `✅ Cuadrante importado correctamente\n\n` +
                        `${data.usuarios.length} usuarios cargados\n` +
                        `${totalEventos} eventos totales`,
                        5000
                    );

                } catch (error) {
                    console.error('Error al importar cuadrante:', error);
                    alert(
                        `❌ Error al importar el archivo:\n\n${error.message}\n\n` +
                        'Verifica que el archivo tenga el formato correcto.\n\n' +
                        'Para CSV: nombre,fecha,tipo\n' +
                        'Para JSON: usa la plantilla descargada'
                    );
                }
            };

            reader.onerror = () => {
                alert('❌ Error al leer el archivo. Por favor, intenta de nuevo.');
            };

            reader.readAsText(file);
        });

        input.click();
    }

    /**
     * Parsea un archivo CSV al formato de cuadrante
     */
    parseCSVToCuadrante(csvContent) {
        const lines = csvContent.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('El archivo CSV está vacío o no tiene datos');
        }

        // Primera línea: encabezados (nombre, fecha, tipo_evento)
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const nombreIndex = headers.indexOf('nombre');
        const fechaIndex = headers.indexOf('fecha');
        const tipoIndex = headers.indexOf('tipo') >= 0 ? headers.indexOf('tipo') : headers.indexOf('tipo_evento');

        if (nombreIndex === -1 || fechaIndex === -1 || tipoIndex === -1) {
            throw new Error('El CSV debe tener columnas: nombre, fecha, tipo (o tipo_evento)');
        }

        // Agrupar eventos por usuario
        const usuariosMap = new Map();

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim());
            const nombre = values[nombreIndex];
            const fecha = values[fechaIndex];
            const tipo = values[tipoIndex];

            if (!nombre || !fecha || !tipo) continue;

            if (!usuariosMap.has(nombre)) {
                usuariosMap.set(nombre, []);
            }

            usuariosMap.get(nombre).push({ tipo, fecha });
        }

        // Convertir a formato de usuarios
        const usuarios = NOMBRES_EQUIPO.map((nombre, index) => {
            const nombreLower = nombre.toLowerCase();
            let eventos = [];

            // Buscar eventos para este usuario (case insensitive)
            for (const [key, value] of usuariosMap.entries()) {
                if (key.toLowerCase() === nombreLower || key.toLowerCase().startsWith(nombreLower.substring(0, 4))) {
                    eventos = value;
                    break;
                }
            }

            return {
                id: index + 1,
                nombre: nombre,
                placa: `AUTO-${nombre.toUpperCase()}`,
                color: this.getColorForUser(index),
                eventos: eventos
            };
        });

        return { usuarios };
    }

    /**
     * Descarga una plantilla vacía del cuadrante para rellenar
     */
    descargarPlantilla() {
        const plantilla = {
            version: '2.0',
            tipo: 'cuadrante_completo',
            _instrucciones: 'Rellena los eventos para cada usuario. Formato de evento: {tipo: "guardia/libre/asunto/vacaciones/tarde/mañana", fecha: "YYYY-MM-DD"}',
            año_actual: new Date().getFullYear(),
            mes_actual: new Date().getMonth() + 1,
            usuarios: NOMBRES_EQUIPO.map((nombre, index) => ({
                id: index + 1,
                nombre: nombre,
                placa: `AUTO-${nombre.toUpperCase()}`,
                color: this.getColorForUser(index),
                eventos: [
                    // Ejemplo de evento
                    // { tipo: 'guardia', fecha: '2025-01-15' },
                    // { tipo: 'libre', fecha: '2025-01-16' }
                ]
            }))
        };

        const dataStr = JSON.stringify(plantilla, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla-cuadrante.json';
        link.click();

        URL.revokeObjectURL(url);
        mostrarMensaje('📋 Plantilla descargada. Edítala y luego usa "📥 Cargar Cuadrante"', 4000);
    }
}

// Exportar instancia global
let cuadranteManagerInstance = null;

export function getCuadranteManager() {
    if (!cuadranteManagerInstance) {
        cuadranteManagerInstance = new CuadranteManager();
    }
    return cuadranteManagerInstance;
}
