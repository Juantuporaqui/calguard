# 🔍 DIAGNÓSTICO DEL PARSER DE EXCEL

## ❌ Problema Detectado

Los turnos importados NO coinciden con el archivo Excel original. Esto significa que el parser está:
- Leyendo las columnas incorrectas
- Interpretando mal los códigos de eventos
- Confundiendo filas/columnas
- O tiene un error en la lógica de mapeo

---

## 📋 INSTRUCCIONES PARA OTRA IA

### Paso 1: Analizar tu archivo Excel

**Sube tu archivo .xlsx a otra IA (ChatGPT, Claude, etc.) y pídele esto:**

```
Analiza este archivo Excel y dame la siguiente información EXACTA:

1. ESTRUCTURA BÁSICA:
   - ¿Cuántas hojas tiene el archivo?
   - ¿Qué nombre tiene la primera hoja?
   - ¿Cuántas filas tiene (aproximadamente)?
   - ¿Cuántas columnas tiene (excluyendo columnas vacías)?

2. FORMATO DE BLOQUES MENSUALES:
   - Dame las primeras 20 líneas EXACTAS de la hoja tal como aparecen
   - Indica qué hay en cada celda (A1, B1, C1, etc.)

3. ESTRUCTURA DE UN MES:
   Busca el bloque de ENERO 2026 y dime:
   - ¿En qué fila está la palabra "ENERO"? (ej: fila 1, fila 5, etc.)
   - ¿En qué fila están los números de día (1, 2, 3...31)?
   - ¿En qué fila están las letras de día de semana (L, M, X, J, V, S, D)?
   - ¿En qué fila empieza la lista de nombres de personas?

4. EJEMPLO DE PERSONA:
   Busca una fila de "PACO" en ENERO 2026 y dame:
   - ¿En qué columna está el nombre "PACO"? (A, B, C?)
   - ¿Qué hay en las columnas siguientes? (Dame las primeras 10 celdas)
   - Ejemplo: A4=PACO, B4=M, C4=M, D4=T, E4=vacío, F4=L, etc.

5. CÓDIGOS DE EVENTOS:
   - Lista TODOS los códigos diferentes que veas en las celdas de días
   - Por cada código, dime qué crees que significa
   - Ejemplo: M=Mañana, T=Tarde, G=Guardia, etc.

6. NOMBRES DE PERSONAS:
   - Lista TODOS los nombres que aparecen en el cuadrante
   - ¿Cómo están escritos exactamente? (mayúsculas, minúsculas, acentos)

7. EJEMPLO COMPLETO:
   Dame 5 filas completas de ENERO 2026, por ejemplo:
   Fila 1: ENERO (en celda A1)
   Fila 2: vacío, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10...
   Fila 3: vacío, J, V, S, D, L, M, X, J, V, S...
   Fila 4: PACO, M, M, G, G, L, L, T, T, T, Vc...
   Fila 5: TESA, T, T, G, vacío, M, M, M, L, Vc, Vc...
```

---

### Paso 2: Validar los códigos

**Pregunta específicamente:**

```
Para PACO en ENERO 2026, días 1 al 10:
- ¿Qué código tiene el día 1?
- ¿Qué código tiene el día 2?
- ¿Qué código tiene el día 3?
- ...hasta el día 10

Dame la respuesta en formato:
Día 1: M (Mañana)
Día 2: M (Mañana)
Día 3: vacío
Día 4: T (Tarde)
etc.
```

---

### Paso 3: Comparar con lo que muestra CalGuard

**Abre CalGuard y compara:**

1. Ve al cuadrante de Enero 2026
2. Mira la fila de PACO
3. Compara día por día con lo que te dijo la IA

**Anota las diferencias:**
```
DÍA | EXCEL REAL | CALGUARD MUESTRA | ¿COINCIDE?
----|-----------|------------------|------------
1   | M         | L                | ❌ NO
2   | M         | L                | ❌ NO
3   | vacío     | vacío            | ✅ SÍ
4   | T         | M                | ❌ NO
```

---

### Paso 4: Enviarme la información

**Cuando tengas el análisis de la otra IA, envíame:**

1. **Las primeras 20 filas exactas del Excel**
2. **La estructura de un mes completo** (dónde está el nombre del mes, dónde los días, dónde los nombres)
3. **Un ejemplo de persona completo** (PACO o TESA con sus turnos de los primeros 10 días)
4. **La tabla de comparación** (qué muestra Excel vs qué muestra CalGuard)
5. **Lista de TODOS los códigos** que aparecen en el Excel

---

## 🔧 Posibles problemas que voy a buscar

Con tu información, podré detectar si el error es:

### A) Desplazamiento de columnas
- El parser puede estar leyendo la columna B cuando debería leer C
- O viceversa

### B) Mapeo de códigos incorrecto
- Quizás "M" no significa "Mañana" en tu Excel
- O "T" no es "Tarde"

### C) Estructura diferente
- El mes puede estar en una fila diferente
- Los nombres pueden estar en otra columna
- Las celdas pueden tener espacios o caracteres invisibles

### D) Años múltiples mezclados
- Si tienes datos de 2024, 2025, 2026 en el mismo archivo
- El parser puede estar confundiendo los años

---

## 📊 Formato de respuesta que necesito

**Por favor, envíame un mensaje con este formato:**

```
=== ESTRUCTURA DEL EXCEL ===
Hojas: 1
Nombre de la hoja: [nombre]
Filas totales: [número]

=== PRIMERAS 20 FILAS ===
Fila 1: [contenido completo]
Fila 2: [contenido completo]
...

=== ESTRUCTURA DE ENERO 2026 ===
Fila del mes: [número]
Fila de días (1-31): [número]
Fila de letras (L,M,X...): [número]
Primera fila de persona: [número]

=== EJEMPLO: PACO EN ENERO ===
Columna del nombre: [A, B, C?]
Día 1 (columna B): [código]
Día 2 (columna C): [código]
...

=== TODOS LOS CÓDIGOS ENCONTRADOS ===
M = [significado]
T = [significado]
G = [significado]
...

=== COMPARACIÓN EXCEL vs CALGUARD ===
[Tu tabla de comparación]
```

---

## ⚡ Solución rápida temporal

**Mientras tanto, puedes usar el formato CSV simple:**

1. Crea un nuevo archivo CSV con este formato:
```csv
nombre,fecha,tipo
Paco,2026-01-02,mañana
Paco,2026-01-03,mañana
Tesa,2026-01-02,tarde
```

2. Guárdalo como `turnos-enero.csv`
3. Importa ese archivo en CalGuard

Es más tedioso pero garantiza que los datos sean correctos mientras arreglo el parser.

---

## 🎯 Objetivo

Una vez que me envíes la información completa del análisis, podré:
1. Ajustar el parser para leer las columnas correctas
2. Corregir el mapeo de códigos
3. Validar que los turnos coincidan exactamente con tu Excel

¡Espero tu respuesta con el análisis!
