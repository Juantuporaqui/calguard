# 🐛 DEBUG EN CONSOLA - Ver qué lee el parser

## Cómo ver exactamente qué está leyendo el parser

### Paso 1: Abrir la consola del navegador
1. Abre CalGuard en el navegador
2. Presiona **F12** (o clic derecho → Inspeccionar)
3. Ve a la pestaña **"Console"**

---

### Paso 2: Interceptar la lectura del Excel

Cuando hagas clic en **"📥 Cargar"** y selecciones tu archivo .xlsx, la consola mostrará mensajes. Busca estos:

```
File selected: archivo.xlsx, ...
Parseando Excel, hojas disponibles: Array [ "Hoja1" ]
Procesando hoja: Hoja1
Detectado formato Excel con bloques mensuales
Año detectado: 2026
Mes detectado: ENERO -> 2026-01
```

---

### Paso 3: Ver los datos crudos que lee

**Añade esto temporalmente al código para debug:**

En la consola, después de seleccionar el archivo, deberías ver logs como:

```
Fila X, Nombre: PACO
Día 1 (índice 1): M
Día 2 (índice 2): M
Día 3 (índice 3): vacío
```

---

### Paso 4: Comandos útiles en la consola

**Ver el cuadrante actual:**
```javascript
window.cuadranteManager.usuarios
```

Esto te mostrará todos los usuarios con sus eventos.

**Ver eventos de PACO:**
```javascript
window.cuadranteManager.usuarios.find(u => u.nombre === 'Paco').eventos
```

**Filtrar eventos de enero 2026:**
```javascript
window.cuadranteManager.usuarios
  .find(u => u.nombre === 'Paco')
  .eventos
  .filter(e => e.fecha.startsWith('2026-01'))
  .sort((a,b) => a.fecha.localeCompare(b.fecha))
```

Esto te mostrará todos los eventos de Paco en enero, ordenados por fecha.

---

### Paso 5: Exportar para comparar

**Exporta el cuadrante actual:**
```javascript
JSON.stringify(window.cuadranteManager.usuarios, null, 2)
```

Copia el resultado y pégalo en un archivo de texto. Luego compara con tu Excel original.

---

## 🔍 Qué buscar en los logs

### Problema 1: Año incorrecto
Si ves:
```
Año detectado: 2024
```
Cuando debería ser 2026, el parser está leyendo un año antiguo del archivo.

### Problema 2: Mes incorrecto
Si ves:
```
Mes detectado: ENERO -> 2025-01
```
Cuando debería ser 2026-01, hay un problema con el año actual.

### Problema 3: Nombres no encontrados
Si ves:
```
Excel de bloques procesado: 0 eventos de 0 usuarios
```
Los nombres no están coincidiendo. Revisa el mapeo de nombres.

### Problema 4: Códigos ignorados
Si ves muchos:
```
Código desconocido 'XXX' para Paco el 5/1/2026
```
Hay códigos en tu Excel que el parser no reconoce.

### Problema 5: Desfase de columnas
Si el día 1 muestra "M" pero en tu Excel el día 1 está vacío, las columnas están desfasadas.

---

## 📋 Template para reportar el problema

**Copia esto y rellénalo:**

```
=== LOGS DE LA CONSOLA ===
[Pega aquí lo que aparece en la consola cuando importas]

=== EVENTOS DE PACO EN ENERO ===
[Pega aquí el resultado del comando de la consola]

=== COMPARACIÓN CON EXCEL ===
Día 1:
  Excel dice: [código]
  CalGuard muestra: [código]

Día 2:
  Excel dice: [código]
  CalGuard muestra: [código]

[etc...]

=== OBSERVACIONES ===
- ¿Los días están desfasados? (ej: el día 2 de Excel aparece en día 3 de CalGuard)
- ¿Los códigos son diferentes? (ej: "M" en Excel pero "L" en CalGuard)
- ¿Falta algún día?
```

---

## 🎯 Lo que necesito para arreglar el parser

Con esta información podré saber exactamente:
1. ¿Está leyendo las columnas correctas?
2. ¿Está interpretando bien los códigos?
3. ¿Hay un desfase de índices?
4. ¿El año/mes se detecta bien?

Envíame los logs y la comparación, y ajustaré el parser inmediatamente.
