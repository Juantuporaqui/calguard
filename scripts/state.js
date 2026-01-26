// state.js - Estado compartido de la aplicación

let lastSelectedDay = null;

export function getLastSelectedDay() {
    return lastSelectedDay;
}

export function setLastSelectedDay(day) {
    lastSelectedDay = day;
}
