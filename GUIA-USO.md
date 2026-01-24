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
- **Tesa** → JEFA (acceso total)
- **Paco** → JEFE (acceso total)
- **Mario, Rafa, Reinoso, Nuria, Juan, Carmen** → Funcionarios (calendario personal + vista cuadrante)

**Nota:** Los jefes se identifican por nombre, no por placa

---

## 🔐 Roles y Permisos

### 👤 Funcionario (6 personas: Mario, Rafa, Reinoso, Nuria, Juan, Carmen):
✅ Puede ver y gestionar su calendario personal
✅ Marcar guardias, libres, vacaciones
✅ Añadir eventos personales (médico, formación, etc.)
✅ Exportar sus datos
✅ Ver el cuadrante grupal (solo lectura)
✅ **📲 Importar sus propios turnos del cuadrante a su calendario** (PREMIUM)
❌ NO puede modificar el cuadrante grupal
❌ NO puede importar/exportar datos de otros funcionarios

### 👑 Jefes/Coordinadores (2 personas: Tesa y Paco):
✅ Todo lo del funcionario +
✅ Ver cuadrante completo de 8 personas
✅ Importar datos de los funcionarios al cuadrante
✅ Exportar cuadrante maestro
✅ Modificar cuadrante grupal

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
- ✅ Ahorra tiempo al consolidar los datos del jefe
- ✅ Funciona con eventos de un día y períodos largos

### Permisos por Rol:

**👑 Solo Jefes (Tesa y Paco):**
- **📥 Importar Datos:** Importar archivos JSON de funcionarios
- **📤 Exportar Cuadrante:** Exportar cuadrante maestro

**👤 Todos los usuarios:**
- Ver cuadrante completo (solo lectura)
- **📲 Importar Mis Turnos** a calendario personal

### Estadísticas:
- **Guardias Activas:** Cuántos están de guardia hoy
- **Funcionarios Disponibles:** Cuántos están disponibles
- **De Vacaciones:** Cuántos están de vacaciones
- **Total Eventos:** Eventos totales del mes

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

## 🔄 Flujo de Trabajo Semanal

### 1. Lunes - Funcionarios:
- Cada uno marca sus guardias de la semana en su calendario personal
- Exportan sus datos: `calguard-backup-FECHA.json`
- Envían por email al jefe (Tesa o Paco)

### 2. Martes - Jefes (Tesa/Paco):
- Reciben los 6 archivos de los funcionarios
- Abren CalGuard → Tab "Cuadrante Grupal"
- Importan cada archivo uno por uno (📥 Importar Datos)
- Revisan el cuadrante consolidado
- Exportan cuadrante maestro (📤 Exportar Cuadrante)
- Envían `cuadrante-maestro-AÑO-MES.json` a TODOS por email

### 3. Martes Tarde - Funcionarios:
- Reciben email del jefe con el cuadrante maestro
- Opción A (Manual): Importan el cuadrante maestro a su sistema
- **Opción B (PREMIUM - Recomendado):**
  1. Van a la tab "👥 Cuadrante Grupal"
  2. Click en **"📲 Importar Mis Turnos"**
  3. El sistema automáticamente sincroniza sus turnos
  4. Ya ven sus guardias en "📅 Mi Calendario"

---

## 🆘 Problemas Comunes

### "No puedo iniciar sesión"
- Verifica que la placa esté correcta
- Si olvidaste la contraseña, contacta al administrador

### "El menú no se ve completo"
✅ **ARREGLADO** - El menú ahora siempre cabe en pantalla, incluso en los primeros días del año

### "No veo la tab de Cuadrante Grupal"
- Solo el jefe (placa 00001) puede verla
- Otros funcionarios no tienen acceso

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

- ✅ **100% Offline:** Funciona sin internet
- ✅ **Multi-Usuario:** 8 funcionarios simultáneos (2 jefes + 6 funcionarios)
- ✅ **Roles y Permisos:** Sistema basado en roles (jefes vs funcionarios)
- ✅ **Privacidad:** Eventos personales solo los ves tú
- ✅ **Seguridad:** Contraseñas hasheadas, autenticación por usuario
- ✅ **Responsive:** Funciona en móvil y escritorio
- ✅ **Modo Oscuro:** Para trabajar de noche
- ✅ **PWA:** Instalable como app nativa
- ✅ **Exportación:** JSON y CSV
- ✅ **Sincronización:** Via email (no necesita servidor)
- ✅ **🌟 Premium:** Importación automática de turnos del cuadrante a calendario personal

---

## 📞 Soporte

Para problemas técnicos o mejoras:
- Crear issue en GitHub
- Contactar al administrador del sistema

---

**¡Sistema listo para usar! 🚀**

**Equipo de desarrollo CalGuard**
Versión 2.0 - Sistema Policial Multi-Usuario
