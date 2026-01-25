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
            <button class="btn btn-info btn-compact" onclick="window.cuadranteManager.importarMisTurnos()" title="Importar mis turnos del cuadrante a mi calendario personal">
                📲 Mis Turnos
            </button>
        `;

        // Botones para gestión del cuadrante completo (desde despacho) - más discretos
        const botonesGestionCompleta = `
            <button class="btn btn-secondary btn-compact" onclick="window.cuadranteManager.importarCuadranteCompleto()" title="Importar cuadrante completo desde archivo Excel/CSV/JSON">
                📥 Cargar
            </button>
            <button class="btn btn-secondary btn-compact" onclick="window.cuadranteManager.exportarCuadranteCompleto()" title="Descargar cuadrante completo a archivo JSON">
                📤 Guardar
            </button>
            <button class="btn btn-secondary btn-compact" onclick="window.cuadranteManager.descargarPlantilla()" title="Descargar plantilla vacía para rellenar">
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
            // Abreviación específica por nombre
            const nombreAbreviado = this.getAbreviacionNombre(usuario.nombre);
            html += `<tr>
                        <td class="user-name-cell" title="${usuario.nombre}">${nombreAbreviado}</td>`;

            // Celdas de días
            for (let day = 1; day <= daysInMonth; day++) {
                const fecha = new Date(this.currentYear, this.currentMonth, day);
                const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
                const claseWeekend = esFinDeSemana ? 'weekend-cell' : '';

                const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                let eventos = usuario.eventos.filter(e => {
                    if (e.fecha === dateStr) return true;
                    if (e.fechaInicio && e.fechaFin) {
                        const fecha = new Date(dateStr);
                        const inicio = new Date(e.fechaInicio);
                        const fin = new Date(e.fechaFin);
                        return fecha >= inicio && fecha <= fin;
                    }
                    return false;
                });

                // FILTRAR: En fines de semana solo mostrar guardias, vacaciones, libres y asuntos
                if (esFinDeSemana) {
                    eventos = eventos.filter(e => {
                        const tipo = e.tipo.toLowerCase();
                        return tipo === 'guardia' || tipo === 'vacaciones' || tipo === 'libre' || tipo === 'asunto';
                    });
                }

                const icono = eventos.length > 0 ? this.getIconoEvento(eventos[0].tipo) : '';
                const eventoTitles = eventos.map(e => e.tipo).join(', ');

                // Clase específica por tipo de evento
                const claseEvento = eventos.length > 0 ? `evento-${eventos[0].tipo}` : '';

                html += `<td class="event-cell ${claseWeekend} ${claseEvento}"
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
     * Obtiene la letra/código de un tipo de evento
     */
    getIconoEvento(tipo) {
        const letras = {
            'guardia': 'G',
            'libre': 'L',
            'asunto': 'A',
            'vacaciones': 'Vc',
            'tarde': 'T',
            'mañana': 'M'
        };
        return letras[tipo] || '';
    }

    /**
     * Obtiene abreviación específica por nombre
     */
    getAbreviacionNombre(nombre) {
        const abreviaciones = {
            'Tesa': 'Tesa',
            'Paco': 'Paco',
            'Mario': 'Mrio',
            'Rafa': 'Rafa',
            'Reinoso': 'Rnso',
            'Nuria': 'Nria',
            'Juan': 'Juan',
            'Carmen': 'Cmen'
        };
        return abreviaciones[nombre] || nombre.substring(0, 4);
    }

    /**
     * Genera HTML de estadísticas - solo muestra estado HOY (más útil)
     */
    generateStatsHTML() {
        const stats = this.calculateStats();
        const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

        return `
            <div class="cuadrante-stats">
                <div class="stat-card-small">
                    <span class="stat-label">🚨 Guardias hoy (${hoy})</span>
                    <span class="stat-number">${stats.guardiasActivas}</span>
                </div>
                <div class="stat-card-small">
                    <span class="stat-label">✅ Disponibles</span>
                    <span class="stat-number">${stats.disponibles}</span>
                </div>
                <div class="stat-card-small">
                    <span class="stat-label">✈️ Vacaciones</span>
                    <span class="stat-number">${stats.vacaciones}</span>
                </div>
            </div>
        `;
    }

    /**
     * Calcula estadísticas del cuadrante (filtra eventos inválidos en fines de semana)
     */
    calculateStats() {
        const today = new Date().toISOString().split('T')[0];
        const hoy = new Date(today);
        const esFinDeSemanaHoy = hoy.getDay() === 0 || hoy.getDay() === 6;

        let guardiasActivas = 0;
        let vacaciones = 0;
        let totalEventos = 0;

        this.usuarios.forEach(usuario => {
            let eventosHoy = usuario.eventos.filter(e => {
                if (e.fecha === today) return true;
                if (e.fechaInicio && e.fechaFin) {
                    const fecha = new Date(today);
                    const inicio = new Date(e.fechaInicio);
                    const fin = new Date(e.fechaFin);
                    return fecha >= inicio && fecha <= fin;
                }
                return false;
            });

            // Filtrar mañana/tarde si hoy es fin de semana
            if (esFinDeSemanaHoy) {
                eventosHoy = eventosHoy.filter(e => {
                    const tipo = e.tipo.toLowerCase();
                    return tipo === 'guardia' || tipo === 'vacaciones' || tipo === 'libre' || tipo === 'asunto';
                });
            }

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
     * Importa el cuadrante completo desde un archivo JSON, CSV o Excel
     * Reemplaza TODOS los datos actuales
     */
    importarCuadranteCompleto() {
        const confirmar = confirm(
            '⚠️ IMPORTANTE:\n\n' +
            'Esto reemplazará TODO el cuadrante actual.\n\n' +
            '✅ Formatos aceptados:\n' +
            '  • Excel (.xls, .xlsx)\n' +
            '  • CSV (.csv)\n' +
            '  • JSON (.json)\n\n' +
            '¿Continuar?'
        );

        if (!confirmar) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv,.xls,.xlsx';
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

            // Detectar si es Excel
            if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
                // Leer como binario para Excel
                const reader = new FileReader();

                reader.onload = (event) => {
                    try {
                        // Usar SheetJS para leer Excel
                        const data = new Uint8Array(event.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });

                        // Parsear Excel a formato de cuadrante
                        const resultado = this.parseExcelToCuadrante(workbook);
                        this.procesarDatosImportados(resultado);

                    } catch (error) {
                        console.error('Error al importar Excel:', error);
                        alert(`❌ Error al importar Excel:\n\n${error.message}`);
                    }
                };

                reader.onerror = () => {
                    alert('❌ Error al leer el archivo Excel.');
                };

                reader.readAsArrayBuffer(file);

            } else {
                // Leer como texto para JSON/CSV
                const reader = new FileReader();

                reader.onload = (event) => {
                    try {
                        let data;

                        // Detectar tipo de archivo
                        if (fileName.endsWith('.json')) {
                            data = JSON.parse(event.target.result);
                        } else if (fileName.endsWith('.csv')) {
                            data = this.parseCSVToCuadrante(event.target.result);
                        } else {
                            throw new Error('Formato de archivo no reconocido');
                        }

                        this.procesarDatosImportados(data);

                    } catch (error) {
                        console.error('Error al importar archivo:', error);
                        alert(`❌ Error al importar:\n\n${error.message}`);
                    }
                };

                reader.onerror = () => {
                    alert('❌ Error al leer el archivo.');
                };

                reader.readAsText(file);
            }
        });

        input.click();
    }

    /**
     * Procesa los datos importados y actualiza el cuadrante
     */
    procesarDatosImportados(data) {
        try {
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
                'Para JSON: usa la plantilla descargada\n' +
                'Para Excel: usa el mismo formato con columnas nombre, fecha, tipo'
            );
        }
    }

    /**
     * Parsea un archivo Excel al formato de cuadrante
     * Detecta automáticamente formato simple o bloques mensuales
     */
    parseExcelToCuadrante(workbook) {
        try {
            console.log('Parseando Excel, hojas disponibles:', workbook.SheetNames);

            // Obtener la primera hoja
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            console.log('Procesando hoja:', sheetName);

            // Convertir hoja a JSON (array de arrays)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            if (jsonData.length < 2) {
                throw new Error('El archivo Excel está vacío o solo tiene encabezados');
            }

            // Detectar formato: simple vs bloques mensuales
            const primeraFila = jsonData[0].map(h => String(h).trim().toUpperCase());
            const esFormatoSimple = primeraFila.some(h => h.includes('NOMBRE')) &&
                                    primeraFila.some(h => h.includes('FECHA')) &&
                                    primeraFila.some(h => h.includes('TIPO'));

            if (esFormatoSimple) {
                console.log('Detectado formato Excel simple (nombre,fecha,tipo)');
                return this.parseExcelSimple(jsonData);
            } else {
                console.log('Detectado formato Excel con bloques mensuales');
                return this.parseExcelBloquesMensuales(jsonData);
            }

        } catch (error) {
            console.error('Error parseando Excel:', error);
            throw new Error(`Error al parsear Excel: ${error.message}`);
        }
    }

    /**
     * Parser para Excel formato bloques mensuales horizontales
     */
    parseExcelBloquesMensuales(jsonData) {
        // Mapeo de códigos a tipos de eventos
        const codigoMap = {
            'V': 'vacaciones',
            'VV': 'vacaciones',
            'VAC': 'vacaciones',
            'M': 'mañana',
            'T': 'tarde',
            'AP': 'asunto',
            'CH': 'libre',          // Compensación de horas
            'C': 'asunto',          // Curso
            'CU': 'asunto',         // Curso
            'CUR': 'asunto',        // Curso
            'LS': 'libre',
            'INC': 'guardia',       // Incidencia/Guardia
            'INC.': 'guardia',
            'B': 'guardia',
            'XX': 'guardia',
            'P': 'asunto',          // Permiso
            'TD': 'guardia'
        };

        // Normalizar nombres
        const nombresValidos = {
            'TESA': 'Tesa',
            'PACO': 'Paco',
            'MARIO': 'Mario',
            'RAFAEL': 'Rafa',
            'RAFA': 'Rafa',
            'REINOSO': 'Reinoso',
            'NURIA': 'Nuria',
            'JUAN': 'Juan',
            'CARMEN': 'Carmen',
            'Mª CARMEN': 'Carmen',
            'M CARMEN': 'Carmen',
            'MA CARMEN': 'Carmen'
        };

        const meses = {
            'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3,
            'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7,
            'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
        };

        const usuariosMap = new Map();
        let añoActual = new Date().getFullYear();
        let mesActual = null;
        let lineasProcesadas = 0;

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            // Limitar a 33 columnas (A-AG)
            const cells = row.slice(0, 33).map(c => String(c || '').trim());
            const primeraCelda = cells[0].toUpperCase().replace(/\s+/g, '');

            // Detectar año
            if (primeraCelda.match(/^20\d{2}$/)) {
                añoActual = parseInt(primeraCelda);
                console.log('Año detectado:', añoActual);
                continue;
            }

            // Detectar mes
            const mesLimpio = primeraCelda.replace(/\s/g, '');
            if (meses.hasOwnProperty(mesLimpio)) {
                mesActual = meses[mesLimpio];
                console.log(`Mes detectado: ${mesLimpio} -> ${añoActual}-${String(mesActual + 1).padStart(2, '0')}`);
                continue;
            }

            // Detectar fila de números de día
            if (cells[1] === '1' && cells[2] === '2') {
                continue;
            }

            // Detectar fila de días de semana Y determinar año automáticamente
            const segundaCelda = cells[1]?.toUpperCase();
            if (segundaCelda && segundaCelda.match(/^[LMXJVSD]$/)) {
                // Si es ENERO, detectar el año por el día de la semana del día 1
                if (mesActual === 0) {  // Enero
                    const diaSemanaEnero1 = segundaCelda;
                    // Enero 1, 2025 = X (Miércoles)
                    // Enero 1, 2026 = J (Jueves)
                    // Enero 1, 2027 = V (Viernes)
                    if (diaSemanaEnero1 === 'X') {
                        añoActual = 2025;
                        console.log('⚙️ Año auto-detectado por día de semana: 2025');
                    } else if (diaSemanaEnero1 === 'J') {
                        añoActual = 2026;
                        console.log('⚙️ Año auto-detectado por día de semana: 2026');
                    } else if (diaSemanaEnero1 === 'V') {
                        añoActual = 2027;
                        console.log('⚙️ Año auto-detectado por día de semana: 2027');
                    } else if (diaSemanaEnero1 === 'S') {
                        añoActual = 2028;
                        console.log('⚙️ Año auto-detectado por día de semana: 2028');
                    }
                }
                continue;
            }

            // Fila de persona
            const nombreRaw = cells[0].toUpperCase().trim().replace(/\s+/g, ' ');

            let nombreNormalizado = null;
            for (const [key, value] of Object.entries(nombresValidos)) {
                if (nombreRaw === key || nombreRaw.includes(key) || key.includes(nombreRaw)) {
                    nombreNormalizado = value;
                    break;
                }
            }

            if (!nombreNormalizado || mesActual === null) continue;

            if (!usuariosMap.has(nombreNormalizado)) {
                usuariosMap.set(nombreNormalizado, []);
            }

            // DEBUG: Log para diagnóstico
            console.log(`📋 Procesando fila ${i}: ${nombreNormalizado} en ${añoActual}-${String(mesActual + 1).padStart(2, '0')}`);
            console.log(`   Primeras 10 celdas:`, cells.slice(0, 11));

            // Procesar eventos de cada día
            for (let dia = 1; dia <= 31; dia++) {
                const cellIndex = dia;
                let codigo = cells[cellIndex]?.trim().toUpperCase();

                if (!codigo || codigo === '' || codigo === '-') continue;

                codigo = codigo.replace(/\s+/g, '');

                // Verificar validez del día
                const fecha = new Date(añoActual, mesActual, dia);
                if (fecha.getMonth() !== mesActual) continue;

                // Mapear código
                let tipo = codigoMap[codigo];

                if (!tipo) {
                    if (codigo.includes('VAC') || codigo.includes('VV')) {
                        tipo = 'vacaciones';
                    } else if (codigo === 'M' || codigo.includes('MAN')) {
                        tipo = 'mañana';
                    } else if (codigo === 'T' || codigo.includes('TARD')) {
                        tipo = 'tarde';
                    } else if (codigo.includes('AP') || codigo.includes('ASUNT')) {
                        tipo = 'asunto';
                    } else if (codigo.includes('CH') || codigo.includes('L')) {
                        tipo = 'libre';
                    } else {
                        console.log(`Código desconocido '${codigo}' para ${nombreNormalizado} el ${dia}/${mesActual+1}/${añoActual}`);
                        continue;
                    }
                }

                const fechaStr = `${añoActual}-${String(mesActual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

                usuariosMap.get(nombreNormalizado).push({
                    tipo: tipo,
                    fecha: fechaStr
                });

                lineasProcesadas++;
            }
        }

        console.log(`Excel de bloques procesado: ${lineasProcesadas} eventos de ${usuariosMap.size} usuarios`);

        if (lineasProcesadas === 0) {
            throw new Error(
                'No se pudo procesar ningún evento del Excel.\n\n' +
                'Verifica que el archivo tenga bloques mensuales con nombres válidos.'
            );
        }

        const usuarios = NOMBRES_EQUIPO.map((nombre, index) => {
            const eventos = usuariosMap.get(nombre) || [];
            console.log(`Eventos cargados para ${nombre}:`, eventos.length);

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
     * Parser para Excel formato simple (nombre,fecha,tipo)
     */
    parseExcelSimple(jsonData) {
        // Primera fila: encabezados
        const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
        console.log('Excel headers:', headers);

        // Buscar columnas de manera flexible
        let nombreIndex = -1;
        let fechaIndex = -1;
        let tipoIndex = -1;

        headers.forEach((h, index) => {
            if (h.includes('nombre') || h === 'name' || h === 'usuario') nombreIndex = index;
            if (h.includes('fecha') || h === 'date' || h === 'dia') fechaIndex = index;
            if (h.includes('tipo') || h === 'type' || h === 'evento') tipoIndex = index;
        });

        console.log('Column indices:', { nombreIndex, fechaIndex, tipoIndex });

            if (nombreIndex === -1 || fechaIndex === -1 || tipoIndex === -1) {
                throw new Error(
                    `No se encontraron las columnas necesarias.\n\n` +
                    `Encabezados encontrados: ${headers.join(', ')}\n\n` +
                    `Se necesitan columnas que contengan:\n` +
                    `- "nombre" (nombre del usuario)\n` +
                    `- "fecha" (fecha del evento)\n` +
                    `- "tipo" (tipo de evento)`
                );
            }

            // Agrupar eventos por usuario
            const usuariosMap = new Map();
            let lineasProcesadas = 0;
            let lineasConError = 0;

            // Procesar filas de datos (empezando desde índice 1, después de los encabezados)
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;

                try {
                    let nombre = String(row[nombreIndex] || '').trim();
                    let fecha = String(row[fechaIndex] || '').trim();
                    let tipo = String(row[tipoIndex] || '').trim().toLowerCase();

                    // Si la fecha es un número (Excel serial date), convertirla
                    if (!isNaN(fecha) && fecha !== '') {
                        const excelDate = XLSX.SSF.parse_date_code(parseFloat(fecha));
                        fecha = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
                    }

                    // Si la fecha tiene otro formato, intentar normalizarla
                    if (fecha.includes('/')) {
                        // Formato DD/MM/YYYY o DD/MM/YY
                        const parts = fecha.split('/');
                        if (parts.length === 3) {
                            let [d, m, y] = parts;
                            if (y.length === 2) y = '20' + y; // Asumir 20xx
                            fecha = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                        }
                    }

                    if (!nombre || !fecha || !tipo) {
                        console.warn(`Fila ${i + 1} incompleta:`, { nombre, fecha, tipo });
                        lineasConError++;
                        continue;
                    }

                    // Validar formato de fecha básico
                    if (!fecha.match(/\d{4}-\d{2}-\d{2}/)) {
                        console.warn(`Fila ${i + 1}: formato de fecha inválido:`, fecha);
                        lineasConError++;
                        continue;
                    }

                    if (!usuariosMap.has(nombre)) {
                        usuariosMap.set(nombre, []);
                    }

                    usuariosMap.get(nombre).push({ tipo, fecha });
                    lineasProcesadas++;

                } catch (error) {
                    console.error(`Error en fila ${i + 1}:`, error);
                    lineasConError++;
                }
            }

            console.log(`Excel procesado: ${lineasProcesadas} eventos, ${lineasConError} filas con error`);

            if (lineasProcesadas === 0) {
                throw new Error(
                    'No se pudo procesar ningún evento del Excel.\n\n' +
                    'Verifica que:\n' +
                    '- Las fechas estén en formato válido (YYYY-MM-DD o DD/MM/YYYY)\n' +
                    '- Los nombres coincidan con: ' + NOMBRES_EQUIPO.join(', ') + '\n' +
                    '- Los tipos sean: guardia, libre, asunto, vacaciones, tarde, mañana'
                );
            }

            // Convertir a formato de usuarios (igual que CSV)
            const usuarios = NOMBRES_EQUIPO.map((nombre, index) => {
                const nombreLower = nombre.toLowerCase();
                let eventos = [];

                // Buscar eventos para este usuario (case insensitive, match parcial)
                for (const [key, value] of usuariosMap.entries()) {
                    const keyLower = key.toLowerCase();
                    if (keyLower === nombreLower ||
                        keyLower.startsWith(nombreLower.substring(0, 4)) ||
                        nombreLower.startsWith(keyLower.substring(0, 4))) {
                        eventos = value;
                        console.log(`Eventos para ${nombre}:`, eventos.length);
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
     * Parsea un archivo CSV al formato de cuadrante
     * Detecta automáticamente formato simple o bloques mensuales
     */
    parseCSVToCuadrante(csvContent) {
        // Limpiar BOM (Byte Order Mark) que Excel añade
        csvContent = csvContent.replace(/^\uFEFF/, '');

        // Detectar separador (coma, punto y coma, o tabulador)
        let separator = ',';
        const firstLine = csvContent.split('\n')[0];
        if (firstLine.includes(';')) separator = ';';
        else if (firstLine.includes('\t')) separator = '\t';

        console.log('CSV separator detected:', separator === ',' ? 'coma' : separator === ';' ? 'punto y coma' : 'tabulador');

        // Dividir en líneas
        const lines = csvContent.split('\n');
        if (lines.length < 2) {
            throw new Error('El archivo CSV está vacío');
        }

        // Detectar formato: simple (nombre,fecha,tipo) vs bloques mensuales
        const primeraLinea = lines[0].split(separator).map(v => v.trim().toUpperCase());
        const esFormatoSimple = primeraLinea.some(h => h.includes('NOMBRE')) &&
                                primeraLinea.some(h => h.includes('FECHA')) &&
                                primeraLinea.some(h => h.includes('TIPO'));

        if (esFormatoSimple) {
            console.log('Detectado formato CSV simple (nombre,fecha,tipo)');
            return this.parseCSVSimple(csvContent, separator, lines);
        } else {
            console.log('Detectado formato de bloques mensuales horizontales');
            return this.parseCSVBloquesMensuales(csvContent, separator, lines);
        }
    }

    /**
     * Parser para formato de bloques mensuales horizontales
     * Cada bloque tiene: mes, días 1-31, días semana, personas con eventos
     */
    parseCSVBloquesMensuales(csvContent, separator, lines) {
        // Mapeo de códigos a tipos de eventos
        const codigoMap = {
            'V': 'vacaciones',
            'VV': 'vacaciones',
            'VAC': 'vacaciones',
            'M': 'mañana',
            'T': 'tarde',
            'AP': 'asunto',
            'CH': 'libre',          // Compensación de horas
            'C': 'asunto',          // Curso
            'CU': 'asunto',         // Curso
            'CUR': 'asunto',        // Curso
            'LS': 'libre',
            'INC': 'guardia',       // Incidencia/Guardia
            'INC.': 'guardia',
            'B': 'guardia',
            'XX': 'guardia',
            'P': 'asunto',          // Permiso
            'TD': 'guardia'
        };

        // Normalizar nombres del CSV a nombres del sistema
        const nombresValidos = {
            'TESA': 'Tesa',
            'PACO': 'Paco',
            'MARIO': 'Mario',
            'RAFAEL': 'Rafa',
            'RAFA': 'Rafa',
            'REINOSO': 'Reinoso',
            'NURIA': 'Nuria',
            'JUAN': 'Juan',
            'CARMEN': 'Carmen',
            'Mª CARMEN': 'Carmen',
            'M CARMEN': 'Carmen',
            'MA CARMEN': 'Carmen'
        };

        // Meses en español
        const meses = {
            'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3,
            'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7,
            'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
        };

        const usuariosMap = new Map();
        let añoActual = new Date().getFullYear();
        let mesActual = null;
        let lineasProcesadas = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line || line.trim().length === 0) continue;

            // Limitar a las primeras 33 columnas (A-AG) y eliminar columnas vacías de Excel
            const cells = line.split(separator).slice(0, 33).map(c => c.trim());
            const primeraCelda = cells[0].toUpperCase().replace(/\s+/g, '');

            // Detectar año (formato 2024, 2025, etc.)
            if (primeraCelda.match(/^20\d{2}$/)) {
                añoActual = parseInt(primeraCelda);
                console.log('Año detectado:', añoActual);
                continue;
            }

            // Detectar mes (puede venir con espacios: "E N E R O")
            const mesLimpio = primeraCelda.replace(/\s/g, '');
            if (meses.hasOwnProperty(mesLimpio)) {
                mesActual = meses[mesLimpio];
                console.log(`Mes detectado: ${mesLimpio} -> ${añoActual}-${String(mesActual + 1).padStart(2, '0')}`);
                continue;
            }

            // Detectar fila de números de día (1, 2, 3, ..., 31)
            if (cells[1] === '1' && cells[2] === '2') {
                continue;
            }

            // Detectar fila de letras de día de semana Y determinar año automáticamente
            const segundaCelda = cells[1]?.toUpperCase();
            if (segundaCelda && segundaCelda.match(/^[LMXJVSD]$/)) {
                // Si es ENERO, detectar el año por el día de la semana del día 1
                if (mesActual === 0) {  // Enero
                    const diaSemanaEnero1 = segundaCelda;
                    // Enero 1, 2025 = X (Miércoles)
                    // Enero 1, 2026 = J (Jueves)
                    // Enero 1, 2027 = V (Viernes)
                    if (diaSemanaEnero1 === 'X') {
                        añoActual = 2025;
                        console.log('⚙️ CSV: Año auto-detectado por día de semana: 2025');
                    } else if (diaSemanaEnero1 === 'J') {
                        añoActual = 2026;
                        console.log('⚙️ CSV: Año auto-detectado por día de semana: 2026');
                    } else if (diaSemanaEnero1 === 'V') {
                        añoActual = 2027;
                        console.log('⚙️ CSV: Año auto-detectado por día de semana: 2027');
                    } else if (diaSemanaEnero1 === 'S') {
                        añoActual = 2028;
                        console.log('⚙️ CSV: Año auto-detectado por día de semana: 2028');
                    }
                }
                continue;
            }

            // Fila de persona - buscar nombre en la columna A
            const nombreRaw = cells[0].toUpperCase().trim().replace(/\s+/g, ' ');

            // Buscar coincidencia de nombre
            let nombreNormalizado = null;
            for (const [key, value] of Object.entries(nombresValidos)) {
                if (nombreRaw === key || nombreRaw.includes(key) || key.includes(nombreRaw)) {
                    nombreNormalizado = value;
                    break;
                }
            }

            if (!nombreNormalizado || mesActual === null) continue;

            // Inicializar array de eventos para este usuario
            if (!usuariosMap.has(nombreNormalizado)) {
                usuariosMap.set(nombreNormalizado, []);
            }

            // DEBUG: Log para diagnóstico (CSV)
            console.log(`📋 CSV Fila ${i}: ${nombreNormalizado} en ${añoActual}-${String(mesActual + 1).padStart(2, '0')}`);
            console.log(`   Primeras 10 celdas:`, cells.slice(0, 11));

            // Procesar eventos de cada día (columnas 1-31, índices 1-31 del array)
            for (let dia = 1; dia <= 31; dia++) {
                const cellIndex = dia; // Columna B=índice 1, C=2, etc.
                let codigo = cells[cellIndex]?.trim().toUpperCase();

                if (!codigo || codigo === '' || codigo === '-') continue;

                // Normalizar espacios y quitar caracteres raros
                codigo = codigo.replace(/\s+/g, '');

                // Verificar que el día es válido para este mes
                const fecha = new Date(añoActual, mesActual, dia);
                if (fecha.getMonth() !== mesActual) continue; // Día no existe en este mes

                // Mapear código a tipo de evento
                let tipo = codigoMap[codigo];

                // Si no está en el mapa directo, intentar detectar por patrón
                if (!tipo) {
                    if (codigo.includes('VAC') || codigo.includes('VV')) {
                        tipo = 'vacaciones';
                    } else if (codigo === 'M' || codigo.includes('MAN')) {
                        tipo = 'mañana';
                    } else if (codigo === 'T' || codigo.includes('TARD')) {
                        tipo = 'tarde';
                    } else if (codigo.includes('AP') || codigo.includes('ASUNT')) {
                        tipo = 'asunto';
                    } else if (codigo.includes('CH') || codigo.includes('L')) {
                        tipo = 'libre';
                    } else {
                        // Código desconocido - registrar como guardia por defecto
                        console.log(`Código desconocido '${codigo}' para ${nombreNormalizado} el ${dia}/${mesActual+1}/${añoActual}`);
                        continue; // Ignorar códigos desconocidos
                    }
                }

                const fechaStr = `${añoActual}-${String(mesActual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

                usuariosMap.get(nombreNormalizado).push({
                    tipo: tipo,
                    fecha: fechaStr
                });

                lineasProcesadas++;
            }
        }

        console.log(`CSV de bloques procesado: ${lineasProcesadas} eventos de ${usuariosMap.size} usuarios`);

        if (lineasProcesadas === 0) {
            throw new Error(
                'No se pudo procesar ningún evento del CSV.\n\n' +
                'Verifica que el archivo tenga bloques mensuales con nombres válidos.'
            );
        }

        // Convertir a formato de usuarios
        const usuarios = NOMBRES_EQUIPO.map((nombre, index) => {
            const eventos = usuariosMap.get(nombre) || [];
            console.log(`Eventos cargados para ${nombre}:`, eventos.length);

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
     * Parser para CSV formato simple (nombre,fecha,tipo)
     */
    parseCSVSimple(csvContent, separator, lines) {
        const cleanedLines = lines.map(line => line.trim()).filter(line => line.length > 0);

        if (cleanedLines.length < 2) {
            throw new Error('El archivo CSV está vacío o solo tiene encabezados');
        }

        // Primera línea: encabezados
        const headerLine = cleanedLines[0];
        const headers = headerLine.split(separator)
            .map(h => h.trim().toLowerCase().replace(/["']/g, ''));

        console.log('CSV headers:', headers);

        // Buscar columnas de manera flexible
        let nombreIndex = -1;
        let fechaIndex = -1;
        let tipoIndex = -1;

        headers.forEach((h, index) => {
            if (h.includes('nombre') || h === 'name' || h === 'usuario') nombreIndex = index;
            if (h.includes('fecha') || h === 'date' || h === 'dia') fechaIndex = index;
            if (h.includes('tipo') || h === 'type' || h === 'evento') tipoIndex = index;
        });

        console.log('Column indices:', { nombreIndex, fechaIndex, tipoIndex });

        if (nombreIndex === -1 || fechaIndex === -1 || tipoIndex === -1) {
            throw new Error(
                `No se encontraron las columnas necesarias.\n\n` +
                `Encabezados encontrados: ${headers.join(', ')}\n\n` +
                `Se necesitan columnas que contengan:\n` +
                `- "nombre" (nombre del usuario)\n` +
                `- "fecha" (fecha del evento)\n` +
                `- "tipo" (tipo de evento)`
            );
        }

        // Agrupar eventos por usuario
        const usuariosMap = new Map();
        let lineasProcesadas = 0;
        let lineasConError = 0;

        for (let i = 1; i < cleanedLines.length; i++) {
            const line = cleanedLines[i].trim();
            if (!line) continue;

            try {
                // Dividir por separador y limpiar comillas
                const values = line.split(separator)
                    .map(v => v.trim().replace(/^["']|["']$/g, ''));

                const nombre = values[nombreIndex]?.trim();
                const fecha = values[fechaIndex]?.trim();
                const tipo = values[tipoIndex]?.trim().toLowerCase();

                if (!nombre || !fecha || !tipo) {
                    console.warn(`Línea ${i + 1} incompleta:`, { nombre, fecha, tipo });
                    lineasConError++;
                    continue;
                }

                // Validar formato de fecha básico
                if (!fecha.match(/\d{4}-\d{2}-\d{2}/)) {
                    console.warn(`Línea ${i + 1}: formato de fecha inválido:`, fecha);
                    lineasConError++;
                    continue;
                }

                if (!usuariosMap.has(nombre)) {
                    usuariosMap.set(nombre, []);
                }

                usuariosMap.get(nombre).push({ tipo, fecha });
                lineasProcesadas++;

            } catch (error) {
                console.error(`Error en línea ${i + 1}:`, error);
                lineasConError++;
            }
        }

        console.log(`CSV simple procesado: ${lineasProcesadas} eventos, ${lineasConError} líneas con error`);

        if (lineasProcesadas === 0) {
            throw new Error(
                'No se pudo procesar ningún evento del CSV.\n\n' +
                'Verifica que:\n' +
                '- Las fechas estén en formato: YYYY-MM-DD (ej: 2025-01-15)\n' +
                '- Los nombres coincidan con: ' + NOMBRES_EQUIPO.join(', ') + '\n' +
                '- Los tipos sean: guardia, libre, asunto, vacaciones, tarde, mañana'
            );
        }

        // Convertir a formato de usuarios
        const usuarios = NOMBRES_EQUIPO.map((nombre, index) => {
            const nombreLower = nombre.toLowerCase();
            let eventos = [];

            // Buscar eventos para este usuario (case insensitive, match parcial)
            for (const [key, value] of usuariosMap.entries()) {
                const keyLower = key.toLowerCase();
                if (keyLower === nombreLower ||
                    keyLower.startsWith(nombreLower.substring(0, 4)) ||
                    nombreLower.startsWith(keyLower.substring(0, 4))) {
                    eventos = value;
                    console.log(`Eventos para ${nombre}:`, eventos.length);
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
