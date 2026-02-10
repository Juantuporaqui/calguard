# Manual Operativo - CalGuard para Policía Científica

## Introducción

CalGuard es una herramienta personal/de equipo para gestionar el cuadrante de guardias, libranzas, asuntos propios, vacaciones y la bitácora operativa del Grupo de Policía Científica.

**No sustituye sistemas corporativos.** Es un complemento organizativo personal.

---

## 1. Primer arranque

Al abrir la app por primera vez:
1. Se crea un perfil por defecto ("Mi Perfil")
2. Si existían datos de la versión anterior, se migran automáticamente
3. Se muestra el **Dashboard** (pantalla de inicio)

### Configuración inicial recomendada

Ve a **Ajustes** (icono de engranaje en la barra inferior):

1. **Reglas de guardia**:
   - Días libres por guardia: **5** (ya configurado por defecto)
   - Ciclo: **Semanal**
   - Asuntos propios anuales: **8** (ajustar según convenio)
   - Vacaciones anuales: **25** (ajustar)

2. **Seguridad** (recomendado):
   - Establece un PIN de 4-8 dígitos
   - Auto-bloqueo: 5 minutos

3. **Perfil**:
   - Cambia el nombre a tu identificación (ej: "TIP 12345")
   - Selecciona tu rol

---

## 2. Pantallas

### Dashboard (Inicio)
- Resumen del día actual
- Contadores: libres acumulados, gastados, A.P., vacaciones
- Vista de la semana actual
- Próxima guardia
- Detalle de guardias con barra de progreso
- Alertas (saldo bajo, pocos AP, etc.)

### Calendario
- Navegación por mes y año (flechas)
- Vista de mes individual o año completo
- Cada día muestra su estado con color:
  - **Rojo**: Guardia realizada
  - **Naranja punteado**: Guardia planificada
  - **Verde**: Día libre
  - **Azul**: Vacaciones
  - **Morado**: Asunto propio
  - **Verde oscuro**: Formación
  - **Rosa**: Juicio/citación
- Toca un día para ver el menú de acciones

### Bitácora de Servicios
- Lista filtrable por tipo y mes
- Crear nuevo servicio con todos los campos
- Estadísticas de total y horas

### Estadísticas
- Filtro por semana/mes/año/todo
- Servicios por tipo (gráfico de barras)
- Servicios por mes
- Balance de guardias

### Ajustes
- Reglas de guardia
- Seguridad (PIN, auto-bloqueo)
- Perfil
- Modo oscuro
- Exportaciones (ICS, CSV, impresión)
- Plantillas de mensaje
- Backup/Restaurar
- Tipos de servicio configurables
- Diagnóstico interno

---

## 3. Flujos de uso principales

### 3.1 Registrar una guardia realizada

1. Ve al **Calendario**
2. Toca cualquier día de la semana de guardia
3. En el menú, pulsa **"Guardia Realizada"**
4. Se marca la semana completa (L-D) en rojo
5. Se acreditan **5 días libres** al saldo
6. Aparece en el ledger como movimiento CREDIT

### 3.2 Planificar una guardia futura

1. Toca un día de la semana futura
2. Pulsa **"Próx. Guardia"**
3. La semana se marca con borde naranja punteado
4. **No genera días libres** hasta que se realice

### 3.3 Pedir días libres

1. Toca cualquier día del calendario
2. Pulsa **"Pedir Días Libres"**
3. Se activa el modo de selección múltiple
4. Toca cada día que quieras librar (se resaltan en verde)
5. Puedes navegar entre meses sin perder la selección
6. Pulsa **"Confirmar"**
7. Los días se asignan a guardias con saldo (D.1, D.2... de cada guardia)
8. Se genera un mensaje para WhatsApp/copiar

**Formato del mensaje**:
```
Solicito librar los siguientes días:
D.1 G.03/02: 15/02
D.2 G.03/02: 22/02
D.3 G.03/02: 01/03
Gracias.
```

### 3.4 Marcar vacaciones

1. Toca el **primer día** de vacaciones
2. Pulsa **"Vacaciones"**
3. Aparece banner: "Selecciona el último día"
4. Toca el **último día** del período
5. Se muestra confirmación con días laborables a descontar
6. Confirma
7. Los fines de semana se excluyen automáticamente (configurable)

### 3.5 Marcar asunto propio

1. Toca el día
2. Pulsa **"Asunto Propio"**
3. Se descuenta 1 del saldo de A.P.
4. Si no quedan, aparece aviso

### 3.6 Registrar un servicio en la bitácora

1. Ve a **Bitácora** > **"+ Nuevo Servicio"**
2. Rellena:
   - Fecha
   - Tipo (Inspección Ocular, Levantamiento, Laboratorio, etc.)
   - Hora inicio/fin (opcional, calcula duración automáticamente)
   - Ubicación general (municipio/distrito)
   - Etiquetas
   - Notas operativas
3. **IMPORTANTE**: No introducir datos personales (nombres, DNI, direcciones exactas)
4. Pulsa "Guardar"

### 3.7 Exportar calendario

- **ICS**: Ajustes > Exportaciones > "Exportar Calendario (ICS)"
  - Importable en Google Calendar, Outlook, Apple Calendar
- **CSV**: Para análisis en Excel
- **Imprimir**: Ajustes > "Vista imprimible" o Ctrl+P desde cualquier pantalla

### 3.8 Backup y restauración

**Exportar**:
1. Ajustes > Backup > "Exportar Backup"
2. Se descarga un archivo JSON con todos los datos
3. Opción: "Exportar Backup Cifrado" (requiere contraseña)

**Importar**:
1. Ajustes > Backup > "Importar Backup"
2. Selecciona el archivo .json
3. Si está cifrado, introduce la contraseña
4. Elige: Reemplazar (sobrescribir todo) o Fusionar

---

## 4. Eliminación de eventos

- Toca un día marcado > **"Eliminar"**
- Si es guardia: elimina la semana completa
- Si es vacaciones: elimina todo el rango
- Los contadores se recalculan automáticamente

---

## 5. Diagnóstico

En **Ajustes > Diagnóstico interno**:
- Ejecuta 10 comprobaciones automáticas:
  - Lectura/escritura de IndexedDB
  - Consistencia del ledger
  - Contadores correctos
  - Sin fechas duplicadas
  - Service Worker activo
  - Cache PWA presente
  - Perfiles válidos
  - Tags válidos
- Genera informe descargable (sin datos sensibles)

---

## 6. Modo oscuro

Ajustes > Apariencia > "Modo oscuro"

---

## 7. Uso offline

La app funciona completamente sin conexión a internet una vez instalada. Los datos se almacenan localmente en el navegador.

Cuando hay una nueva versión disponible, aparece un banner azul en la parte superior: **"Nueva versión disponible → Actualizar"**.

---

## 8. Tipos de servicio predefinidos

Configurables en Ajustes > Tipos de Servicio:

- Inspección Ocular
- Levantamiento
- Laboratorio
- Incendio
- Homicidio
- Robo
- Explosivos
- Inspección Vehículo
- Reseña
- Documentoscopia
- Balística
- Informática Forense
- Otro

Se pueden añadir, modificar o eliminar tipos según necesidades del grupo.
