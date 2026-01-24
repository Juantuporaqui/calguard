# 🚓 CalGuard Policial - Sistema Multi-Usuario

## Arquitectura del Sistema

### Contexto
- **Usuarios**: 7 funcionarios de policía
- **Entorno**: Intranet aislada (sin internet)
- **Comunicación**: Email disponible
- **Uso**: Gestión personal + Cuadrante grupal

---

## 🏗️ Componentes del Sistema

### 1. Aplicación Personal (PWA)
Cada funcionario tiene su propia app instalada en su dispositivo.

**Funcionalidades:**
- ✅ Gestión de guardias personales
- ✅ Días libres, asuntos propios, vacaciones
- ✅ **NUEVO**: Eventos personales (diferenciados)
- ✅ Calendario personal offline
- ✅ Exportación de datos
- ✅ Sincronización con cuadrante grupal

**Tipos de Eventos:**
```
LABORALES:
- 🚨 Guardias (CMPE)
- 🏖️ Libres
- 📋 Asuntos Propios
- ✈️ Vacaciones
- 🌅 Tarde/Mañana

PERSONALES:
- 📅 Citas médicas
- 🎂 Cumpleaños
- 🏥 Médico
- 🎓 Formación
- 📝 Notas/Recordatorios
```

### 2. Cuadrante Grupal
Vista compartida del equipo completo.

**Funcionalidades:**
- Ver guardias de los 7 funcionarios
- Calendario mensual/semanal del equipo
- Estadísticas del grupo
- Turnos pendientes
- Disponibilidad del equipo

### 3. Sistema de Sincronización

Dado que están en intranet aislada, hay 3 opciones:

#### **Opción A: Servidor Local en Intranet** ⭐ RECOMENDADA
```
┌─────────────────┐
│ Servidor Local  │ (En PC del despacho)
│   Node.js +     │
│   SQLite        │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Intranet│
    └────┬────┘
         │
    ┌────┴──────────────────┐
    │                       │
┌───┴───┐              ┌────┴────┐
│ PWA 1 │  ...  ...    │  PWA 7  │
└───────┘              └─────────┘
```

**Ventajas:**
- ✅ Sincronización en tiempo real
- ✅ No necesita internet
- ✅ Base de datos centralizada
- ✅ Todos ven cambios inmediatos

**Requisitos:**
- Un PC siempre encendido en el despacho
- Node.js instalado
- Acceso a la IP local del servidor

---

#### **Opción B: Sincronización por Carpeta Compartida**
```
┌─────────────────────────┐
│  Carpeta Red Compartida │ (\\servidor\calguard)
│    cuadrante.json       │
└───────┬─────────────────┘
        │
   ┌────┴──────┐
   │           │
┌──┴──┐     ┌──┴──┐
│PWA 1│ ... │PWA 7│
└─────┘     └─────┘
```

**Ventajas:**
- ✅ No necesita servidor
- ✅ Usa infraestructura existente
- ✅ Sincronización automática

**Desventajas:**
- ⚠️ No es en tiempo real
- ⚠️ Posibles conflictos de versión

---

#### **Opción C: Sincronización por Email**
```
┌─────────┐   email    ┌──────────┐
│  PWA 1  ├───────────►│Despacho  │
└─────────┘ JSON       │(Maestro) │
                       └──────────┘
┌─────────┐            │
│  PWA 2  ├────────────┤
└─────────┘            │
                       ▼
                  Actualiza
                  y Reenvía
```

**Ventajas:**
- ✅ Usa email existente
- ✅ Trazabilidad completa
- ✅ No necesita infraestructura adicional

**Desventajas:**
- ⚠️ Manual o semi-automático
- ⚠️ Más lento

---

## 💾 Modelo de Datos

### Usuario
```javascript
{
  id: 1,
  nombre: "Juan García",
  placa: "12345",
  puesto: "Agente",
  email: "juan.garcia@policia.local",
  color: "#ff6961" // Para el cuadrante
}
```

### Evento Personal
```javascript
{
  id: "evt_123",
  usuarioId: 1,
  tipo: "guardia" | "libre" | "asunto" | "vacaciones" | "personal",
  subtipo: "medico" | "cumpleaños" | "formacion" | null,
  fechaInicio: "2024-01-15",
  fechaFin: "2024-01-20",
  titulo: "Guardia CMPE",
  descripcion: "...",
  privado: true, // Si es true, solo el usuario lo ve
  sincronizado: false
}
```

### Cuadrante Grupal
```javascript
{
  mes: "2024-01",
  eventos: [
    { usuarioId: 1, tipo: "guardia", fechas: [...] },
    { usuarioId: 2, tipo: "vacaciones", fechas: [...] },
    ...
  ],
  ultimaActualizacion: "2024-01-24T10:30:00Z",
  actualizadoPor: "usuario_1"
}
```

---

## 🚀 Plan de Implementación

### Fase 1: Mejoras a la App Actual (1-2 días)
- [ ] Añadir gestión de eventos personales
- [ ] Separar eventos laborales vs personales
- [ ] Añadir filtros de visualización
- [ ] Mejorar exportación/importación

### Fase 2: Vista Cuadrante Grupal (2-3 días)
- [ ] Crear vista de cuadrante mensual
- [ ] Mostrar 7 usuarios simultáneamente
- [ ] Color por usuario
- [ ] Filtros por tipo de evento
- [ ] Estadísticas del grupo

### Fase 3: Sistema de Sincronización (3-5 días)
**Si eligen Opción A (Servidor Local):**
- [ ] Backend Node.js + Express
- [ ] Base de datos SQLite
- [ ] API REST para CRUD
- [ ] WebSocket para tiempo real
- [ ] Sistema de usuarios

**Si eligen Opción B (Carpeta Compartida):**
- [ ] Sistema de lectura/escritura de JSON
- [ ] Detección de cambios
- [ ] Resolución de conflictos
- [ ] Auto-sincronización cada X minutos

**Si eligen Opción C (Email):**
- [ ] Exportación automática a email
- [ ] Parser de emails entrantes
- [ ] Merge de datos
- [ ] Notificaciones de actualización

---

## 🎨 Mockup del Cuadrante Grupal

```
╔═══════════════════════════════════════════════════════╗
║            CUADRANTE - ENERO 2024                     ║
╠═══════════════════════════════════════════════════════╣
║ Usuario    │ 1│ 2│ 3│ 4│ 5│ 6│ 7│ 8│ 9│10│...│31     ║
╠════════════╪══╪══╪══╪══╪══╪══╪══╪══╪══╪══╪═══╪═══════╣
║ García, J. │🚨│🚨│🚨│🚨│🚨│🏖️│🏖️│  │  │  │...│       ║
║ López, M.  │  │  │  │  │  │🚨│🚨│🚨│🚨│🚨│...│       ║
║ Pérez, A.  │🏖️│🏖️│  │  │  │  │  │  │  │  │...│       ║
║ Ruiz, C.   │  │  │  │✈️│✈️│✈️│✈️│✈️│  │  │...│       ║
║ Díaz, L.   │🚨│🚨│🚨│🚨│🚨│🏖️│🏖️│  │  │  │...│       ║
║ Torres, P. │  │  │  │  │  │  │  │🚨│🚨│🚨│...│       ║
║ Vega, R.   │📋│  │  │  │  │  │  │  │  │  │...│       ║
╚════════════╧══╧══╧══╧══╧══╧══╧══╧══╧══╧══╧═══╧═══════╝

Leyenda:
🚨 Guardia  🏖️ Libre  📋 Asunto  ✈️ Vacaciones  🌅 Tarde  🌄 Mañana
```

---

## ❓ Decisiones Necesarias

Para continuar, necesito que me indiques:

1. **¿Qué opción de sincronización prefieres?**
   - A: Servidor local (más complejo, mejor resultado)
   - B: Carpeta compartida (intermedio)
   - C: Email (más simple, más manual)

2. **¿Tienen un servidor/PC siempre encendido en el despacho?**

3. **¿Qué información del cuadrante debe ser pública y qué privada?**
   - ¿Todos ven las guardias de todos?
   - ¿Los eventos personales son privados?

4. **¿Quién puede modificar el cuadrante maestro?**
   - Solo el jefe/coordinador
   - Cualquier funcionario
   - Sistema de permisos

5. **¿Necesitan versión móvil, escritorio o ambas?**

---

## 🎯 Siguientes Pasos Inmediatos

Una vez decidas la arquitectura, puedo:

1. Implementar el sistema de eventos personales
2. Crear la vista de cuadrante grupal
3. Desarrollar el sistema de sincronización elegido
4. Configurar el backend si es necesario
5. Crear sistema de usuarios

**¿Qué opción de sincronización te parece mejor para vuestro caso?**
