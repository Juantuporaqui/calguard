# Guía de Importación de Cuadrantes

CalGuard ahora soporta **4 formatos diferentes** para importar cuadrantes de turnos:

## 📊 Formato Excel (.xlsx, .xls)

### Estructura requerida:
```
2024                          <- Año (en cualquier celda de la fila)
ENERO                         <- Mes en español (columna A)
        1    2    3    4   5  <- Números de días (columnas B en adelante)
        L    M    X    J   V  <- Días de la semana (OPCIONAL, se ignora)
García López  G    L    V   G  <- Nombre en columna A, turnos en columnas
Tesa Martínez L    G    G   L
López García  V    L    L   G
```

### ✅ **MEJORA**: Ahora tolera filas vacías
- ❌ **Antes**: Se detenía en la primera fila vacía (por eso solo se importaba Tesa)
- ✅ **Ahora**: Salta filas vacías y continúa leyendo hasta encontrar 3 filas vacías consecutivas

### Consejos:
- **Todos los nombres deben estar en la columna A** (primera columna)
- No debe haber celdas combinadas en la columna A
- Puede haber filas vacías entre personas (se saltan automáticamente)
- Se procesan todas las hojas del archivo Excel

---

## 📄 Formato CSV (.csv)

### ¡Nuevo! Fácil de exportar desde Excel

**Cómo crear el CSV:**
1. En Excel, ve a **Archivo → Guardar como**
2. Selecciona formato **CSV (separado por comas)**
3. Guarda el archivo

### Formato:
```csv
Fecha,Persona,Turno
2024-01-15,García López,G
2024-01-15,Tesa Martínez,L
2024-01-16,García López,L
2024-01-16,Tesa Martínez,G
2024-01-17,López García,V
```

### Formatos de fecha soportados:
- `2024-01-15` (ISO, recomendado)
- `15/01/2024` (día/mes/año)
- `15-01-2024` (día-mes-año)
- `15/01` (día/mes, usa año actual)

### Con encabezados (opcional):
```csv
Fecha,Persona,Turno
2024-01-15,García López,G
```

### Ventajas:
✅ Simple y robusto
✅ No se rompe con filas vacías
✅ Fácil de generar desde Excel
✅ Se puede editar en cualquier editor de texto

---

## 💬 Formato Texto (.txt)

### ¡Nuevo! Perfecto para WhatsApp

**Ideal para**: Copiar/pegar cuadrantes compartidos por WhatsApp o mensajes

### Formato:
```
15/01 García López: G
15/01 Tesa Martínez: L
16/01 García López: L
16/01 Tesa: G
17/01 López García: V
```

### Formatos de fecha soportados:
```
2024-01-15 García López: G       (ISO completo)
15-01-2024 Tesa: L               (día-mes-año)
15/01 García: G                  (día/mes, usa año actual)
15 enero López: V                (día mes en español)
```

### Reglas:
- Cada línea: `fecha persona: turno`
- Los dos puntos (`:`) son obligatorios para separar persona de turno
- Se ignoran líneas vacías
- Se ignoran líneas que empiezan con `#` o `//` (comentarios)

### Ejemplo con comentarios:
```
# Cuadrante Enero 2024
# Grupo A

15/01 García López: G
15/01 Tesa: L

# Fin de semana
16/01 García: L
16/01 Tesa: G
```

### Ventajas:
✅ Se puede copiar directamente desde WhatsApp
✅ No requiere Excel
✅ Fácil de escribir manualmente
✅ Soporta nombres cortos (ej: "Tesa" en vez de "Tesa Martínez")

---

## 📑 Formato PDF (.pdf)

### Soportado igual que antes
- Extrae texto del PDF y lo procesa
- Busca el mismo patrón que Excel (mes/año/días/personas)
- **Nota**: Los PDFs pueden ser menos precisos según el formato

---

## 🔖 Códigos de Turnos Soportados

Todos los formatos reconocen los mismos códigos:

| Código | Significado | Variantes aceptadas |
|--------|-------------|---------------------|
| **G** | Guardia Real | G, GU, GUARDIA |
| **L** | Libre | L, LI, LIBRE |
| **V** | Vacaciones | V, VC, VAC, VACACIONES |
| **T** | Turno Tarde | T, TA, TARDE |
| **M** | Turno Mañana | M, MA, MAÑANA, MANANA |
| **N** | Turno Noche | N, NOCHE |
| **AP** | Asunto Propio | AP, A.P., ASUNTO |
| **F** | Formación | F, FORM, FORMACION, FORMACIÓN |
| **J** | Juicio | J, JUICIO |

**Nota**: Los códigos NO son sensibles a mayúsculas/minúsculas

---

## 🚀 Cómo Importar

1. Ve a **Configuración** → **Importar Cuadrante**
2. Haz clic en **"Seleccionar archivo"**
3. Elige tu archivo (.xlsx, .csv, .txt o .pdf)
4. Escribe tu nombre (o selecciónalo de la lista)
5. Haz clic en **"Importar"**

---

## 💡 Recomendaciones

### Para compartir por WhatsApp:
1. **Opción 1**: Usa formato texto (.txt)
   - Fácil de copiar/pegar directamente
   - Ejemplo: `15/01 Juan: G`

2. **Opción 2**: Convierte a CSV desde Excel
   - Más estructurado
   - Se puede adjuntar como archivo

### Para cuadrantes grandes:
- **Excel (.xlsx)**: Mejor para cuadrantes mensuales completos
- **CSV (.csv)**: Mejor para intercambio entre sistemas

### Para cuadrantes puntuales:
- **Texto (.txt)**: Mejor para actualizaciones rápidas o cambios específicos

---

## ❓ Solución de Problemas

### "Solo se importan los turnos de una persona"
✅ **Solucionado**: Usa el parser mejorado de Excel o prueba con CSV/TXT

### "No se importa nada"
- Verifica que las fechas estén en formato válido
- Verifica que los códigos de turno sean reconocidos (G, L, V, etc.)
- En CSV/TXT: verifica que haya dos puntos (`:`) entre persona y turno

### "Faltan algunos días"
- En Excel: asegúrate de que los números de día estén en la fila de encabezado
- En CSV/TXT: verifica que las fechas estén bien formateadas

---

## 📝 Ejemplos Completos

### Ejemplo 1: CSV simple para WhatsApp

Crear archivo `cuadrante.csv`:
```csv
15/01/2024,García López,G
15/01/2024,Tesa,L
16/01/2024,García López,L
16/01/2024,Tesa,G
```

### Ejemplo 2: Texto desde mensaje de WhatsApp

Copiar mensaje de WhatsApp a `turnos.txt`:
```
Hola equipo, estos son los turnos:

15/01 García: G
15/01 Tesa: L
16/01 García: L
16/01 Tesa: G

Saludos
```

Después abrir el archivo, eliminar las líneas extra y guardar:
```
15/01 García: G
15/01 Tesa: L
16/01 García: L
16/01 Tesa: G
```

---

## 🎯 Resumen Rápido

| Formato | Exportar desde Excel | WhatsApp | Robusto | Complejo |
|---------|---------------------|----------|---------|----------|
| **Excel** | ⚠️ (formato nativo) | ❌ | ⚠️ | ⭐⭐⭐ |
| **CSV** | ✅ (Guardar como CSV) | ⚠️ (adjuntar) | ✅ | ⭐ |
| **Texto** | ❌ | ✅ (copiar/pegar) | ✅ | ⭐ |
| **PDF** | ⚠️ (Exportar como PDF) | ⚠️ (adjuntar) | ⚠️ | ⭐⭐ |

**Recomendación**:
- 📊 Cuadrantes mensuales → **Excel o CSV**
- 💬 Compartir por WhatsApp → **CSV (adjunto) o Texto (copiar/pegar)**
- ⚡ Cambios rápidos → **Texto**
