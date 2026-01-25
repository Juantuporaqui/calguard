# 🎯 RESUMEN: Cómo solucionar el problema del parser

## ❌ El Problema
Los turnos importados desde tu Excel **NO coinciden** con los datos reales. Esto puede deberse a:
- Columnas desfasadas (lee columna B cuando debería leer C)
- Códigos mal interpretados (M no es Mañana en tu Excel)
- Estructura diferente a la esperada

---

## ✅ Soluciones (3 opciones)

### 🔍 OPCIÓN 1: Diagnóstico completo (RECOMENDADO)

**Lee el archivo:** `DIAGNOSTICO-EXCEL-PARSER.md`

**Pasos:**
1. Sube tu Excel a otra IA (ChatGPT, Claude, etc.)
2. Pídele que analice la estructura exacta
3. Envíame la información que te dé
4. Yo ajusto el parser para que lea correctamente

**Ventajas:**
- ✅ Solución definitiva
- ✅ Podrás importar Excel directamente siempre
- ✅ Se corrige para todos

**Tiempo:** 10-15 minutos (depende de ti)

---

### 🐛 OPCIÓN 2: Debug en consola

**Lee el archivo:** `DEBUG-CONSOLA.md`

**Pasos:**
1. Abre CalGuard en el navegador
2. Abre la consola (F12)
3. Importa tu Excel
4. Copia los logs que aparecen
5. Compara con tu Excel
6. Envíame las diferencias

**Ventajas:**
- ✅ Ves exactamente qué lee el parser
- ✅ Puedes identificar el problema tú mismo
- ✅ Más rápido si sabes usar la consola

**Tiempo:** 5-10 minutos

---

### 📝 OPCIÓN 3: Solución rápida (CSV manual)

**Crear un CSV simple:**

```csv
nombre,fecha,tipo
Tesa,2026-01-02,mañana
Tesa,2026-01-03,mañana
Tesa,2026-01-04,tarde
Paco,2026-01-02,libre
Paco,2026-01-03,libre
Mario,2026-01-02,guardia
```

**Pasos:**
1. Abre Excel o un editor de texto
2. Crea el archivo con ese formato
3. Una línea por cada turno
4. Guarda como `turnos.csv`
5. Importa en CalGuard

**Ventajas:**
- ✅ Funciona 100% garantizado
- ✅ No depende de otra IA
- ✅ Control total sobre los datos

**Desventajas:**
- ❌ Tedioso si tienes muchos datos
- ❌ No soluciona el problema del Excel

**Tiempo:** 30-60 minutos (depende de cuántos turnos)

---

## 🚀 ¿Qué opción elegir?

### Si tienes 5-10 minutos ahora:
👉 **OPCIÓN 1 o 2** - Diagnostica y yo lo arreglo

### Si tienes prisa:
👉 **OPCIÓN 3** - CSV manual (funciona ya)

### Si quieres entender qué falla:
👉 **OPCIÓN 2** - Debug en consola

---

## 📋 Información que necesito (Opción 1 o 2)

Envíame un mensaje con esto:

```
=== ESTRUCTURA DEL EXCEL ===
[Lo que te diga la otra IA o lo que veas en consola]

=== EJEMPLO DE PERSONA (PACO, primeros 10 días) ===
Día 1: M (Mañana)
Día 2: M (Mañana)
Día 3: vacío
Día 4: T (Tarde)
...

=== COMPARACIÓN ===
DÍA | EXCEL | CALGUARD | ¿COINCIDE?
1   | M     | L        | ❌
2   | M     | L        | ❌
3   | vacío | vacío    | ✅
...

=== LOGS DE CONSOLA (si usaste Opción 2) ===
[Pega aquí lo que salió en la consola del navegador]
```

---

## 🔧 Lo que voy a arreglar

Una vez que tenga la información, ajustaré:

1. **Índice de columnas**
   ```javascript
   // De:
   const cellIndex = dia;  // Puede estar mal

   // A:
   const cellIndex = dia + offset;  // Correcto
   ```

2. **Mapeo de códigos**
   ```javascript
   // Si tu "M" no es "Mañana", cambiaré:
   const codigoMap = {
       'M': 'tipo_correcto',  // Lo que sea en tu caso
       ...
   }
   ```

3. **Detección de estructura**
   ```javascript
   // Si tus nombres están en columna B en vez de A:
   const nombreRaw = cells[1];  // En vez de cells[0]
   ```

---

## ⏱️ Tiempo estimado de arreglo

- Si me das la info: **5 minutos** para ajustar el parser
- Test y validación: **5 minutos**
- **Total: ~10 minutos** desde que reciba la información

---

## 💡 Mientras tanto...

Puedes usar CalGuard normalmente:
- ✅ Tu calendario personal funciona
- ✅ El cuadrante grupal funciona (aunque con datos incorrectos)
- ✅ Puedes añadir turnos manualmente haciendo clic en las celdas

Solo el **import automático desde Excel** tiene el problema. Todo lo demás funciona perfecto.

---

## 📞 ¿Dudas?

Pregúntame cualquier cosa sobre:
- Cómo usar la consola del navegador
- Cómo analizar el Excel con otra IA
- Cómo crear el CSV manual
- Cualquier otra duda

¡Estoy aquí para ayudarte! 🚀
