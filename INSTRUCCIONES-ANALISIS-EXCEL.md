# 🤖 INSTRUCCIONES PARA ANALIZAR EXCEL DEL CUADRANTE

## Para la IA que va a analizar el archivo:

Hola, necesito que analices un archivo Excel de un cuadrante policial y me des las especificaciones exactas de su estructura para poder importarlo en una aplicación web.

---

## 📋 INFORMACIÓN QUE NECESITO

Por favor, analiza el archivo Excel adjunto y responde **TODAS** estas preguntas con el máximo detalle:

### 1. ESTRUCTURA GENERAL
- ¿Cuántas hojas tiene el archivo?
- ¿Qué hoja contiene los datos del cuadrante?
- ¿En qué fila empiezan los datos (después de los encabezados)?

### 2. ENCABEZADOS (Primera fila con nombres de columnas)
- **Lista EXACTA de todos los encabezados** en la primera fila
- ¿Están en la fila 1, o en otra fila?
- ¿Hay celdas combinadas en los encabezados?
- Ejemplo: `Nombre | Día 1 | Día 2 | Día 3 | ... | Día 31`

### 3. ESTRUCTURA DE DATOS
- ¿Cómo está organizado? Marca una opción:
  - [ ] Una fila por persona, columnas para cada día (horizontal)
  - [ ] Una columna por persona, filas para cada día (vertical)
  - [ ] Una fila por evento (nombre, fecha, tipo)
  - [ ] Otro formato: _______

### 4. NOMBRES DE USUARIOS
- **Lista EXACTA** de todos los nombres en el Excel
- ¿En qué columna están? (A, B, C, etc.)
- ¿Cómo están escritos? (con mayúsculas, minúsculas, con apellidos, etc.)
- Ejemplo: `TESA GARCIA`, `Paco`, `Mario López`, etc.

### 5. FECHAS
- ¿Cómo se representan las fechas?
  - [ ] Cada columna es un día del mes (1, 2, 3, ... 31)
  - [ ] Hay una columna "Fecha" con formato: _______
  - [ ] No hay fechas, solo números de día
  - [ ] Otro: _______
- Si hay columna de fecha, ¿qué formato tiene?
  - Ejemplo: `15/01/2025`, `2025-01-15`, `15-Jan-2025`, etc.

### 6. TIPOS DE EVENTOS
- **Lista EXACTA** de todos los valores que aparecen para marcar eventos
- ¿Cómo se marca que alguien tiene guardia, libre, etc.?
- Ejemplos:
  - ¿Usan iconos? (🚨, 🏖️, ✈️)
  - ¿Usan letras? (G, L, V, A)
  - ¿Usan palabras completas? (Guardia, Libre, Vacaciones)
  - ¿Usan colores en las celdas?
  - ¿Usan números o códigos?

### 7. EJEMPLO DE DATOS
Por favor, proporciona un ejemplo de **3 filas completas** del Excel (sin datos sensibles):

```
Ejemplo:
Fila 1 (encabezados): Nombre | 1 | 2 | 3 | 4 | 5 | ... | 31
Fila 2 (datos):      Tesa   | G | G | G | G | G | L  | ...
Fila 3 (datos):      Paco   | T |   | L |   |   |    | ...
```

### 8. FORMATO DE EXPORTACIÓN CSV
Cuando exportas este Excel a CSV, ¿cómo se ve?
- Adjunta las primeras 5 líneas del CSV tal como se exporta
- Indica si usa comas (,) o punto y coma (;) como separador

### 9. CASOS ESPECIALES
- ¿Hay celdas vacías? ¿Qué significan?
- ¿Hay celdas con múltiples valores? (ej: "G/T" para guardia y tarde)
- ¿Hay notas o comentarios en las celdas?
- ¿Hay filas o columnas totalizadoras?
- ¿Hay fórmulas que necesiten evaluarse?

---

## 📤 FORMATO DE RESPUESTA REQUERIDO

Una vez analizado, responde en este formato:

```json
{
  "estructura": "horizontal|vertical|lista",
  "hoja": "nombre de la hoja o número",
  "fila_inicio_datos": 2,
  "encabezados": {
    "fila": 1,
    "columnas": ["Nombre", "1", "2", "3", "...", "31"]
  },
  "columna_nombres": "A",
  "usuarios": [
    "Tesa García",
    "Paco Martínez",
    "..."
  ],
  "formato_fechas": "columnas_numericas_1_31",
  "separador_csv": ",",
  "tipos_eventos": {
    "G": "guardia",
    "L": "libre",
    "V": "vacaciones",
    "A": "asunto",
    "T": "tarde",
    "M": "mañana",
    "": "sin evento"
  },
  "ejemplo_csv": "Nombre,1,2,3,4,5\nTesa,G,G,G,G,G\nPaco,T,,L,,",
  "observaciones": "Cualquier detalle importante adicional"
}
```

---

## 🎯 OBJETIVO FINAL

Con esta información, el desarrollador creará un parser personalizado que:
1. Lea tu archivo Excel/CSV exactamente como está
2. Lo convierta al formato interno de la aplicación
3. No requiera que modifiques tu archivo original

---

## 📎 ARCHIVOS A ADJUNTAR

Por favor, adjunta:
1. El archivo Excel original (.xls o .xlsx)
2. El mismo archivo exportado como CSV (.csv)
3. Si es posible, una captura de pantalla del Excel para ver el formato visual

---

## ⚠️ IMPORTANTE

- Sé lo MÁS ESPECÍFICO posible
- Copia EXACTAMENTE los valores como aparecen
- No asumas nada, describe todo tal como lo ves
- Si algo no está claro, menciónalo

---

Gracias por el análisis. Esta información permitirá adaptar el parser perfectamente a tu archivo.
