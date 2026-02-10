# SECURITY.md - Seguridad de CalGuard

## Principios

1. **Offline-first**: No hay comunicación con servidores externos
2. **Cero dependencias remotas**: Sin CDN, sin analytics, sin tracking
3. **Datos locales**: Todo se almacena en IndexedDB del navegador
4. **Sin PII por defecto**: La app advierte contra introducir datos personales sensibles

## Content Security Policy (CSP)

La CSP está definida en `index.html` vía meta tag:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self';
font-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
```

- **script-src 'self'**: Solo scripts del mismo origen. No inline scripts.
- **style-src 'self' 'unsafe-inline'**: Estilos propios. `unsafe-inline` necesario para estilos dinámicos del renderer.
- **connect-src 'self'**: Solo conexiones al mismo origen (Service Worker).
- **object-src 'none'**: Bloquea plugins (Flash, Java).

## PIN de Bloqueo

### Implementación
- El PIN se hashea con **PBKDF2** (600.000 iteraciones, SHA-256)
- El hash resultante se almacena en IndexedDB (`pinHash`)
- El PIN original **nunca se almacena**
- La verificación compara hashes

### Auto-bloqueo
- Configurable: 1-60 minutos de inactividad
- Detecta: click, keydown, touchstart, scroll
- Al bloquear: la UI se reemplaza completamente por la pantalla de PIN
- Los datos no son accesibles desde la consola mientras está bloqueado (el DOM se limpia)

### Recomendaciones
- Usar PIN de al menos 6 dígitos
- Activar auto-bloqueo a 2-5 minutos en entornos compartidos

## Cifrado (Modo Seguro)

### Backup cifrado
- **Algoritmo**: AES-GCM con clave de 256 bits
- **Derivación de clave**: PBKDF2 con 600.000 iteraciones y salt aleatorio de 16 bytes
- **IV**: 12 bytes aleatorios por cifrado
- **Formato**: base64(salt + iv + ciphertext)
- La contraseña **no se almacena** en ningún lugar

### Uso
1. En Ajustes > Backup > "Exportar Backup Cifrado"
2. Introduce una contraseña fuerte (mínimo 4 caracteres, recomendado 8+)
3. El archivo descargado contiene los datos cifrados
4. Para restaurar: importar y proporcionar la misma contraseña

## Datos sensibles

### Política por defecto
- La app NO almacena datos personales sensibles (PII)
- Los servicios de la bitácora usan campos genéricos (municipio, tipo de servicio)
- Se muestra una advertencia al crear servicios: "No introducir nombres, DNI, direcciones exactas"

### Marcado SENSIBLE
- Si el usuario decide registrar datos más específicos, puede marcar un servicio como "SENSIBLE"
- Los servicios sensibles se excluyen de las exportaciones CSV
- En un futuro, el Modo Seguro cifrará estos campos en reposo

## Recomendaciones operativas

1. **No compartir el dispositivo** sin bloqueo por PIN
2. **Realizar backups periódicos** (semanales recomendado)
3. **Usar backup cifrado** si se transfiere a otro dispositivo
4. **No introducir**:
   - Nombres de víctimas, testigos o imputados
   - Números de atestado
   - Direcciones exactas de domicilios
   - DNI, pasaportes u otros identificadores
5. **Borrar datos** antes de entregar/reciclar el dispositivo (Ajustes > Resetear todo)

## Auditoría

Todas las acciones relevantes se registran en el store `audit`:
- Creación/modificación de tags en días
- Movimientos del ledger
- Creación de servicios
- Migración de datos

El log de auditoría no contiene datos sensibles, solo referencias (fechas, tipos).
