# 📋 Formato CSV para Importar Cuadrante

## ✅ Formato Correcto

El archivo CSV debe tener **3 columnas** con estos nombres (en la primera fila):

```csv
nombre,fecha,tipo
```

### Columnas Requeridas:

1. **nombre** - Nombre del funcionario
   - Valores permitidos: `Tesa`, `Paco`, `Mario`, `Rafa`, `Reinoso`, `Nuria`, `Juan`, `Carmen`
   - No es sensible a mayúsculas/minúsculas
   - Puede ser abreviado (ej: `Tesa`, `tesa`, `TESA` funcionan)

2. **fecha** - Fecha del evento
   - **Formato obligatorio:** `YYYY-MM-DD` (ej: `2025-01-15`)
   - ❌ NO usar: `15/01/2025` o `15-01-2025`
   - ✅ Usar: `2025-01-15`

3. **tipo** - Tipo de evento
   - Valores permitidos:
     - `guardia` - Guardia
     - `libre` - Día libre
     - `asunto` - Asunto propio
     - `vacaciones` - Vacaciones
     - `tarde` - Turno de tarde
     - `mañana` - Turno de mañana

## 📝 Ejemplo Completo

```csv
nombre,fecha,tipo
Tesa,2025-01-06,guardia
Tesa,2025-01-07,guardia
Paco,2025-01-08,tarde
Mario,2025-01-09,libre
Rafa,2025-01-10,vacaciones
```

## 🔧 Cómo Crear el CSV desde Excel

### Opción 1: Desde Excel en Ordenador

1. Crea una hoja con 3 columnas: `nombre`, `fecha`, `tipo`
2. Rellena los datos siguiendo el formato de arriba
3. **Archivo → Guardar como**
4. Tipo: **CSV (delimitado por comas) (*.csv)**
5. Guarda el archivo
6. Importa en CalGuard con "📥 Cargar Cuadrante"

### Opción 2: Desde Excel en Móvil

1. Abre Excel en tu móvil
2. Crea/edita la hoja con el formato correcto
3. **Compartir → Exportar**
4. Formato: **CSV**
5. Guarda en tu dispositivo
6. Importa en CalGuard

### Opción 3: Desde Google Sheets

1. Crea la hoja en Google Sheets
2. **Archivo → Descargar → Valores separados por comas (.csv)**
3. Importa el archivo descargado

## ⚠️ Errores Comunes

### ❌ Error: "No se encontraron las columnas necesarias"
**Causa:** Los encabezados no están correctos
**Solución:** La primera línea debe ser exactamente: `nombre,fecha,tipo`

### ❌ Error: "formato de fecha inválido"
**Causa:** Las fechas no están en formato YYYY-MM-DD
**Solución:** Cambiar `15/01/2025` por `2025-01-15`

### ❌ Error: "No se pudo procesar ningún evento"
**Causa:** Los datos no coinciden con el formato esperado
**Solución:** Revisa que:
- Las fechas estén en formato `YYYY-MM-DD`
- Los nombres coincidan con los 8 funcionarios
- Los tipos sean válidos (guardia, libre, asunto, etc.)

## 💡 Consejos

- Usa el archivo `ejemplo-cuadrante.csv` como plantilla
- Copia y pega los datos en Excel
- Mantén el formato de fecha como texto para evitar conversiones automáticas
- No uses espacios extra ni caracteres especiales
- Guarda siempre como CSV, no como Excel (.xlsx)

## 🔍 Separadores Soportados

El sistema detecta automáticamente:
- `,` (coma) - Formato estándar
- `;` (punto y coma) - Formato europeo
- `	` (tabulador) - Formato TSV

## 📊 Verificar el Archivo

Antes de importar, abre el CSV con un editor de texto (Notepad, TextEdit) y verifica que se vea así:

```
nombre,fecha,tipo
Tesa,2025-01-06,guardia
Paco,2025-01-07,tarde
```

Si ves algo raro (caracteres extraños, comillas, etc.), el archivo puede tener problemas.
