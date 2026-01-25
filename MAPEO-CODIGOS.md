# 📋 Mapeo de Códigos del Cuadrante

## Códigos detectados en tu CSV y cómo se interpretan:

### ✅ Vacaciones
- `V` → vacaciones
- `VV` → vacaciones
- `VAC` → vacaciones
- Cualquier código que contenga "VAC"

### 🌅 Mañana
- `M` → mañana
- Cualquier código que contenga "MAN"

### 🌆 Tarde
- `T` → tarde
- Cualquier código que contenga "TARD"

### 📝 Asunto Propio
- `AP` → asunto
- Cualquier código que contenga "ASUNT"

### 🏖️ Libre
- `CH` → libre
- `C` → libre
- `LS` → libre
- `Ls` → libre
- Cualquier código que contenga "CH" o "L"

### 🚨 Guardia
- `INC` → guardia (Incidencia)
- `Inc` → guardia
- `inc` → guardia
- `B` → guardia
- `XX` → guardia
- `P` → guardia
- `TD` → guardia

### ❌ Códigos Ignorados
Los siguientes códigos no están mapeados y serán ignorados:
- `CUR`, `Cur`, `Cu` - Curso
- `ENF`, `Enf`, `enf` - Enfermo
- `EXP`, `Ex`, `Ex.` - Expediente
- `Fam` - Asuntos familiares
- `JUI` - Judicial
- `Jor.` - Jornada
- `P.Ur` - Permanencia urbana
- `Per.` - Permiso
- Nombres propios (Jose Luis, Mario, Paco, Patricia, Rafael, Veronica, Carmen)
- Textos largos (ej: "21 julio a 17 agosto (19 días)")
- Otros códigos desconocidos

## 👥 Nombres de Usuarios

### Nombres Reconocidos:
- `TESA` → Tesa ✅
- `PACO` → Paco ✅
- `MARIO` → Mario ✅
- `RAFAEL` / `RAFA` → Rafa ✅
- `REINOSO` → Reinoso ✅
- `NURIA` → Nuria ✅
- `JUAN` → Juan ✅
- `CARMEN` / `Mª CARMEN` / `M CARMEN` / `MA CARMEN` → Carmen ✅

### Usuarios Ignorados (no están en el equipo actual):
- `PATRICIA` ❌
- `VERONICA` ❌

## 🔧 Ajustes Necesarios

**Si algún código se está interpretando mal**, necesito que me digas:

1. ¿Qué código está mal?
2. ¿Qué debería significar realmente?

Por ejemplo:
- Si `CH` no es "libre", dime qué es
- Si `C` no es "libre", dime qué es
- Si `INC` no es "guardia", dime qué es
- etc.

## 📊 Formato del Archivo

El parser ahora detecta automáticamente:

### Formato 1: CSV Simple
```csv
nombre,fecha,tipo
Tesa,2025-01-15,guardia
Paco,2025-01-16,tarde
```

### Formato 2: Bloques Mensuales Horizontales
```
ENERO
,1,2,3,4,5,...,31
,X,J,V,S,D,...
PACO,,CH,CH,,,,CH,CH,V,V,...
CARMEN,,M,M,,,,M,M,AP,AP,...
```

El formato de bloques es el que detecté en tu análisis JSON. El parser:
- Busca filas con nombres de meses (ENERO, FEBRERO, etc.)
- Detecta filas con números 1-31 (días del mes)
- Ignora filas con letras de día de semana (L,M,X,J,V,S,D)
- Lee filas de personas y extrae eventos de las columnas 1-31
- Limita a las primeras 33 columnas (A-AG) para evitar las 16384 columnas vacías de Excel

## 🐛 Si el archivo .xlsx no carga

Abre la consola del navegador (F12) y mira si hay errores. Debería mostrar:
1. "File selected: nombre.xlsx..."
2. "Parseando Excel, hojas disponibles: ..."
3. "Detectado formato Excel con bloques mensuales"
4. "Año detectado: ..."
5. "Mes detectado: ..."
6. "Excel de bloques procesado: X eventos de Y usuarios"

Si hay un error, cópiame el mensaje completo.
