# 🚓 CalGuard - Guía de Uso del Sistema Policial

## 🎉 Sistema Completado y Listo para Usar

**Versión:** 2.0
**Estado:** ✅ Producción

---

## 📱 Acceso al Sistema

### Primera Vez (Cada Funcionario):

1. **Abrir la aplicación** en el navegador
2. Aparecerá la pantalla de **Login**
3. Introducir:
   - **Placa/TIP:** Tu número de placa (ej: 12345)
   - **Contraseña:** Crea una contraseña (primera vez te pedirá tu nombre)
4. Click en **"Acceder"**

### Usuarios del Sistema:
- **Tesa, Paco, Mario, Rafa, Reinoso, Nuria, Juan, Carmen** → 8 usuarios
- Todos tienen el mismo acceso: calendario personal + cuadrante consultivo
- **Juan** → Administrador web (funciones administrativas)

---

## 🔐 Sistema de Acceso

### 👤 Todos los Usuarios (8 personas):
✅ Ver y gestionar su **calendario personal**
✅ Marcar guardias, libres, vacaciones, etc.
✅ Añadir eventos personales privados (médico, formación, etc.)
✅ Exportar sus datos personales
✅ **Ver el cuadrante grupal** (solo lectura, informativo)
✅ **📲 Importar sus propios turnos del cuadrante a su calendario** (FUNCIÓN PREMIUM)

**Importante:**
- El cuadrante "madre" está en el **despacho** físicamente
- La app es **consultiva y organizativa**, no vinculante
- Todos los usuarios tienen el mismo nivel de acceso
- Nadie puede modificar el cuadrante desde la app (se actualiza en el despacho)

---

## 📅 Usar el Calendario Personal

### Marcar un Día:

1. **Click en el día** del calendario
2. Aparece el menú con opciones:

#### 🚨 **EVENTOS LABORALES** (Públicos - todos lo ven):
- **🚨 Guardia:** Marca toda la semana de guardia (CMPE)
- **🔮 Próx. Guardia:** Marcar próxima guardia planificada
- **🏖️ Pedir Días:** Solicitar días libres
- **📋 A. Propio:** Marcar asunto propio (descuenta del contador)
- **✈️ Vacaciones:** Marcar período de vacaciones
- **🌅 Tarde:** Turno de tarde
- **🌄 Mañana:** Turno de mañana

#### 📅 **EVENTOS PERSONALES** (Privados - solo tú los ves):
- **🏥 Cita Médica:** Recordatorio médico privado
- **🎓 Formación:** Cursos, formación
- **📝 Nota Personal:** Cualquier nota privada
- **📅 Otros:** Otros eventos personales

#### ❌ **ACCIONES:**
- **Eliminar:** Borra el evento del día

---

## 👥 Ver Cuadrante Grupal

### Para TODOS los usuarios:

1. Click en la tab **"👥 Cuadrante Grupal"**
2. Verás una tabla con:
   - Los 8 funcionarios en filas
   - Los días del mes en columnas
   - Iconos de cada evento

### Navegación:
- **◀ Mes Anterior / Mes Siguiente ▶**
- Solo se muestran **eventos laborales** (no los personales)

### 🌟 FUNCIÓN PREMIUM: Importar Mis Turnos

**Disponible para TODOS los usuarios:**

1. En la vista de cuadrante, click en **"📲 Importar Mis Turnos"**
2. El sistema encontrará automáticamente TUS eventos en el cuadrante
3. Importará todos tus turnos (guardias, libres, vacaciones, etc.) a tu calendario personal
4. Verás un mensaje confirmando cuántos eventos se importaron
5. Cambia a la pestaña **"📅 Mi Calendario"** para ver tus turnos importados

**Ventajas:**
- ✅ Sincronización automática del cuadrante maestro a tu calendario
- ✅ No necesitas marcar manualmente tus turnos
- ✅ Ahorra tiempo y evita errores de transcripción
- ✅ Funciona con eventos de un día y períodos largos

### Estadísticas del Cuadrante:
- **Guardias Activas:** Cuántos están de guardia hoy
- **Funcionarios Disponibles:** Cuántos están disponibles
- **De Vacaciones:** Cuántos están de vacaciones
- **Total Eventos:** Eventos totales del mes

### 📥 Actualizar el Cuadrante Completo (Desde Despacho)

**Hay 3 formas de actualizar el cuadrante:**

#### 1️⃣ **Edición Manual (Celda por Celda)**
- Click en cualquier celda del cuadrante
- Selecciona el tipo de evento del menú
- Se guarda automáticamente
- **Ideal para:** Cambios pequeños o correcciones

#### 2️⃣ **Cargar Cuadrante Completo (Recomendado para actualización masiva)**

**Pasos:**
1. En "👥 Cuadrante Grupal", click en **"📤 Guardar Cuadrante"**
   - Descarga el archivo actual: `cuadrante-completo-FECHA.json`
   - Guarda este archivo como backup

2. Abre el archivo JSON con un editor de texto (Notepad, VSCode, etc.)

3. Edita los eventos de cada usuario:
   ```json
   {
     "nombre": "Tesa",
     "eventos": [
       { "tipo": "guardia", "fecha": "2025-01-15" },
       { "tipo": "libre", "fecha": "2025-01-16" },
       { "tipo": "vacaciones", "fecha": "2025-01-20" }
     ]
   }
   ```

4. Guarda el archivo modificado

5. En la app, click en **"📥 Cargar Cuadrante"**
   - Selecciona el archivo JSON modificado
   - Confirma la importación
   - ¡Listo! Todo el cuadrante se actualiza

**Tipos de eventos disponibles:**
- `guardia` 🚨 - Guardia
- `libre` 🏖️ - Día Libre
- `asunto` 📋 - Asunto Propio
- `vacaciones` ✈️ - Vacaciones
- `tarde` 🌅 - Turno de Tarde
- `mañana` 🌄 - Turno de Mañana

#### 3️⃣ **Usar Plantilla Vacía (Para empezar desde cero)**
1. Click en **"📋 Plantilla"**
2. Descarga el archivo `plantilla-cuadrante.json`
3. Rellena los eventos de todos los usuarios
4. Carga el archivo con **"📥 Cargar Cuadrante"**

**⚠️ Importante:**
- Al cargar un cuadrante completo, se reemplazan TODOS los datos actuales
- Haz siempre un backup antes con "📤 Guardar Cuadrante"
- Los usuarios luego pueden importar sus turnos con "📲 Importar Mis Turnos"

---

## 📤 Exportar e Importar Datos

### Para Funcionarios:

**Exportar tus datos:**
1. Click en botón **📥** (arriba derecha)
2. Seleccionar **"Exportar como JSON"**
3. Se descarga: `calguard-backup-FECHA.json`
4. Enviar este archivo por email al jefe

**Exportar para Excel:**
1. Click en botón **📥**
2. Seleccionar **"Exportar como CSV"**
3. Abrir con Excel
4. Enviar por email al jefe

---

### Para el Jefe:

**Importar datos de funcionarios:**
1. En la tab **"👥 Cuadrante Grupal"**
2. Click en **"📥 Importar Datos"**
3. Seleccionar el archivo JSON del funcionario
4. El sistema actualiza automáticamente el cuadrante

**Exportar cuadrante maestro:**
1. En la tab **"👥 Cuadrante Grupal"**
2. Click en **"📤 Exportar Cuadrante"**
3. Se descarga: `cuadrante-maestro-AÑO-MES.json`
4. Enviar este archivo por email a TODOS los funcionarios

**Funcionarios importan cuadrante maestro:**
1. Reciben el email del jefe con el JSON
2. Click en botón **📥** (arriba derecha)
3. Click en **"Importar Cuadrante"** (opción que aparece)
4. Seleccionar el archivo del jefe
5. ¡Listo! Ya ven las guardias de todos

---

## ⚙️ Configuración

### Ver Contadores:
1. Click en botón **☰** (derecha)
2. Se muestra:
   - Libres Acumulados
   - A. Propios Restantes
   - Vacaciones Restantes
   - Libres Gastados

### Configurar Parámetros:
1. Click en botón **⚙️** (izquierda)
2. Ajustar:
   - Asuntos Propios Anuales (AP)
   - Días por Guardia (CMPE)
   - Vacaciones Anuales (VC)
   - Días Extra

3. Click en **"Guardar Configuración"**

### Otras Opciones:
- **Ver Registro:** Historial de días librados
- **Resetear Contadores:** Volver a cero (cuidado!)
- **Enviar WhatsApp:** Generar mensaje para solicitud

---

## 🌙 Modo Oscuro

- Click en el botón **🌙/☀️** (arriba derecha)
- Cambia automáticamente entre tema claro y oscuro
- Se guarda tu preferencia

---

## 🚪 Cerrar Sesión

- Click en el icono **🚪** junto a tu nombre (arriba)
- Confirmar
- Vuelve a la pantalla de login

---

## 🔄 Flujo de Trabajo Recomendado

### Uso Principal - Calendario Personal:

1. **Cada usuario gestiona su propio calendario personal**
   - Marcar guardias realizadas
   - Añadir eventos personales (citas médicas, formación, etc.)
   - Exportar sus datos cuando sea necesario

2. **Consultar el cuadrante grupal**
   - El cuadrante "madre" está en el **despacho** (físico)
   - Se actualiza manualmente en el despacho
   - Todos pueden consultarlo en la app (solo lectura)

3. **Sincronizar turnos del cuadrante**
   - Cuando se actualice el cuadrante en el despacho:
   - Ve a la tab **"👥 Cuadrante Grupal"**
   - Click en **"📲 Importar Mis Turnos"**
   - Tus turnos se copian automáticamente a tu calendario personal

### Uso Consultivo:
- La app es **organizativa y consultiva**, no vinculante
- Sirve para llevar tu propia contabilidad de días
- El cuadrante oficial está en el despacho

---

## 🆘 Problemas Comunes

### "No puedo iniciar sesión"
- Verifica que la placa esté correcta
- Si olvidaste la contraseña, contacta al administrador

### "El menú no se ve completo"
✅ **ARREGLADO** - El menú ahora siempre cabe en pantalla, incluso en los primeros días del año

### "No veo la tab de Cuadrante Grupal"
- Todos los usuarios deberían verla
- Si no aparece, cierra sesión y vuelve a entrar

### "Perdí mis datos"
- Los datos están en localStorage del navegador
- Si cambias de navegador/dispositivo, se pierden
- Por eso es importante exportar regularmente

---

## 📊 Estadísticas y Contadores

### Automáticos:
- **Guardias:** Al marcar guardia de 5 días → +5 días libres
- **Asuntos Propios:** Empiezas con 8/año
- **Vacaciones:** Empiezas con 25/año
- **Libres Gastados:** Se incrementa al usar días libres

### Personalizable:
- Puedes ajustar los valores en Configuración (⚙️)

---

## 🌐 Instalación como App

### En Móvil (Android/iOS):
1. Abrir en Chrome/Safari
2. Menú → "Añadir a pantalla de inicio"
3. Se instala como app nativa
4. Funciona offline

### En Escritorio:
1. Abrir en Chrome/Edge
2. Click en icono ⊕ en la barra de direcciones
3. "Instalar CalGuard"
4. Se abre como ventana independiente

---

## 🎯 Consejos y Buenas Prácticas

✅ **Exporta regularmente** tus datos
✅ **Usa eventos personales** para citas médicas, etc.
✅ **El jefe consolida semanalmente** el cuadrante
✅ **Instala como PWA** para acceso rápido
✅ **Usa modo oscuro** de noche para no cansar la vista

---

## 🏆 Características del Sistema

- ✅ **100% Offline:** Funciona sin internet (ideal para intranet)
- ✅ **Multi-Usuario:** 8 funcionarios con autenticación individual
- ✅ **Sistema Igualitario:** Todos los usuarios tienen el mismo nivel de acceso
- ✅ **Privacidad:** Eventos personales solo los ves tú
- ✅ **Seguridad:** Contraseñas hasheadas, autenticación por usuario
- ✅ **Responsive:** Funciona en móvil y escritorio
- ✅ **Modo Oscuro:** Para trabajar de noche
- ✅ **PWA:** Instalable como app nativa
- ✅ **Exportación:** JSON y CSV para respaldo
- ✅ **Cuadrante Consultivo:** Ver turnos de todo el equipo (actualizado desde despacho)
- ✅ **🌟 Función Premium:** Importación automática de turnos del cuadrante a calendario personal
- ✅ **Uso Organizativo:** Sistema consultivo, no vinculante

---

## 📞 Soporte

Para problemas técnicos o mejoras:
- Crear issue en GitHub
- Contactar al administrador del sistema

---

**¡Sistema listo para usar! 🚀**

**Equipo de desarrollo CalGuard**
Versión 2.0 - Sistema Policial Multi-Usuario
