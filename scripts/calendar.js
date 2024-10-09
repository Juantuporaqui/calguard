// calendar.js

import { formatDate, formatDateShort } from './utils.js';

// Función para generar el calendario anual
export function generateYearCalendar(year) {
    const yearCalendar = document.getElementById('year-calendar');
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
            dayDiv.dataset.date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            // Determinar si el día es sábado o domingo
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
