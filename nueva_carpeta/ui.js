// Función para resetear el calendario visualmente
function resetCalendar() {
    const allDays = document.querySelectorAll('.day');
    allDays.forEach(day => {
        day.classList.remove('guardia', 'proxima-guardia', 'asunto', 'libre', 'vacaciones');
        day.style = '';
        const labels = day.querySelectorAll('.tarde-label, .mañana-label, .otros-eventos-label');
        labels.forEach(label => label.remove());
    });

    registroLibrados.length = 0;
    updateRegistroLibrados();
    saveRegistroLibradosToIndexedDB();
}

// Función para alternar el menú de contadores
function toggleCounterMenu() {
    const counterMenu = document.getElementById('counter-menu');
    counterMenu.style.display = counterMenu.style.display === 'block' ? 'none' : 'block';
}

// Función para alternar el menú de configuración
function toggleConfigMenu() {
    const configMenu = document.getElementById('config-menu');
    configMenu.style.display = configMenu.style.display === 'block' ? 'none' : 'block';
}

// Función para actualizar los contadores visualmente
function updateCounter() {
    document.getElementById('counter').innerText = daysLibres;
    document.getElementById('asunto-counter').innerText = asuntosPropios;
    document.getElementById('libres-gastados').innerText = libresGastados;
    document.getElementById('vacaciones-counter').innerText = diasVacaciones;

    guardarConfiguracionEnIndexedDB('daysLibres', daysLibres);
    guardarConfiguracionEnIndexedDB('asuntosPropios', asuntosPropios);
    guardarConfiguracionEnIndexedDB('libresGastados', libresGastados);
    guardarConfiguracionEnIndexedDB('diasVacaciones', diasVacaciones);

    updateRegistroLibrados();
}

// Función para actualizar el registro librados visualmente
function updateRegistroLibrados() {
    const registroContainer = document.getElementById('registro-librados');
    registroContainer.innerHTML = '';

    registroLibrados.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'registro-entry';
        entryDiv.innerText = `${entry.fecha}: ${entry.texto}`;
        registroContainer.appendChild(entryDiv);
    });
}

// Función para mostrar un diálogo con un mensaje
function mostrarDialogo(mensaje, callback) {
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

// Función para generar el calendario del año
function generateYearCalendar(year) {
    const yearCalendar = document.getElementById(`year-calendar-${year}`);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; 

    months.forEach((month, monthIndex) => {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'month';

        const monthName = document.createElement('div');
        monthName.className = 'month-name';
        monthName.innerText = `${months[monthIndex]} ${year}`;
        monthDiv.appendChild(monthName);

        const calendarContainer = document.createElement('div');
        calendarContainer.className = 'calendar-container';

        const calendar = document.createElement('div');
        calendar.className = 'calendar';

        weekdays.forEach(day => {
            const weekdayDiv = document.createElement('div');
            weekdayDiv.className = 'weekday';
            weekdayDiv.innerText = day;
            calendar.appendChild(weekdayDiv);
        });

        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const firstDay = (new Date(year, monthIndex, 1).getDay() + 6) % 7;

        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day empty';
            calendar.appendChild(emptyDay);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day';
            dayDiv.innerText = i;
            dayDiv.onclick = (event) => showDropdownMenu(event, dayDiv, monthIndex, i);
            dayDiv.dataset.date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, monthIndex, i).getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                dayDiv.classList.add('weekend');
            }
            calendar.appendChild(dayDiv);
        }

        calendarContainer.appendChild(calendar);
        monthDiv.appendChild(calendarContainer);
        yearCalendar.appendChild(monthDiv);
    });
}

// Función para mostrar un menú desplegable
function showDropdownMenu(event, dayElement, monthIndex, dayNumber)
console.log(`Menú desplegado para el día: ${dayElement.dataset.date}`);
    // Código del menú emergente...
}    
{
    closeAllDropdowns();

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';

    const guardiaButton = document.createElement('button');
    guardiaButton.innerText = 'Guardia';
    guardiaButton.onclick = () => {
        markWeekAsGuardia(dayElement, monthIndex);
        closeAllDropdowns();
    };
    dropdown.appendChild(guardiaButton);

    const proximaGuardiaButton = document.createElement('button');
    proximaGuardiaButton.innerText = 'Próx. Guardia';
    proximaGuardiaButton.onclick = () => {
        markProximaGuardia(dayElement, monthIndex);
        closeAllDropdowns();
    };
    dropdown.appendChild(proximaGuardiaButton);

    const pedirDiasButton = document.createElement('button');
    pedirDiasButton.innerText = 'Pedir Días';
    pedirDiasButton.onclick = () => {
        solicitarDiasGuardia(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(pedirDiasButton);

    const asuntoButton = document.createElement('button');
    asuntoButton.innerText = 'A. Propio';
    asuntoButton.onclick = () => {
        markAsuntoPropio(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(asuntoButton);

    const vacacionesButton = document.createElement('button');
    vacacionesButton.innerText = 'Vacaciones';
    vacacionesButton.onclick = () => {
        startVacaciones(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(vacacionesButton);

    const tardeButton = document.createElement('button');
    tardeButton.innerText = 'Tarde';
    tardeButton.onclick = () => {
        markTarde(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(tardeButton);

    const otrosEventosButton = document.createElement('button');
    otrosEventosButton.innerText = 'Otros';
    otrosEventosButton.onclick = () => {
        markOtrosEventos(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(otrosEventosButton);

    const mañanaButton = document.createElement('button');
    mañanaButton.innerText = 'Mañana';
    mañanaButton.onclick = () => {
        markMañana(dayElement);
        closeAllDropdowns();
    };
    dropdown.appendChild(mañanaButton);

    const eliminarButton = document.createElement('button');
    eliminarButton.innerText = 'Eliminar';
    eliminarButton.onclick = () => {
        removeGuardia(dayElement, monthIndex);
        closeAllDropdowns();
    };
    dropdown.appendChild(eliminarButton);

    document.body.appendChild(dropdown);

    const rect = dayElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownWidth = dropdown.offsetWidth;
    const dropdownHeight = dropdown.offsetHeight;

    let top = rect.top + window.pageYOffset + rect.height;
    let left = rect.left + window.pageXOffset;

    // Asegurarse de que el menú no se salga de la pantalla
    if ((left + dropdownWidth) > viewportWidth) {
        left = viewportWidth - dropdownWidth - 10; // Espacio de 10px desde el borde
    }

    if ((top + dropdownHeight) > viewportHeight) {
        top = viewportHeight - dropdownHeight - 10; // Espacio de 10px desde el borde
    }

    
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;

    const overlay = document.getElementById('overlay');
    overlay.style.display = 'block';
    overlay.onclick = closeAllDropdowns;
}

// Función para cerrar todos los menús desplegables
function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    dropdowns.forEach(dropdown => dropdown.remove());
    document.getElementById('overlay').style.display = 'none';
}

// Función para obtener la semana de una fecha
function obtenerSemana(dia) {
    const startOfWeek = new Date(dia);
    const dayOfWeek = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const days = [];
    for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
    }
    return days;
}

// Función para formatear una fecha en formato dd/mm/yyyy
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Función para marcar una semana como "guardia"
function markWeekAsGuardia(dayElement, monthIndex) {
    const selectedDate = new Date(dayElement.dataset.date);
    const semana = obtenerSemana(selectedDate);
    let guardiaDias = [];

    semana.forEach(dia => {
        const diaDiv = document.querySelector(`.day[data-date="${dia.toISOString().split('T')[0]}"]`);
        if (diaDiv) {
            diaDiv.classList.add('guardia');
            almacenarInteraccionDia(diaDiv.dataset.date, 'guardia');
            guardiaDias.push(diaDiv.dataset.date);
        }
    });

    const primerDiaGuardia = formatDate(semana[0]);

    guardiasRealizadas.push({
        fecha: primerDiaGuardia,
        diasLibresRestantes: diasPorGuardia,
        diasLibresUsados: []
    });

    daysLibres += diasPorGuardia;
    updateCounter();

    registroLibrados.push({
        tipo: 'guardia',
        fecha: primerDiaGuardia,
        texto: `Guardia del ${primerDiaGuardia}`
    });
    saveRegistroLibradosToIndexedDB();
}

// Función para restaurar la etiqueta de "Tarde"
function restaurarTarde(dayElement) {
    let label = dayElement.querySelector('.tarde-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'tarde-label';
        label.innerText = 'T';
        dayElement.style.position = 'relative';
        label.style.position = 'absolute';
        label.style.top = '5px';
        label.style.left = '5px';
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
}

// Función para restaurar la etiqueta de "Mañana"
function restaurarMañana(dayElement) {
    let label = dayElement.querySelector('.mañana-label');
    if (!label) {
        label = document.createElement('span');
        label.className = 'mañana-label';
        label.innerText = 'M';
        dayElement.style.position = 'relative';
        label.style.position = 'absolute';
        label.style.top = '5px';
        label.style.right = '5px';
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        dayElement.appendChild(label);
    }
}

// Función para restaurar otros eventos
function restaurarOtrosEventos(dayElement, concepto, diasAfectados) {
    const parteSuperior = concepto.substring(0, 6);
    const parteInferior = concepto.length > 6 ? concepto.substring(6, 12) + '...' : concepto.substring(6);
    
    dayElement.dataset.conceptoCompleto = concepto;
    dayElement.dataset.diasAfectados = diasAfectados;
    
    const labelSuperior = document.createElement('div');
    const labelInferior = document.createElement('div');
    
    labelSuperior.className = 'otros-eventos-label';
    labelInferior.className = 'otros-eventos-label';
    
    labelSuperior.innerText = parteSuperior;
    labelInferior.innerText = parteInferior;
    
    labelSuperior.style.position = 'absolute';
    labelSuperior.style.top = '5px';
    labelSuperior.style.width = '100%';
    labelSuperior.style.textAlign = 'center';
    labelSuperior.style.fontSize = '10px';
    
    labelInferior.style.position = 'absolute';
    labelInferior.style.bottom = '5px';
    labelInferior.style.width = '100%';
    labelInferior.style.textAlign = 'center';
    labelInferior.style.fontSize = '10px';
    
    dayElement.style.position = 'relative';
    dayElement.appendChild(labelSuperior);
    dayElement.appendChild(labelInferior);
}
