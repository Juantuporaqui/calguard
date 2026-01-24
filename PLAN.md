# 🚓 Plan de Implementación CalGuard Policial

## Sistema Acordado

### Sincronización: Email
- Sin servidor 24/7
- Sin carpeta compartida
- Usando email existente

### Roles:
1. **Funcionario** (6 personas)
   - Ve su calendario personal
   - Marca guardias, libres, vacaciones
   - Añade eventos personales (privados)
   - Exporta y envía al jefe

2. **Jefe/Coordinador** (1 persona)
   - Todo lo del funcionario +
   - Vista de cuadrante grupal (7 personas)
   - Importa datos de los funcionarios
   - Consolida el cuadrante maestro
   - Exporta y distribuye a todos

### Privacidad:
- ✅ Guardias, libres, vacaciones → **PÚBLICAS** (todos las ven)
- ✅ Eventos personales (médico, cumpleaños, etc.) → **PRIVADOS** (solo el usuario)

---

## Implementación

### Fase 1: Eventos Personales ✅ (AHORA)
- [ ] Añadir tipos de eventos personales
- [ ] Marcador de eventos privados
- [ ] Icono diferenciador en calendario
- [ ] Filtros de visualización

### Fase 2: Sistema de Roles ✅ (AHORA)
- [ ] Pantalla de configuración inicial (¿Eres jefe?)
- [ ] Modo funcionario vs modo jefe
- [ ] Guardar rol en localStorage

### Fase 3: Vista Cuadrante Grupal ✅ (AHORA)
- [ ] Vista mensual con 7 usuarios
- [ ] Color por usuario
- [ ] Solo eventos laborales
- [ ] Estadísticas del equipo

### Fase 4: Sistema de Exportación/Importación Mejorado ✅ (AHORA)
- [ ] Exportar datos personales (con/sin eventos privados)
- [ ] Importar datos de otros usuarios (solo jefe)
- [ ] Consolidar cuadrante (solo jefe)
- [ ] Exportar cuadrante maestro (solo jefe)
- [ ] Importar cuadrante maestro (funcionarios)

---

## Flujo de Trabajo

### Cada Semana/Mes:

1. **Funcionarios** (lunes):
   - Marcan sus guardias/vacaciones en su PWA
   - Exportan: "Exportar Mis Datos"
   - Envían email al jefe con el archivo JSON

2. **Jefe** (martes):
   - Abre su PWA en modo Jefe
   - Importa los 6 archivos de los funcionarios
   - Revisa el cuadrante consolidado
   - Hace ajustes si es necesario
   - Exporta: "Exportar Cuadrante Maestro"
   - Envía por email a todos

3. **Funcionarios** (martes):
   - Reciben el cuadrante maestro
   - Importan en su PWA
   - Ya ven las guardias de todos

---

## Tipos de Eventos

### Laborales (Públicos):
```javascript
{
  tipo: 'guardia',
  subtipo: 'CMPE',
  color: '#ff6961',
  icono: '🚨',
  publico: true
}
```

### Personales (Privados):
```javascript
{
  tipo: 'personal',
  subtipo: 'medico' | 'cumpleaños' | 'formacion' | 'otro',
  color: '#95a5a6',
  icono: '📅',
  publico: false
}
```

---

## Mockup de Interfaces

### 1. Pantalla Inicial (Primera vez)
```
╔═══════════════════════════════════╗
║        Configuración Inicial      ║
╠═══════════════════════════════════╣
║                                   ║
║  Nombre: [____________]           ║
║  Placa:  [____________]           ║
║                                   ║
║  ¿Eres el coordinador?            ║
║  [ ] Sí, soy el jefe              ║
║  [x] No, soy funcionario          ║
║                                   ║
║  [Guardar Configuración]          ║
║                                   ║
╚═══════════════════════════════════╝
```

### 2. Menú de Eventos (Mejorado)
```
╔═══════════════════════════════════╗
║    Día 15 - ¿Qué deseas hacer?    ║
╠═══════════════════════════════════╣
║  EVENTOS LABORALES:               ║
║  [🚨 Guardia]                     ║
║  [🏖️ Pedir Días]                  ║
║  [📋 Asunto Propio]               ║
║  [✈️ Vacaciones]                  ║
║  [🌅 Tarde]                       ║
║  [🌄 Mañana]                      ║
║  ───────────────────────           ║
║  EVENTOS PERSONALES:              ║
║  [🏥 Cita Médica]                 ║
║  [🎓 Formación]                   ║
║  [🎂 Cumpleaños]                  ║
║  [📝 Nota Personal]               ║
║  ───────────────────────           ║
║  [❌ Quitar Evento]                ║
╚═══════════════════════════════════╝
```

### 3. Vista Cuadrante (Solo Jefe)
```
╔═══════════════════════════════════════════════════╗
║         CUADRANTE ENERO 2024                      ║
║  [Importar Datos] [Exportar Cuadrante]           ║
╠═══════════════════════════════════════════════════╣
║ Func.  │ L│ M│ X│ J│ V│ S│ D│ L│ M│...           ║
╟────────┼──┼──┼──┼──┼──┼──┼──┼──┼──┼───           ║
║ García │🚨│🚨│🚨│🚨│🚨│🏖️│🏖️│  │  │...           ║
║ López  │  │  │  │  │  │🚨│🚨│🚨│🚨│...           ║
║ Pérez  │🏖️│🏖️│  │  │  │  │  │  │  │...           ║
║ Ruiz   │  │  │✈️│✈️│✈️│✈️│✈️│  │  │...           ║
║ Díaz   │🚨│🚨│🚨│🚨│🚨│🏖️│🏖️│  │  │...           ║
║ Torres │  │  │  │  │  │  │  │🚨│🚨│...           ║
║ (Yo)   │📋│  │  │  │  │  │  │  │  │...           ║
╠═══════════════════════════════════════════════════╣
║ Estadísticas:                                     ║
║ Guardias activas: 2  | Disponibles: 5            ║
╚═══════════════════════════════════════════════════╝
```

---

## Archivos JSON

### Exportación Personal
```json
{
  "version": "2.0",
  "tipo": "personal",
  "usuario": {
    "nombre": "Juan García",
    "placa": "12345"
  },
  "eventos": [
    {
      "fecha": "2024-01-15",
      "tipo": "guardia",
      "publico": true
    },
    {
      "fecha": "2024-01-18",
      "tipo": "personal",
      "subtipo": "medico",
      "publico": false,
      "nota": "Revisión anual"
    }
  ]
}
```

### Cuadrante Maestro (Jefe exporta)
```json
{
  "version": "2.0",
  "tipo": "cuadrante_maestro",
  "mes": "2024-01",
  "actualizadoPor": "Jefe García",
  "fecha": "2024-01-24",
  "usuarios": [
    {
      "id": 1,
      "nombre": "García",
      "eventos": [...]
    },
    // Solo eventos públicos
  ]
}
```

---

## Comenzar Implementación

Empiezo ahora con las 4 fases en orden.
