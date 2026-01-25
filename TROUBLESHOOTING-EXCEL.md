# 🔧 Troubleshooting: Excel no carga

## ❓ Problema: No se puede cargar archivo .xlsx

### Pasos para Diagnosticar:

#### 1. Verificar que SheetJS se carga correctamente

**Abrir consola del navegador:**
- **Chrome/Edge**: F12 o Ctrl+Shift+I
- **Firefox**: F12 o Ctrl+Shift+K
- **Safari**: Cmd+Option+I (necesitas activar Developer Menu primero)

**En la pestaña "Console", escribe:**
```javascript
typeof XLSX
```

**Resultado esperado:** `"object"`

**Si dice `"undefined"`:**
- SheetJS no se cargó correctamente
- Verifica tu conexión a internet
- Revisa si hay un bloqueador de scripts activo

---

#### 2. Verificar que el botón funciona

**En la consola, escribe:**
```javascript
window.cuadranteManager
```

**Resultado esperado:** Debe mostrar un objeto con funciones

**Si dice `undefined`:**
- El cuadrante manager no se inicializó
- Recarga la página con Ctrl+F5 (recarga forzada)

---

#### 3. Probar la función de importación manualmente

**En la consola, escribe:**
```javascript
window.cuadranteManager.importarCuadranteCompleto()
```

**Resultado esperado:** Debe abrir un diálogo de selección de archivo

**Si no pasa nada:**
- Hay un error en JavaScript
- Revisa la consola para ver mensajes de error

---

#### 4. Comprobar errores al seleccionar el archivo

**Después de hacer clic en "📥 Cargar Cuadrante" y seleccionar el .xlsx:**

**Mira la consola del navegador. Deberías ver:**
```
File selected: archivo.xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, 123456
Parseando Excel, hojas disponibles: Array [ "Hoja1" ]
Procesando hoja: Hoja1
Detectado formato Excel con bloques mensuales
Año detectado: 2025
Mes detectado: ENERO -> 2025-01
...
Excel de bloques procesado: 234 eventos de 8 usuarios
Eventos cargados para Tesa: 45
Eventos cargados para Paco: 32
...
```

**Si ves un error rojo:**
- Cópiame el error completo
- Me ayudará a saber qué está fallando

---

#### 5. Problemas comunes

##### Error: "XLSX is not defined"
**Causa:** SheetJS no cargó
**Solución:**
1. Verifica tu conexión a internet
2. Recarga la página con Ctrl+F5
3. Desactiva bloqueadores de contenido temporalmente

##### Error: "Cannot read property 'importarCuadranteCompleto' of undefined"
**Causa:** cuadranteManager no se inicializó
**Solución:**
1. Ve a la vista "👥 Cuadrante Grupal" primero
2. Espera 1 segundo
3. Prueba de nuevo

##### El diálogo de archivo no se abre
**Causa:** Popup bloqueado o error de JavaScript
**Solución:**
1. Revisa si hay notificación de popup bloqueado
2. Permite popups para el sitio
3. Revisa la consola por errores

##### Archivo seleccionado pero no pasa nada
**Causa:** Error al leer el archivo
**Solución:**
1. Verifica que el archivo no esté corrupto
2. Abre el Excel, guárdalo de nuevo como .xlsx
3. Prueba con un archivo más pequeño primero

##### Error: "No se pudo procesar ningún evento"
**Causa:** El formato del Excel no coincide con lo esperado
**Solución:**
1. Mira MAPEO-CODIGOS.md
2. Verifica que tu Excel tenga bloques de meses
3. Exporta el Excel como CSV y mándamelo para analizar

---

#### 6. Test con archivo de ejemplo

**Crear un Excel de prueba:**
1. Abre Excel
2. En la celda A1 escribe: `ENERO`
3. En B2-AF2 escribe: 1, 2, 3, ..., 31
4. En B3-AF3 escribe: X, J, V, S, D, L, M, ... (días de semana)
5. En A4 escribe: `TESA`
6. En B4-F4 escribe: M, M, T, T, V
7. Guarda como .xlsx
8. Prueba a importarlo

**Resultado esperado:**
- Debe importar 5 eventos para Tesa en enero

---

#### 7. Formato alternativo: CSV

**Si el .xlsx sigue sin funcionar:**

1. Abre tu Excel
2. **Archivo → Guardar como**
3. Tipo: **CSV (delimitado por comas) (*.csv)**
4. Guarda
5. Importa el CSV en lugar del Excel

El parser ahora soporta el mismo formato de bloques mensuales en CSV.

---

#### 8. Información para reportar

**Si ninguna de las soluciones funciona, mándame:**

1. Mensaje de error de la consola (screenshot)
2. Versión del navegador (Chrome 120, Firefox 115, etc.)
3. Sistema operativo (Windows 10, macOS, Android, iOS)
4. Tamaño del archivo Excel (KB o MB)
5. Número de hojas en el Excel
6. Si es posible, las primeras 5 líneas del CSV exportado

---

#### 9. Última opción: Formato simple

**Si todo falla, usa el formato simple:**

Crea un CSV con este formato:
```csv
nombre,fecha,tipo
Tesa,2025-01-15,guardia
Paco,2025-01-16,tarde
Mario,2025-01-17,mañana
```

Es más tedioso pero garantiza que funcione.
